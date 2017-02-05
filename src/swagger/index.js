/*eslint new-cap: [1]*/
import fs from 'fs';
import { format } from 'util';
import assert from 'assert';
import merge from 'lodash/merge';
import doctrine from 'doctrine';
import * as acorn from 'acorn/dist/acorn';
import glob from 'glob';
import yaml from 'js-yaml';
import SwaggerParser from 'swagger-parser';
import Entitles from '../entities';
import { RuntimeException, StandardException } from '../exceptions';

export class AcornParsingException extends StandardException {
}
export class YamlParsingException extends StandardException {
  /**
   * @param {Annotation} annotation
   * @returns {YamlParsingException}
   */
  setAnnotation(annotation) {
    this.annotation = annotation;
    return this;
  }

  /**
   * @returns {Annotation}
   */
  getAnnotation() {
    return this.annotation;
  }

  toString() {
    return format('Yaml parsing error happened in %s Line[%s - %s]\n Yaml error: %s \nOriginal Yaml Text:',
      this.annotation.file, this.annotation.start, this.annotation.end,
      this.getPrevError().message,
      this.annotation.value.split('\n').map((v, i) => `${(i - 1).toString().padStart(5)} ${v}`));
  }

  constructor(...args) {
    super(...args);
    this.annotation = {};
  }
}


//Mapping sequelize data types to swagger data types
//Sequelize types: http://docs.sequelizejs.com/en/latest/api/datatypes/
//Swagger Data Types: http://swagger.io/specification/
export const MODEL_TO_FRAGMENT_TYPES_MAPPING = {
  BIGINT: 'integer',
  ENUM: 'string',
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

const FRAGMENT_TYPE_PATH = 'path';
const FRAGMENT_TYPE_DEFINITION = 'definition';
const FRAGMENT_TYPE_EXCEPTION = 'exception';
const FRAGMENT_TYPE_UNKNOWN = 'unknown';
export class Fragment {
  /**
   * @returns {[*,*,*,*]}
   */
  getTypes() {
    return [FRAGMENT_TYPE_PATH, FRAGMENT_TYPE_DEFINITION,
      FRAGMENT_TYPE_EXCEPTION, FRAGMENT_TYPE_UNKNOWN];
  }

  isPath() {
    return this.type === FRAGMENT_TYPE_PATH;
  }

  isDefinition() {
    return this.type === FRAGMENT_TYPE_DEFINITION;
  }

  isUnknown() {
    return this.type === FRAGMENT_TYPE_UNKNOWN;
  }

  isException() {
    return this.type === FRAGMENT_TYPE_EXCEPTION;
  }

  /**
   * @param {Fragment} fragment
   * @returns {Fragment}
   */
  setParentFragment(fragment) {
    assert(fragment && fragment instanceof Fragment, 'Parent fragment must be instance of Fragment');
    this.parent = fragment;
    return this;
  }

  /**
   * @returns {null|Fragment}
   */
  getParentFragment() {
    return this.parent;
  }

  correctSwaggerPath(swaggerDoc = {}) {
    return swaggerDoc;
  }

  toSwaggerDoc(exceptions = {}) {
    if (this.isPath()) {
      const path = Object.keys(this.value)[0];
      const method = Object.keys(this.value[path])[0];
      return {
        paths: {
          [path]: {
            [method]: this.correctSwaggerPath(this.value[path][method])
          }
        }
      };
    }

    if (this.isDefinition()) {
      const key = Object.keys(this.value)[0];
      return {
        definitions: {
          [key]: this.value[key]
        }
      };
    }

    if (!this.isUnknown()) {
      return {};
    }

    if (this.isException()) {
      if (!this.getParentFragment()) {
        return {};
      }
      const key = this.value;
      const exception = exceptions[key];
      if (!exception) {
        return {};
      }

      const path = Object.keys(this.getParentFragment().value)[0];
      const method = Object.keys(this.getParentFragment().value[path])[0];
      return {
        definitions: {
          [key]: Fragment.exceptionMapping(exception)
        },
        paths: {
          [path]: {
            [method]: {
              responses: {
                [exception.getStatusCode()]: {
                  description: this.description,
                  schema: {
                    $ref: `#/definitions/${key}`
                  }
                }
              }
            }
          }
        }
      };
    }

    return {};
  }

  static exceptionMapping(exception) {
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

  /**
   * @param jsdoc
   * @param {Annotation} annotation
   * @returns {Fragment}
   */
  static factory(jsdoc, annotation) {
    const { title, description, type } = jsdoc;
    if (title === 'throws') {
      return new Fragment({
        type: FRAGMENT_TYPE_EXCEPTION,
        description,
        value: type ? type.name : FRAGMENT_TYPE_UNKNOWN,
        file: annotation.file,
        start: annotation.start,
        end: annotation.end
      });
    }

    let elementType = FRAGMENT_TYPE_UNKNOWN;
    const value = yaml.load(description);
    const key = Object.keys(value)[0];
    if (title === 'swagger') {
      elementType = key.startsWith('/') ? FRAGMENT_TYPE_PATH : FRAGMENT_TYPE_DEFINITION;
    }
    return new Fragment({
      type: elementType,
      description,
      value,
      file: annotation.file,
      start: annotation.start,
      end: annotation.end
    });
  }

  constructor({ type, description, value, file, start, end }) {
    assert(type && description && value && file && start && end, 'Fragment require type && description && value && file && start && end');
    assert(this.getTypes().includes(type), 'Fragment types not match input');
    this.type = type;
    this.description = description;
    this.value = value;
    this.file = file;
    this.start = start;
    this.end = end;
    this.parent = null;
  }
}

export class Annotation {
  /**
   * @returns {Array<Fragment>}
   */
  getFragments() {
    if (this.fragments) {
      return this.fragments;
    }
    //支持两种注解:
    //1. 所有行首必定为 space*
    //2. 所有行首必定不为 space*
    const unwrap = this.value.startsWith('*\n *');
    const { tags: jsDocs = [] } = doctrine.parse(this.value, { unwrap });
    if (jsDocs.length < 1) {
      return [];
    }

    /**
     * @type {Array<Fragment>}
     */
    const fragments = [];
    jsDocs.filter(jsDoc =>
      jsDoc.title
      && (jsDoc.title === 'swagger' || jsDoc.title === 'throws')
      && jsDoc.description
    ).forEach((jsDoc) => {
      try {
        fragments.push(Fragment.factory(jsDoc, this));
      } catch (e) {
        this.yamlErrors.push((new YamlParsingException(e)).setAnnotation(this));
      }
    });

    fragments.forEach((fragment) => {
      if (fragment.isException()) {
        fragment.setParentFragment(fragments.filter(f => f.isPath())[0]);
      }
    });

    this.fragments = fragments;
    return fragments;
  }

  toString() {
    return format('Annotation %s [%s - %s]: %s', this.file, this.start, this.end, this.value);
  }

  getYamlErrors() {
    return this.yamlErrors;
  }

  constructor({
    type, //Block
    value, //Long string
    file,  //String
    start,
    end
  }) {
    assert(type && type === 'Block', 'Annotation type must be Block');
    assert(value && typeof value === 'string', 'Annotation value must be Block');
    assert(file, 'Annotation must have file');
    this.value = value;
    this.file = file;
    this.start = start;
    this.end = end;
    this.yamlErrors = [];
    this.fragments = null;
  }
}

export class AnnotationsContainer {
  /**
   * @returns {string}
   */
  getFile() {
    return this.file;
  }

  /**
   * @returns {boolean}
   */
  hasAnnotations() {
    return this.annotations.length > 0;
  }

  /**
   * @returns {Array<Annotation>}
   */
  getAnnotations() {
    return this.annotations;
  }

  /**
   * @returns {Array.<Fragment>}
   */
  collectFragments() {
    if (this.fragments.length > 0) {
      return this.fragments;
    }

    for (const annotation of this.getAnnotations()) {
      this.fragments = this.fragments.concat(annotation.getFragments());
    }

    return this.fragments;
  }

  /**
   * @returns {Array}
   */
  collectYamlErrors() {
    let errors = [];
    for (const annotation of this.getAnnotations()) {
      errors = errors.concat(annotation.getYamlErrors());
    }
    return errors;
  }

  constructor(file, acornComments) {
    assert(file && typeof file === 'string', 'Annotations require a file input');
    assert(acornComments && Array.isArray(acornComments), `Annotations for ${file} require an array of Acorn comments input`);
    this.file = file;
    //Annotations MUST start with double stars
    this.annotations = acornComments
      .filter(v => v.type === 'Block' && v.value.startsWith('*\n'))
      .map(c => new Annotation(Object.assign(c, { file })));
    this.fragments = [];
  }
}

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
   * @returns {Array.<AnnotationsContainer>}
   */
  static async filesToAnnotationsContainers(files) {
    const results = [];
    for (const file of files) {
      const comments = [];
      const source = await fs.readFileSync(file);
      try {
        acorn.parse(source, {
          ecmaVersion: 8,
          allowImportExportEverywhere: true,
          onComment: comments
        });
      } catch (e) {
        throw (new AcornParsingException(`Acorn parsing file ${file} failed`)).setPrevError(e);
      }

      results.push(new AnnotationsContainer(file, comments));
    }
    return results;
  }

  static modelToSwaggerDefinition(model) {
    const definition = {
      type: 'object',
      properties: {}
    };
    const requires = [];
    Object.keys(model).forEach((columnName) => {
      const column = model[columnName];
      const swaggerType = MODEL_TO_FRAGMENT_TYPES_MAPPING[column.type.key];
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
      const exceptionsInFile = require(file); //eslint-disable-line
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


  async exportJson(dist = this.swaggerDocsPath) {
    this.logger.debug('Start export swagger docs by meta %j', this.getStates());
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
    this.logger.debug('Scanner will scan %s files under %j:', files.length, this.sourceFilesPath);

    const annotationsContainers = await ExSwagger.filesToAnnotationsContainers(files);
    let fragments = [];
    annotationsContainers.forEach((annotationsContainer) => {
      if (!annotationsContainer.hasAnnotations()) {
        return false;
      }
      const annotationFragments = annotationsContainer.collectFragments();
      fragments = fragments.concat(annotationFragments);
      this.logger.debug('Scanner found %s annotations and collected %s fragments in file %s',
        annotationsContainer.getAnnotations().length.toString().padStart(3),
        annotationFragments.length.toString().padStart(3),
        annotationsContainer.getFile());

      const yamlErrors = annotationsContainer.collectYamlErrors();
      yamlErrors.forEach(yamlError => this.logger.error(yamlError));
      return true;
    });

    this.logger.debug('Scanner collected %s fragments in total', fragments.length);

    const template = this.swaggerDocsTemplate;
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
    await fs.writeFileSync(dist, JSON.stringify(swaggerDocs));
    try {
      await SwaggerParser.validate(swaggerDocs);
    } catch (e) {
      this.logger.warn('Validated final swagger docs and found issues:');
      this.logger.warn(e);
    }
    return swaggerDocs;
  }

  /**
   * @param _template
   * @param {Array<Fragment>} fragments
   * @param exceptions
   * @param modelDefinitions
   * @returns {*}
   */
  static mergeAll(_template, fragments, exceptions, modelDefinitions) {
    const template = _template;
    fragments.forEach(fragment => merge(template, fragment.toSwaggerDoc(exceptions)));
    if (modelDefinitions) {
      modelDefinitions.forEach((definition, modelName) => {
        template.definitions[modelName] = definition;
      });
    }
    return template;
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
    const content = await fs.readFileSync(`${uiPath}/index.html`);
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
    extraSourcePaths = [`${__dirname}/../utils/**/*.js`],
    exceptionPaths
  }) {
    this.logger = logger ||
      {
        debug: () => {
        },
        warn: () => {
        },
        error: () => {
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
      this.swaggerUIPath = `${__dirname}/../../node_modules/swagger-ui/dist`;
      try {
        fs.accessSync(this.swaggerUIPath, fs.F_OK);
      } catch (e) {
        this.swaggerUIPath = `${__dirname}/../../../swagger-ui/dist`; //For NPM v3.x
      }
    }
    this.swaggerDocsPath = swaggerDocsPath;
  }
}
