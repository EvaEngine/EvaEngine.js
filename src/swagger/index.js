/*eslint new-cap: [1]*/

import fs from 'fs';
import doctrine from 'doctrine';
import * as acorn from 'acorn/dist/acorn';
import glob from 'glob';
import yaml from 'js-yaml';

export const TYPE_PATH = 'path';
export const TYPE_DEFINITION = 'definition';
export const TYPE_EXCEPTION = 'exception';
export const TYPE_UNKNOWN = 'unknown';

//Mapping sequelize data types to swagger data types
//Sequelize types: http://docs.sequelizejs.com/en/latest/api/datatypes/
//Swagger Data Types: http://swagger.io/specification/
export const MODEL_TYPE_MAPPING = {
  BIGINT: 'integer',
  INTEGER: 'integer',
  FLOAT: 'number',
  DOUBLE: 'number',
  DECIMAL: 'number',
  BOOLEAN: 'boolean',
  CHAR: 'string',
  STRING: 'string',
  TEXT: 'string',
  REAL: 'string',
  TIME: 'string',
  DATE: 'string',
  DATEONLY: 'string',
  HSTORE: 'string',
  JSON: 'string',
  JSONB: 'string',
  NOW: 'string',
  BLOB: 'string',
  UUID: 'string',
  UUIDV1: 'string',
  UUIDV4: 'string',
  VIRTUAL: 'string'
};

const modelDefaultValueHandlers = {
  integer: v => parseInt(v, 10),
  boolean: v => Boolean(parseInt(v, 10)),
  number: v => parseFloat(v),
  default: v => v
};

let yamlErrors = [];

/**
 * A Swagger Json document generator
 * Generate document from
 * - JS source code annotations (Parser is Doctrine)
 * - ORM entities (Based on Sequelize)
 * - Exceptions
 */
export default class ExSwagger {

  /**
   * Get file path array by glob
   * @param path
   * @param options
   * @returns {Promise|Array.<string>}
   */
  static async scanFiles(path, options = {}) {
    return new Promise((resolve, reject) => {
      glob(path, options, (err, files) => {
        if (err) {
          return reject(err);
        }
        return resolve(files);
      });
    });
  }

  /**
   * Get file content
   * @param path
   * @param options
   * @returns {Promise|string}
   */
  static async readFile(path, options = {}) {
    return new Promise((resolve, reject) => {
      fs.readFile(path, options, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  }

  /**
   * Write content to file
   * @param content
   * @param dist
   * @returns {Promise}
   */
  static async writeFile(content, dist) {
    return new Promise((resolve, reject) => {
      fs.open(dist, 'w', '0777', (error, fd) => {
        if (error) {
          return reject(error);
        }
        return resolve(fs.write(fd, content));
      });
    });
  }

  /**
   * Get annotations from comments
   * An annotation MUST start with double stars
   * @param files
   * @returns {Array.<string>}
   */
  static async getAnnotations(files) {
    const comments = [];
    for (const filepath of files) {
      const source = await ExSwagger.readFile(filepath);
      acorn.parse(source, {
        onComment: comments
      });
    }
    //Annotations MUST start with double stars
    return comments.filter((v) => v.type === 'Block' && v.value.startsWith('*\n'));
  }

  static getSwaggerDocs(annotations) {
    return ExSwagger._parseAnnotations(annotations);
  }

  static _doctrineTagToElement(tag) {
    const { title, description, type } = tag;
    if (title !== 'swagger') {
      return {
        description,
        type: TYPE_EXCEPTION,
        value: type ? type.name : TYPE_UNKNOWN
      };
    }

    let value = {};
    let elementType = TYPE_UNKNOWN;
    try {
      value = yaml.load(description);
      const key = Object.keys(value)[0];
      elementType = key.startsWith('/') ? TYPE_PATH : TYPE_DEFINITION;
    } catch (e) {
      //NOTE: Swagger docs 解析错误也不会报错
      yamlErrors.push(e);
    }
    return {
      type: elementType,
      description,
      value
    };
  }

  static _parseAnnotations(annotations) {
    yamlErrors = [];
    const docs = [];
    for (const annotation of annotations) {
      if (!annotation.value) {
        continue;
      }
      //支持两种注解:
      //1. 所有行首必定为 space*
      //2. 所有行首必定不为 space*
      const unwrap = annotation.value.startsWith('*\n *');
      const { tags: tags = [] } = doctrine.parse(annotation.value, { unwrap });
      if (tags.length < 1) {
        continue;
      }
      let doc = [];
      doc = tags.filter(tag => {
        if (
          tag.title
          && (tag.title === 'swagger' || tag.title === 'throws')
          && tag.description
        ) {
          return tag;
        }
        return null;
      }).map(ExSwagger._doctrineTagToElement);
      if (doc.length > 0) {
        docs.push(doc);
      }
    }
    return docs;
  }

  static _modelToSwagger(model) {
    const definition = {
      type: 'object',
      properties: {}
    };
    const requires = [];
    for (const columnName in model) {
      if (!model.hasOwnProperty(columnName)) {
        continue;
      }
      const column = model[columnName];
      const swaggerType = MODEL_TYPE_MAPPING[column.type.key];
      const property = {
        type: swaggerType,
        description: column.comment
      };
      if (column.defaultValue) {
        const defaultValueHandler = modelDefaultValueHandlers[swaggerType] ?
          modelDefaultValueHandlers[swaggerType] : modelDefaultValueHandlers.default;
        property.default = defaultValueHandler(column.defaultValue);
      }
      if (column.allowNull === false) {
        requires.push(columnName);
      }
      definition.properties[columnName] = property;
    }
    definition.required = requires;
    return definition;
  }

  static getModels(models, blacklist = []) {
    const swaggerModels = new Map();
    for (const modelName in models) {
      if (!models.hasOwnProperty(modelName)) {
        continue;
      }
      if (blacklist.includes(modelName)) {
        continue;
      }
      const model = ExSwagger._modelToSwagger(models[modelName].attributes);
      swaggerModels.set(modelName, model);
    }
    return swaggerModels;
  }

  static async scanExceptions(path, exceptionInterface = Error) {
    const exceptions = {};
    const files = await ExSwagger.scanFiles(path);
    if (files.length < 1) {
      return exceptions;
    }
    for (const file of files) {
      const exceptionsInFile = require(file);
      for (const exceptionName in exceptionsInFile) {
        if (!exceptionsInFile.hasOwnProperty(exceptionName)) {
          continue;
        }
        const exceptionClass = exceptionsInFile[exceptionName];
        const exception = new exceptionClass(exceptionName);
        if (exception instanceof exceptionInterface) {
          exceptions[exceptionName] = exception;
        }
      }
    }
    return exceptions;
  }

  static _exceptionClassToSwagger(exception) {
    return {
      properties: {
        code: {
          type: 'integer',
          format: 'int64'
        },
        message: {
          type: 'string'
        }
      },
      required: [
        'code',
        'message'
      ],
      example: {
        code: exception.getCode(),
        message: exception.message
      }
    };
  }

  async exportJson(dist) {
    const files = await ExSwagger.scanFiles(this._annotationPath);
    const annotations = await ExSwagger.getAnnotations(files);
    const docs = ExSwagger.getSwaggerDocs(annotations);
    const template = this._swaggerTemplate;
    const exceptions = await ExSwagger.scanExceptions(
      this._exceptionPath, this._exceptionInterface
    );
    let key = '';
    for (const section of docs) {
      let path = null;
      let method = null;
      for (const element of section) {
        if (element.type === TYPE_PATH) {
          path = Object.keys(element.value)[0];
          method = Object.keys(element.value[path])[0];
          if (!template.paths[path]) {
            template.paths[path] = {};
          }
          template.paths[path][method] = element.value[path][method];
        } else if (element.type === TYPE_DEFINITION) {
          key = Object.keys(element.value)[0];
          template.definitions[key] = element.value[key];
        } else if (element.type === TYPE_EXCEPTION) {
          //目前throw一定要定义在path下面
          key = element.value;
          const exception = exceptions[key];
          //console.log(exceptionClass);
          if (exception) {
            template.definitions[key] = ExSwagger._exceptionClassToSwagger(exception);
            if (path && method) {
              template.paths[path][method].responses[exception.getStatusCode()] = {
                description: element.description,
                schema: {
                  $ref: `#/definitions/${key}`
                }
              };
            }
          }
        }
      }
    }
    const models = ExSwagger.getModels(this._models, this._modelBlacklist);
    models.forEach((model, modelName) => {
      template.definitions[modelName] = model;
    });
    return await ExSwagger.writeFile(JSON.stringify(template), dist);
  }

  static getYamlErrors() {
    return yamlErrors;
  }

  getStates() {
    return {
      swaggerTemplate: this._swaggerTemplate,
      models: this._models,
      modelBlacklist: this._modelBlacklist,
      annotationPath: this._annotationPath,
      exceptionPath: this._exceptionPath,
      exceptionInterface: this._exceptionInterface
    };
  }

  constructor({
    projectRoot,
    swaggerTemplate,
    annotationPath = `${projectRoot}/**/*.js`,
    exceptionInterface,
    models,
    modelBlacklist,
    exceptionPath = `${projectRoot}/**/exceptions/**/*.js`
  }) {
    this._swaggerTemplate = swaggerTemplate;
    this._models = models;
    this._modelBlacklist = modelBlacklist;
    this._annotationPath = annotationPath;
    this._exceptionPath = exceptionPath;
    this._exceptionInterface = exceptionInterface;
  }
}
