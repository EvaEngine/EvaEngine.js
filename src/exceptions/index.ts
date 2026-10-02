import { existsSync } from 'node:fs';
import path from 'path';
import { format } from 'util';
import crc32 from '../utils/crc32.ts';
import type { ValidationError } from 'joi';

/**
 * Resolve the consumer application root the way app-root-path did: walk up
 * from the working directory to the nearest ancestor (or self) containing a
 * package.json, falling back to the working directory itself. generateCode
 * relies on it to strip the machine-specific prefix from exception file
 * paths so that error codes stay stable across environments.
 */
let appRootPath: string | null = null;

function findAppRoot(): string {
  if (appRootPath === null) {
    const cwd = path.resolve(process.cwd());
    let dir = cwd;
    for (;;) {
      if (existsSync(path.join(dir, 'package.json'))) {
        appRootPath = dir;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        appRootPath = cwd;
        break;
      }
      dir = parent;
    }
  }
  return appRootPath;
}

/**
 * Request/promise style error carrying a response, see
 * https://github.com/request/promise-core/blob/master/lib/errors.js
 */
type RequestErrorLike = Error & {
  name?: string;
  response?: { body?: unknown; request?: unknown } | null;
};

/**
 * Make Error be able to work with JSON.stringify()
 */
if (!('toJSON' in Error.prototype)) {
  Object.defineProperty(Error.prototype, 'toJSON', {
    value: function toJSON(this: Error) {
      const alt: Record<string, unknown> = {};
      Object.getOwnPropertyNames(this).forEach(function collect(this: Error, key: string) {
        alt[key] = (this as unknown as Record<string, unknown>)[key];
      }, this);
      return alt;
    },
    configurable: true,
    writable: true
  });
}


let i18nHandler: (...args: unknown[]) => string = format;

let factory: ExceptionFactory = () => undefined;

/**
 * Accepted constructor inputs for exceptions
 */
export type ExceptionInput = StandardException | Error | string | null | undefined;

/**
 * Serialized exception shape accepted by StandardException.factory()
 */
type SerializedException = {
  code?: number;
  name?: string;
  statusCode?: number;
  message?: string;
  prevError?: unknown;
  errors?: unknown;
  fullStack?: string[];
};

type ExceptionFactory = (json: Record<string, unknown>) => StandardException | Record<string, unknown> | undefined;

/**
 * Exception interface
 * Support usages:
 * throw new Exception();
 * throw new Exception('Something');
 * throw new Exception(new Error());
 * throw new Exception(new Exception());
 * throw (new Exception()).i18n('some %d', 123)
 */
export class StandardException extends Error {
  /**
   * Generate string hash by crc32
   */
  static hash(str: string, padstr = '0000000000') {
    const crcstr = crc32(str).toString();
    return padstr.substring(0, padstr.length - crcstr.length) + crcstr;
  }

  /**
   * Hash an exception into an 18 bits code
   */
  static generateCode(className: string, fileName = import.meta.filename) {
    const namespace = fileName.replace(findAppRoot(), '').split(path.sep).join('/');
    const group = fileName === import.meta.filename ? '11111' : crc32(namespace).toString().substring(0, 5);
    return parseInt(`${group}000${StandardException.hash(className)}`, 10);
  }

  /**
   * Remove useless info from error stack
   */
  static stackBeautifier(stack: string) {
    const lines = stack.split('\n');
    const stackOut = [];
    for (const line of lines) {
      if (!line.match(/node_modules|\(node\.js|\(native/)) {
        stackOut.push(line);
      }
    }
    return stackOut;
  }

  static setI18nHandler(handler: (...args: unknown[]) => string) {
    i18nHandler = handler;
  }

  /**
   * Deserialize an exception from a JSON object
   */
  static factory(json: Record<string, unknown> = {}) {
    return factory(json);
  }

  /**
   * Http status code
   */
  get statusCode(): number {
    return 500;
  }

  humanMessage: string;
  throwingError: boolean;
  details: unknown;
  prevError: unknown;
  code: number | null;
  filename: string;
  translated: boolean;
  importance: number;

  /**
   * If throw a StandardException, keep throw to above
   * If throw a Error, set Error message to exception message, set Error to details
   * If throw a String, set String to exception message
   * If throw a null or undefined, set exception name as exception message
   * Otherwise, throw a TypeError
   */
  constructor(exceptionOrMsg?: ExceptionInput) {
    const throwingNothing = !exceptionOrMsg;
    const throwingString = typeof exceptionOrMsg === 'string';
    const throwingSelf = exceptionOrMsg instanceof StandardException;
    const throwingError = exceptionOrMsg instanceof Error;
    const throwingUnknown = Number(throwingNothing) + Number(throwingString) + Number(throwingSelf) + Number(throwingError) === 0;

    if (throwingUnknown === true) {
      throw new TypeError('Unexpected params for exception');
    }

    if (throwingSelf === true) {
      throw exceptionOrMsg;
    }

    let message = 'Something wrong';
    if (throwingString === true) {
      message = exceptionOrMsg;
    }
    if (throwingError === true) {
      ({ message } = exceptionOrMsg);
    }
    super(message);

    if (throwingNothing === true) {
      message = this.constructor.name;
    }
    this.message = message;
    this.humanMessage = message;
    this.throwingError = throwingError;

    Error.captureStackTrace(this, this.constructor);
    this.details = throwingError ? exceptionOrMsg : [];
    this.prevError = {};
    this.code = null;
    this.filename = import.meta.filename;
    this.translated = false;
    this.importance = 0;
    if (throwingError === true) {
      this.setPrevError(exceptionOrMsg);
    }
  }

  i18n(...args: unknown[]) {
    this.message = format(...args);
    this.humanMessage = i18nHandler(...args);
    if (this.message !== this.humanMessage) {
      this.translated = true;
    }
    return this;
  }

  getHumanMessage() {
    if (this.translated) {
      return this.humanMessage;
    }
    let message = i18nHandler(this.message);
    if (message !== this.message) {
      this.humanMessage = message;
      this.translated = true;
      return this.humanMessage;
    }
    message = i18nHandler(this.constructor.name);
    if (message !== this.constructor.name) {
      this.humanMessage = message;
      this.translated = true;
      return this.humanMessage;
    }
    return this.message;
  }

  setMessage(message: string) {
    this.message = message;
    return this;
  }

  setCode(code: number | string) {
    this.code = parseInt(String(code), 10);
    return this;
  }

  getCode() {
    if (this.code) {
      return this.code;
    }
    this.code = StandardException.generateCode(this.constructor.name, this.filename) || -1;
    return this.code;
  }

  getStatusCode() {
    return this.statusCode;
  }

  setImportance(importance: number | string) {
    this.importance = parseInt(String(importance), 10);
    return this;
  }

  getImportance() {
    return this.importance;
  }

  setFileName(filename: string) {
    this.filename = filename;
    return this;
  }

  getFileName() {
    return this.filename;
  }

  setDetails(details: unknown) {
    this.details = details;
    return this;
  }

  getDetails(): unknown[] {
    return Array.isArray(this.details) ? this.details : [this.details];
  }

  setPrevError(prevError: unknown) {
    this.prevError = prevError;
    return this;
  }

  getPrevError(): unknown {
    return this.prevError;
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      code: this.getCode(),
      name: this.constructor.name,
      message: this.message,
      humanMessage: this.getHumanMessage(),
      filename: this.getFileName(),
      prevError: this.getPrevError(),
      errors: Array.isArray(this.getDetails()) ?
        this.getDetails() : [this.getDetails()],
      stack: StandardException.stackBeautifier(this.stack as string),
      fullStack: (this.stack as string).split('\n')
    };
  }
}

export class LogicException extends StandardException {
  override get statusCode(): number {
    return 400;
  }
}

export class InvalidArgumentException extends LogicException {
}

export class FormInvalidateException extends InvalidArgumentException {
  constructor(exceptionOrMsg?: ExceptionInput) {
    super(exceptionOrMsg);
    const joiError = exceptionOrMsg as ValidationError;
    if (this.throwingError && joiError.isJoi === true) {
      this.message = joiError.details[0].message;
      this.details = joiError.details;

      this.i18n(this.message);
      this.translated = true;
    }
  }
}

export class ModelInvalidateException extends InvalidArgumentException {
  constructor(exceptionOrMsg?: ExceptionInput) {
    super(exceptionOrMsg);
    if (this.throwingError) {
      this.details = (exceptionOrMsg as Error & { errors?: unknown }).errors;
    }
  }
}

export class HttpRequestLogicException extends InvalidArgumentException {
  response: unknown;
  request: unknown;
  requestParams: unknown;
  responseParams: unknown;
  businessCode: unknown;

  /**
   * Support request promise error
   * https://github.com/request/promise-core/blob/master/lib/errors.js
   */
  constructor(exceptionOrMsg?: ExceptionInput) {
    super(exceptionOrMsg);
    const requestError = exceptionOrMsg as RequestErrorLike;
    if (this.throwingError && ['StatusCodeError', 'RequestError', 'TransformError'].includes(requestError.name ?? '')) {
      this.details = exceptionOrMsg;
      const { response } = requestError;
      this.response = response || null;
      this.request = response ? response.request : null;
    }
    this.requestParams = null;
    this.responseParams = null;
    this.businessCode = null;
  }

  setResponse(response: unknown) {
    this.response = response || null;
    this.request = (response as RequestErrorLike['response']) ? (response as { request?: unknown }).request : null;
    return this;
  }

  getRequest() {
    if (!this.request) {
      throw new Error('No request set into exception');
    }
    return this.request;
  }

  getResponse() {
    if (!this.response) {
      throw new Error('No response set into exception');
    }
    return this.response;
  }

  setRequestParams(params: unknown) {
    this.requestParams = params;
    return this;
  }

  getRequestParams(): unknown {
    return this.requestParams;
  }

  setResponseParams(params: unknown) {
    this.responseParams = params;
    return this;
  }

  getResponseParams(): unknown {
    return this.responseParams;
  }

  setBusinessCode(code: unknown) {
    this.businessCode = code;
    return this;
  }

  getBusinessCode(): unknown {
    return this.businessCode;
  }
}

export class RestServiceLogicException extends HttpRequestLogicException {
  constructor(exceptionOrMsg?: ExceptionInput) {
    super(exceptionOrMsg);
    if (this.throwingError && this.response && (this.response as { body?: unknown }).body) {
      this.prevError = factory((this.response as { body: Record<string, unknown> }).body);
    }
  }
}

export class UnauthorizedException extends LogicException {
  override get statusCode(): number {
    return 401;
  }
}

export class OperationNotPermittedException extends LogicException {
  override get statusCode(): number {
    return 403;
  }
}

export class ResourceNotFoundException extends LogicException {
  override get statusCode(): number {
    return 404;
  }
}

export class OperationUnsupportedException extends LogicException {
  override get statusCode(): number {
    return 405;
  }
}

export class ResourceConflictedException extends LogicException {
  override get statusCode(): number {
    return 409;
  }
}

export class RuntimeException extends StandardException {
}

export class IOException extends RuntimeException {
}

export class HttpRequestIOException extends IOException {
  response: unknown;
  request: unknown;
  requestParams: unknown;
  responseParams: unknown;
  businessCode: unknown;

  constructor(exceptionOrMsg?: ExceptionInput) {
    super(exceptionOrMsg);
    const requestError = exceptionOrMsg as RequestErrorLike;
    if (this.throwingError && ['StatusCodeError', 'RequestError', 'TransformError'].includes(requestError.name ?? '')) {
      this.details = exceptionOrMsg;
      const { response } = requestError;
      this.response = response || null;
      this.request = response ? response.request : null;
    }
    this.requestParams = null;
    this.responseParams = null;
    this.businessCode = null;
  }

  getRequest(): unknown {
    return this.request;
  }

  getResponse(): unknown {
    return this.response;
  }

  setRequestParams(params: unknown) {
    this.requestParams = params;
    return this;
  }

  getRequestParams(): unknown {
    return this.requestParams;
  }

  setResponseParams(params: unknown) {
    this.responseParams = params;
    return this;
  }

  getResponseParams(): unknown {
    return this.responseParams;
  }

  setBusinessCode(code: unknown) {
    this.businessCode = code;
    return this;
  }

  getBusinessCode(): unknown {
    return this.businessCode;
  }
}

export class RestServiceIOException extends HttpRequestIOException {
  constructor(exceptionOrMsg?: ExceptionInput) {
    super(exceptionOrMsg);
    if (this.throwingError && this.response && (this.response as { body?: unknown }).body) {
      this.prevError = factory((this.response as { body: Record<string, unknown> }).body);
    }
  }
}

export class DatabaseIOException extends IOException {
}

const exceptions: Record<string, new (exceptionOrMsg?: ExceptionInput) => StandardException> = {
  StandardException,
  LogicException,
  InvalidArgumentException,
  FormInvalidateException,
  ModelInvalidateException,
  HttpRequestLogicException,
  RestServiceLogicException,
  UnauthorizedException,
  OperationUnsupportedException,
  OperationNotPermittedException,
  ResourceNotFoundException,
  ResourceConflictedException,
  RuntimeException,
  IOException,
  HttpRequestIOException,
  RestServiceIOException,
  DatabaseIOException
};

factory = (json) => {
  const {
    code, name, statusCode, message, prevError, errors, fullStack = []
  } = json as SerializedException;
  if (!code || !name || !statusCode || !message) {
    return {};
  }

  let e: StandardException;
  if (Object.keys(exceptions).includes(name)) {
    e = new exceptions[name]();
  } else if (statusCode < 500) {
    e = new LogicException(message);
  } else {
    e = new RuntimeException(message);
  }

  e.setCode(code)
    .setDetails(errors)
    .setPrevError(prevError);
  e.stack = fullStack.join('\n');
  return e;
};
