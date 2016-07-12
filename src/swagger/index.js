/*eslint new-cap: [1]*/

import fs from 'fs';
import Promise from 'bluebird';
import doctrine from 'doctrine';
import * as acorn from 'acorn/dist/acorn';
import glob from 'glob';
import yaml from 'js-yaml';
import Entitles from '../entities';
import { RuntimeException, StandardException } from '../exceptions';
require('acorn-es7-plugin')(acorn);


Promise.promisifyAll(fs);

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
 * - EvaEngine Exceptions
 */
export class ExSwagger {

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
   * Get annotations from comments
   * An annotation MUST start with double stars
   * @param files {Array.<string>}
   * @returns {Array.<string>}
   */
  static async filesToAnnotations(files) {
    const comments = [];
    for (const filepath of files) {
      const source = await fs.readFileAsync(filepath);
      acorn.parse(source, {
        ecmaVersion: 7,
        plugins: { asyncawait: true },
        allowImportExportEverywhere: true,
        onComment: comments
      });
    }
    //Annotations MUST start with double stars
    return comments.filter((v) => v.type === 'Block' && v.value.startsWith('*\n'));
  }

  static annotationsToFragments(annotations) {
    yamlErrors = [];
    const fragments = [];
    for (const annotation of annotations) {
      if (!annotation.value) {
        continue;
      }
      //支持两种注解:
      //1. 所有行首必定为 space*
      //2. 所有行首必定不为 space*
      const unwrap = annotation.value.startsWith('*\n *');
      const { tags: jsDocs = [] } = doctrine.parse(annotation.value, { unwrap });
      if (jsDocs.length < 1) {
        continue;
      }
      let fragment = [];
      fragment = jsDocs.filter(tag => {
        if (
          tag.title
          && (tag.title === 'swagger' || tag.title === 'throws')
          && tag.description
        ) {
          return tag;
        }
        return null;
      }).map(ExSwagger.annotationToFragment);
      if (fragment.length > 0) {
        fragments.push(fragment);
      }
    }
    return fragments;
  }

  static annotationToFragment(annotation) {
    const { title, description, type } = annotation;
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

  static modelToSwaggerDefinition(model) {
    const definition = {
      type: 'object',
      properties: {}
    };
    const requires = [];
    Object.keys(model).forEach((columnName) => {
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
    });
    definition.required = requires;
    return definition;
  }

  static modelsToSwaggerDefinitions(models, blacklist = []) {
    const definitions = new Map();
    Object.keys(models).forEach((modelName) => {
      if (blacklist.includes(modelName)) {
        return true;
      }
      const definition = ExSwagger.modelToSwaggerDefinition(models[modelName].attributes);
      definitions.set(modelName, definition);
      return true;
    });
    return definitions;
  }

  static async scanExceptions(path, exceptionInterface = Error) {
    const exceptions = {};
    const files = await ExSwagger.scanFiles(path);
    if (files.length < 1) {
      return exceptions;
    }
    for (const file of files) {
      const exceptionsInFile = require(file); //eslint-disable-line global-require
      Object.keys(exceptionsInFile).forEach((exceptionName) => {
        const exceptionClass = exceptionsInFile[exceptionName];
        const exception = new exceptionClass(exceptionName); //eslint-disable-line new-cap
        if (exception instanceof exceptionInterface) {
          exceptions[exceptionName] = exception;
        }
      });
    }
    return exceptions;
  }

  static exceptionToSwaggerDefinition(exception) {
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

  async exportJson(dist = this.swaggerDocsPath) {
    this.logger.debug('Start export by meta', this.getStates());
    const fileGroups = await Promise.all(
      this.sourceFilesPath.map(path => ExSwagger.scanFiles(path))
    );
    let files = [];
    fileGroups.forEach((fileGroup) => {
      files = files.concat(fileGroup);
    });
    if (!files || files.length < 1) {
      throw new RuntimeException('No swagger source files found');
    }
    this.logger.debug('Scanner found %s files:', files.length, files);
    const annotations = await ExSwagger.filesToAnnotations(files);
    const fragments = ExSwagger.annotationsToFragments(annotations);
    this.logger.debug('Get %s swaggger fragments', fragments.length);
    const template = this.swaggerDocsTemplate;
    this.logger.debug('Swagger template', template);
    const exceptions = {};
    for (const exceptionPath of this.exceptionPaths) {
      this.logger.debug('Search exception in %s', exceptionPath);
      const exceptionsInFile = await ExSwagger.scanExceptions(
        exceptionPath, this.exceptionInterface
      );
      Object.assign(exceptions, exceptionsInFile);
      this.logger.debug('Scanner found %s exceptions',
        Object.keys(exceptions).length, Object.keys(exceptions));
    }
    const modelDefinitions = this.models ?
      ExSwagger.modelsToSwaggerDefinitions(this.models, this.modelBlacklist) : new Map();
    const swaggerDocs = ExSwagger.mergeAll(template, fragments, exceptions, modelDefinitions);
    this.logger.debug('Export to', dist);
    return await fs.writeFileAsync(dist, JSON.stringify(swaggerDocs));
  }

  static mergeAll(_template, fragments, exceptions, modelDefinitions) {
    const template = _template;
    let path = null;
    let method = null;
    let key = '';
    const fragmentHandler = (fragment) => {
      if (fragment.type === TYPE_PATH) {
        path = Object.keys(fragment.value)[0];
        method = Object.keys(fragment.value[path])[0];
        if (!template.paths[path]) {
          template.paths[path] = {};
        }
        template.paths[path][method] = fragment.value[path][method];
        return true;
      }

      if (fragment.type === TYPE_DEFINITION) {
        key = Object.keys(fragment.value)[0];
        template.definitions[key] = fragment.value[key];
        return true;
      }

      if (fragment.type === TYPE_UNKNOWN) {
        return true;
      }

      //fragment.type === TYPE_EXCEPTION
      //目前throw一定要定义在path下面
      key = fragment.value;
      const exception = exceptions[key];
      if (!exception) {
        return true;
      }
      template.definitions[key] = ExSwagger.exceptionToSwaggerDefinition(exception);
      if (!(path && method)) {
        return true;
      }
      template.paths[path][method].responses[exception.getStatusCode()] = {
        description: fragment.description,
        schema: {
          $ref: `#/definitions/${key}`
        }
      };
      return true;
    };
    for (const fragmentGroup of fragments) {
      fragmentGroup.forEach(fragmentHandler);
    }

    if (modelDefinitions) {
      modelDefinitions.forEach((definition, modelName) => {
        template.definitions[modelName] = definition;
      });
    }
    return template;
  }

  static getYamlErrors() {
    return yamlErrors;
  }

  getStates() {
    return {
      swaggerTemplate: this.swaggerDocsTemplate,
      modelBlacklist: this.modelBlacklist,
      sourceFilesPath: this.sourceFilesPath,
      exceptionPaths: this.exceptionPaths,
      compileDistPath: this.compileDistPath,
      swaggerUIPath: this.swaggerUIPath,
      swaggerDocsPath: this.swaggerDocsPath
    };
  }

  getSwaggerUIPath() {
    return this.swaggerUIPath;
  }

  async getSwaggerIndexHtml() {
    const uiPath = this.getSwaggerUIPath();
    const content = await fs.readFileAsync(`${uiPath}/index.html`);
    return content.toString().replace('http://petstore.swagger.io/v2/swagger.json',
      this.swaggerDocsPath.replace(this.compileDistPath, ''));
  }

  getCompileDistPath() {
    return this.compileDistPath;
  }

  constructor({
    sourceRootPath,
    compileDistPath,
    models,
    modelBlacklist = [],
    swaggerDocsTemplate,
    logger,
    swaggerUIPath,
    swaggerDocsPath = `${compileDistPath}/docs.json`,
    sourceFilesPath = `${sourceRootPath}/**/*.js`,
    exceptionInterface = StandardException,
    exceptionPaths
  }) {
    this.logger = logger ||
      {
        debug: () => {
        }
      };

    if (!swaggerDocsTemplate) {
      throw new RuntimeException('No swagger docs template input');
    }
    this.swaggerDocsTemplate = swaggerDocsTemplate;
    if (models && !(models instanceof Entitles)) {
      throw new RuntimeException('Input models must instance of engine.Entities');
    }
    this.models = models ? models.getAll() : null;
    this.modelBlacklist = modelBlacklist;

    const extraSourcePaths = [`${__dirname}/../utils/**/*.js`];
    this.sourceFilesPath = Array.isArray(sourceFilesPath)
      ? extraSourcePaths.concat(sourceFilesPath) :
      extraSourcePaths.concat([sourceFilesPath]);
    this.exceptionPaths = exceptionPaths ?
      [`${__dirname}/../exceptions`].concat(exceptionPaths) : [`${__dirname}/../exceptions`];
    this.exceptionInterface = exceptionInterface;
    this.compileDistPath = compileDistPath;
    if (swaggerUIPath) {
      this.swaggerUIPath = swaggerUIPath;
    } else {
      const [nodeVersion] = process.version.slice(1, 2);
      this.swaggerUIPath = nodeVersion <= 4 ?
        `${__dirname}/../../node_modules/swagger-ui/dist` :
        `${__dirname}/../../../swagger-ui/dist`; //for npm3
    }
    this.swaggerDocsPath = swaggerDocsPath;
  }
}
