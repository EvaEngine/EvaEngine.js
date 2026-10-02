/*eslint new-cap: [1]*/
import fs, { type GlobOptionsWithoutFileTypes } from 'fs';
import { createRequire, stripTypeScriptTypes } from 'module';
import { format } from 'util';
import assert from 'assert';
import merge from 'lodash/merge.js';
import * as doctrine from 'doctrine';
import * as acorn from 'acorn';
import * as yaml from 'js-yaml';
import Entitles from '../entities/index.ts';
import { RuntimeException, StandardException, type ExceptionInput } from '../exceptions/index.ts';

const require = createRequire(import.meta.url);

export class AcornParsingException extends StandardException {
}

export class YamlParsingException extends StandardException {
  annotation: Partial<Annotation>;

  setAnnotation(annotation: Annotation) {
    this.annotation = annotation || {};
    return this;
  }

  getAnnotation(): Partial<Annotation> {
    return this.annotation || {};
  }

  override toString() {
    const {
      file, start, end, value
    } = this.getAnnotation();
    return format(
      'Yaml parsing error happened in %s Line[%s - %s]\n Yaml error: %s \nOriginal Yaml Text:',
      file, start, end,
      // getPrevError() 为 unknown，这里只读取其 message 字段
      this.getPrevError() ? (this.getPrevError() as { message?: string }).message : '',
      value ? value.split('\n').map((v, i) => `${(i - 1).toString().padStart(5)} ${v}`) : []
    );
  }

  constructor(exceptionOrMsg: ExceptionInput) {
    super(exceptionOrMsg);
    this.annotation = {};
  }
}


//Mapping sequelize data types to swagger data types
//Sequelize types: http://docs.sequelizejs.com/en/latest/api/datatypes/
//Swagger Data Types: http://swagger.io/specification/
export const MODEL_TO_FRAGMENT_TYPES_MAPPING: Record<string, string> = {
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

// column.defaultValue 运行时可能为任意标量，parseInt/parseFloat 依赖 JS 的隐式转字符串
const modelDefaultValueHandlers: Record<string, (v: unknown) => unknown> = {
  integer: v => parseInt(v as string, 10),
  boolean: v => Boolean(parseInt(v as string, 10)),
  number: v => parseFloat(v as string),
  default: v => v
};

const FRAGMENT_TYPE_PATH = 'path';
const FRAGMENT_TYPE_DEFINITION = 'definition';
const FRAGMENT_TYPE_EXCEPTION = 'exception';
const FRAGMENT_TYPE_UNKNOWN = 'unknown';

export class Fragment {
  getTypes(): string[] {
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

  setParentFragment(fragment: Fragment) {
    assert(fragment && fragment instanceof Fragment, 'Parent fragment must be instance of Fragment');
    this.parent = fragment;
    return this;
  }

  getParentFragment(): Fragment | null {
    return this.parent;
  }

  correctSwaggerPath(swaggerDoc: object = {}) {
    return swaggerDoc;
  }

  toSwaggerDoc(exceptions: Record<string, StandardException> = {}) {
    if (this.isPath()) {
      // path 片段的 value 形如 { '/path': { get: {...} } }
      const pathValue = this.value as Record<string, Record<string, object>>;
      const path = Object.keys(pathValue)[0];
      const method = Object.keys(pathValue[path])[0];
      return {
        paths: {
          [path]: {
            [method]: this.correctSwaggerPath(pathValue[path][method])
          }
        }
      };
    }

    if (this.isDefinition()) {
      const definitionValue = this.value as Record<string, object>;
      const key = Object.keys(definitionValue)[0];
      return {
        definitions: {
          [key]: definitionValue[key]
        }
      };
    }

    if (this.isException()) {
      if (!this.getParentFragment()) {
        return {};
      }
      const key = this.value as string;
      const exception = exceptions[key];
      if (!exception) {
        return {};
      }

      // 上方已断言 parent 存在
      const parent = this.getParentFragment() as Fragment;
      const parentValue = parent.value as Record<string, Record<string, object>>;
      const path = Object.keys(parentValue)[0];
      const method = Object.keys(parentValue[path])[0];
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

  static exceptionMapping(exception: StandardException) {
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

  static factory(jsdoc: doctrine.AnnotationTag, annotation: Annotation): Fragment {
    const { title, description, type } = jsdoc;
    if (title === 'throws') {
      return new Fragment({
        type: FRAGMENT_TYPE_EXCEPTION,
        description: description as string,
        // doctrine 的 type 字段为 unknown，这里只读取引用类型的 name；缺失时由 Fragment 构造器 assert 抛出
        value: type ? (type as { name?: string }).name : FRAGMENT_TYPE_UNKNOWN,
        file: annotation.file,
        start: annotation.start,
        end: annotation.end
      });
    }

    let elementType = FRAGMENT_TYPE_UNKNOWN;
    // yaml.load 返回 unknown；swagger 注解的 description 是一个 yaml 对象
    const value = yaml.load(description as string) as Record<string, unknown>;
    const key = Object.keys(value)[0];
    if (title === 'swagger') {
      elementType = key.startsWith('/') ? FRAGMENT_TYPE_PATH : FRAGMENT_TYPE_DEFINITION;
    }
    return new Fragment({
      type: elementType,
      description: description as string,
      value,
      file: annotation.file,
      start: annotation.start,
      end: annotation.end
    });
  }

  type: string;
  description: string;
  value: unknown;
  file: string;
  start: number;
  end: number;
  parent: Fragment | null;

  constructor({
    type, description, value, file, start, end
  }: {
    type: string;
    description: string;
    value: unknown;
    file: string;
    start: number;
    end: number;
  }) {
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
  getFragments(): Fragment[] {
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

    const fragments: Fragment[] = [];
    jsDocs.filter(jsDoc =>
      jsDoc.title
      && (jsDoc.title === 'swagger' || jsDoc.title === 'throws')
      && jsDoc.description)
      .forEach((jsDoc) => {
        try {
          fragments.push(Fragment.factory(jsDoc, this));
        } catch (e) {
          // catch 变量为 unknown；StandardException 构造器会自行校验入参类型
          this.yamlErrors.push((new YamlParsingException(e as ExceptionInput)).setAnnotation(this));
        }
      });

    fragments.forEach((fragment) => {
      if (fragment.isException()) {
        // 找不到 path 片段时由 setParentFragment 内的 assert 按原逻辑抛错
        fragment.setParentFragment(fragments.filter(f => f.isPath())[0] as Fragment);
      }
    });

    this.fragments = fragments;
    return fragments;
  }

  toString() {
    return format('Annotation %s [%s - %s]: %s', this.file, this.start, this.end, this.value);
  }

  getYamlErrors(): YamlParsingException[] {
    return this.yamlErrors;
  }

  value: string;
  file: string;
  start: number;
  end: number;
  yamlErrors: YamlParsingException[];
  fragments: Fragment[] | null;

  constructor({
    type, //Block
    value, //Long string
    file, //String
    start,
    end
  }: {
    type: string;
    value: string;
    file: string;
    start: number;
    end: number;
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
  getFile(): string {
    return this.file;
  }

  hasAnnotations(): boolean {
    return this.annotations.length > 0;
  }

  getAnnotations(): Annotation[] {
    return this.annotations;
  }

  collectFragments(): Fragment[] {
    if (this.fragments.length > 0) {
      return this.fragments;
    }

    for (const annotation of this.getAnnotations()) {
      this.fragments = this.fragments.concat(annotation.getFragments());
    }

    return this.fragments;
  }

  collectYamlErrors(): YamlParsingException[] {
    let errors: YamlParsingException[] = [];
    for (const annotation of this.getAnnotations()) {
      errors = errors.concat(annotation.getYamlErrors());
    }
    return errors;
  }

  file: string;
  annotations: Annotation[];
  fragments: Fragment[];

  constructor(file: string, acornComments: acorn.Comment[]) {
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

// swagger 注解解析与导出所需的模块内类型
type SwaggerLogger = {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

// 兼容 Error 与 StandardException 及其子类作为 instanceof 判定入参
type ExceptionInterface = abstract new (...args: never[]) => object;

type ModelAttributeLike = {
  type: { key: string };
  comment?: string | null;
  defaultValue?: unknown;
  allowNull?: boolean;
};

type SwaggerModelProperty = {
  type: string;
  description?: string | null;
  default?: unknown;
};

type SwaggerModelDefinition = {
  type: string;
  properties: Record<string, SwaggerModelProperty>;
  required?: string[];
};

interface ExSwaggerOptions {
  sourceRootPath: string;
  compileDistPath: string;
  models?: Entitles | null;
  modelBlacklist?: string[];
  swaggerDocsTemplate?: Record<string, unknown>;
  logger?: SwaggerLogger | null;
  swaggerUIPath?: string;
  swaggerDocsPath?: string;
  sourceFilesPath?: string | string[];
  exceptionInterface?: ExceptionInterface;
  extraSourcePaths?: string[];
  exceptionPaths?: string[];
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
   */
  static async scanFiles(path: string, options: GlobOptionsWithoutFileTypes = {}): Promise<string[]> {
    return fs.globSync(path, options);
  }

  /**
   * Get annotations from comments
   * An annotation MUST start with double stars
   */
  static async filesToAnnotationsContainers(files: string[]): Promise<AnnotationsContainer[]> {
    const results: AnnotationsContainer[] = [];
    for (const file of files) {
      const comments: acorn.Comment[] = [];
      const source = await fs.readFileSync(file, 'utf8');
      // acorn 只支持 JS；TS 源文件先擦除类型语法（strip 模式保留注释，swagger 注解不受影响）
      const code = /\.(ts|mts|cts)$/.test(file) ? stripTypeScriptTypes(source) : source;
      try {
        acorn.parse(code, {
          ecmaVersion: 'latest',
          sourceType: 'module',
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

  static modelToSwaggerDefinition(model: Record<string, ModelAttributeLike>): SwaggerModelDefinition {
    const definition: SwaggerModelDefinition = {
      type: 'object',
      properties: {}
    };
    const requires: string[] = [];
    Object.keys(model).forEach((columnName) => {
      const column = model[columnName];
      const swaggerType = MODEL_TO_FRAGMENT_TYPES_MAPPING[column.type.key];
      const property: SwaggerModelProperty = {
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

  static modelsToSwaggerDefinitions(models: Record<string, unknown>, blacklist: string[] = []): Map<string, SwaggerModelDefinition> {
    const definitions = new Map<string, SwaggerModelDefinition>();
    Object.keys(models).forEach((modelName) => {
      if (blacklist.includes(modelName)) {
        return true;
      }
      const model = models[modelName] as {
        attributes?: Record<string, ModelAttributeLike>;
        rawAttributes?: Record<string, ModelAttributeLike>;
      };
      // attributes 与 rawAttributes 均缺失时保持原行为：由 modelToSwaggerDefinition 的 Object.keys 抛出 TypeError
      const attributes = (model.attributes || model.rawAttributes) as Record<string, ModelAttributeLike>;
      const definition = ExSwagger.modelToSwaggerDefinition(attributes);
      definitions.set(modelName, definition);
      return true;
    });
    return definitions;
  }

  static async scanExceptions(path: string, exceptionInterface: ExceptionInterface = Error): Promise<Record<string, StandardException>> {
    const exceptions: Record<string, StandardException> = {};
    const files = await ExSwagger.scanFiles(path);
    if (files.length < 1) {
      return exceptions;
    }
    for (const file of files) {
      // require(esm) 与 import 共享模块实例，类身份一致；导出内容按 unknown 处理后窄化
      const exceptionsInFile = require(file) as Record<string, unknown>;
      Object.keys(exceptionsInFile).forEach((exceptionName) => {
        const exceptionClass = exceptionsInFile[exceptionName] as new (exceptionName?: string) => StandardException;
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
    const fileGroups = await Promise
      .all(this.sourceFilesPath.map(path => ExSwagger.scanFiles(path)));
    let files: string[] = [];
    fileGroups.forEach((fileGroup) => {
      files = files.concat(fileGroup);
    });
    // 声明文件是构建产物，不是注解来源（发布态 glob 同时命中 .js 与 .d.ts）
    files = files.filter((file) => !file.endsWith('.d.ts'));
    if (!files || files.length < 1) {
      throw new RuntimeException('No swagger source files found');
    }
    this.logger.debug('Scanner will scan %s files under %j:', files.length, this.sourceFilesPath);

    const annotationsContainers = await ExSwagger.filesToAnnotationsContainers(files);
    let fragments: Fragment[] = [];
    annotationsContainers.forEach((annotationsContainer) => {
      if (!annotationsContainer.hasAnnotations()) {
        return false;
      }
      const annotationFragments = annotationsContainer.collectFragments();
      fragments = fragments.concat(annotationFragments);
      this.logger.debug(
        'Scanner found %s annotations and collected %s fragments in file %s',
        annotationsContainer.getAnnotations().length.toString().padStart(3),
        annotationFragments.length.toString().padStart(3),
        annotationsContainer.getFile()
      );

      const yamlErrors = annotationsContainer.collectYamlErrors();
      yamlErrors.forEach(yamlError => this.logger.error(yamlError));
      return true;
    });

    this.logger.debug('Scanner collected %s fragments in total', fragments.length);

    const template = this.swaggerDocsTemplate;
    const exceptions: Record<string, StandardException> = {};
    for (const exceptionPath of this.exceptionPaths) {
      this.logger.debug('Search exception in %s', exceptionPath);
      const exceptionsInFile = await ExSwagger.scanExceptions(
        exceptionPath,
        this.exceptionInterface
      );
      Object.assign(exceptions, exceptionsInFile);
      this.logger.debug(
        'Scanner found %s exceptions: %j',
        Object.keys(exceptions).length,
        Object.keys(exceptions)
      );
    }
    const modelDefinitions = this.models ?
      ExSwagger.modelsToSwaggerDefinitions(this.models, this.modelBlacklist) : new Map<string, object>();
    const swaggerDocs = ExSwagger.mergeAll(template, fragments, exceptions, modelDefinitions);
    this.logger.debug('Export to %s', dist);
    await fs.writeFileSync(dist, JSON.stringify(swaggerDocs));
    return swaggerDocs;
  }

  static mergeAll(_template: Record<string, unknown>, fragments: Fragment[], exceptions: Record<string, StandardException>, modelDefinitions: Map<string, object>): Record<string, unknown> {
    const template = _template;
    fragments.forEach(fragment => merge(template, fragment.toSwaggerDoc(exceptions)));
    if (modelDefinitions) {
      modelDefinitions.forEach((definition, modelName) => {
        // definitions 由片段 merge 进模板后存在；类型上对模板内部结构做局部收窄
        (template.definitions as Record<string, object>)[modelName] = definition;
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

  getSwaggerUIPath(): string {
    return this.swaggerUIPath;
  }

  async getSwaggerIndexHtml() {
    const uiPath = this.getSwaggerUIPath();
    const content = await fs.readFileSync(`${uiPath}/index.html`);
    return content.toString().replace(
      'https://petstore.swagger.io/v2/swagger/index.json',
      this.swaggerDocsPath.replace(this.compileDistPath, '')
    );
  }

  getCompileDistPath(): string {
    return this.compileDistPath;
  }

  logger: SwaggerLogger;
  swaggerDocsTemplate: Record<string, unknown>;
  models: Record<string, unknown> | null;
  modelBlacklist: string[];
  sourceFilesPath: string[];
  exceptionPaths: string[];
  exceptionInterface: ExceptionInterface;
  compileDistPath: string;
  swaggerUIPath: string;
  swaggerDocsPath: string;

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
    // 注解扫描在解析前对 TS 文件做类型擦除；{js,ts} 同时命中源码态（src/utils/**/*.ts）与发布态（dist/utils/**/*.js）
    extraSourcePaths = [
      `${import.meta.dirname}/../utils/**/*.{js,ts}`
    ],
    exceptionPaths
  }: ExSwaggerOptions) {
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
    // 原默认值指向 exceptions 目录并依赖 require 的目录解析；TS 源码态文件是 index.ts，须显式指到文件
    this.exceptionPaths = exceptionPaths ?
      [`${import.meta.dirname}/../exceptions/index.{js,ts}`].concat(exceptionPaths) : [`${import.meta.dirname}/../exceptions/index.{js,ts}`];
    this.exceptionInterface = exceptionInterface;
    this.compileDistPath = compileDistPath;
    if (swaggerUIPath) {
      this.swaggerUIPath = swaggerUIPath;
    } else {
      this.swaggerUIPath = `${import.meta.dirname}/../../node_modules/swagger-ui-dist`;
      try {
        fs.accessSync(this.swaggerUIPath, fs.constants.F_OK);
      } catch {
        this.swaggerUIPath = `${import.meta.dirname}/../../../swagger-ui-dist`; //For NPM v3.x
      }
    }
    this.swaggerDocsPath = swaggerDocsPath;
  }
}
