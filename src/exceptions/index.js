import appRoot from 'app-root-path';
import path from 'path';
import { format } from 'util';
import crc32 from '../utils/crc32';


/**
 * Make Error be able to work with JSON.stringify()
 */
if (!('toJSON' in Error.prototype)) {
  Object.defineProperty(Error.prototype, 'toJSON', { //eslint-disable-line
    value: function () { //eslint-disable-line
      const alt = {};
      Object.getOwnPropertyNames(this).forEach(function (key) { //eslint-disable-line
        alt[key] = this[key];
      }, this);
      return alt;
    },
    configurable: true,
    writable: true
  });
}


let i18nHandler = format;

let factory = () => {
};

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
   * @param {string} str
   * @param {string} padstr
   * @returns {string}
   */
  static hash(str, padstr = '0000000000') {
    const crcstr = crc32(str).toString();
    return padstr.substring(0, padstr.length - crcstr.length) + crcstr;
  }

  /**
   * Hash an exception into an 18 bits code
   * @param {string} className
   * @param {string} fileName
   * @returns {Number}
   */
  static generateCode(className, fileName = __filename) {
    const namespace = fileName.replace(appRoot.path, '').split(path.sep).join('/');
    const group = fileName === __filename ? '11111' : crc32(namespace).toString().substring(0, 5);
    return parseInt(`${group}000${StandardException.hash(className)}`, 10);
  }

  /**
   * Remove useless info from error stack
   * @param {string} stack
   * @returns {Array}
   */
  static stackBeautifier(stack) {
    const lines = stack.split('\n');
    const stackOut = [];
    for (const line of lines) {
      if (!line.match(/node_modules|\(node\.js|\(native/)) {
        stackOut.push(line);
      }
    }
    return stackOut;
  }

  static setI18nHandler(handler) {
    i18nHandler = handler;
  }

  /**
   * Deserialize an exception from a JSON object
   * @param {object} json
   */
  static factory(json = {}) {
    return factory(json);
  }

  /**
   * Http status code
   * @returns {number}
   */
  get statusCode() {
    return 500;
  }

  /**
   * If throw a StandardException, keep throw to above
   * If throw a Error, set Error message to exception message, set Error to details
   * If throw a String, set String to exception message
   * If throw a null or undefined, set exception name as exception message
   * Otherwise, throw a TypeError
   *
   * @param {StandardException|Error|String} exceptionOrMsg
   */
  constructor(exceptionOrMsg) {
    const throwingNothing = !exceptionOrMsg;
    const throwingString = typeof exceptionOrMsg === 'string';
    const throwingSelf = exceptionOrMsg instanceof StandardException;
    const throwingError = exceptionOrMsg instanceof Error;
    const throwingUnknown = throwingNothing + throwingString + throwingSelf + throwingError === 0;

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
      message = exceptionOrMsg.message;
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
    this.filename = __filename;
    this.translated = false;
  }

  i18n(...args) {
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

  setMessage(message) {
    this.message = message;
    return this;
  }

  setCode(code) {
    this.code = parseInt(code, 10);
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

  setFileName(filename) {
    this.filename = filename;
    return this;
  }

  getFileName() {
    return this.filename;
  }

  setDetails(details) {
    this.details = details;
    return this;
  }

  getDetails() {
    return Array.isArray(this.details) ? this.details : [this.details];
  }

  setPrevError(prevError) {
    this.prevError = prevError;
    return this;
  }

  getPrevError() {
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
      stack: StandardException.stackBeautifier(this.stack),
      fullStack: this.stack.split('\n')
    };
  }
}

export class LogicException extends StandardException {
  get statusCode() {
    return 400;
  }
}

export class InvalidArgumentException extends LogicException {
}

export class FormInvalidateException extends InvalidArgumentException {
  constructor(exceptionOrMsg) {
    super(exceptionOrMsg);
    if (this.throwingError && exceptionOrMsg.isJoi === true) {
      this.message = exceptionOrMsg.details[0].message;
      this.details = exceptionOrMsg.details;

      this.i18n(this.message);
      this.translated = true;
    }
  }
}

export class ModelInvalidateException extends InvalidArgumentException {
  constructor(exceptionOrMsg) {
    super(exceptionOrMsg);
    if (this.throwingError) {
      this.details = exceptionOrMsg.errors;
    }
  }
}

export class HttpRequestLogicException extends InvalidArgumentException {
  /**
   * Support request promise error
   * https://github.com/request/promise-core/blob/master/lib/errors.js
   * @param exceptionOrMsg
   */
  constructor(exceptionOrMsg) {
    super(exceptionOrMsg);
    if (this.throwingError && ['StatusCodeError', 'RequestError', 'TransformError'].includes(exceptionOrMsg.name)) {
      this.details = exceptionOrMsg;
      const { response } = exceptionOrMsg;
      this.response = response || null;
      this.request = response ? response.request : null;
    }
    this.requestParams = null;
    this.responseParams = null;
    this.businessCode = null;
  }

  setResponse(response) {
    this.response = response || null;
    this.request = response ? response.request : null;
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

  setRequestParams(params) {
    this.requestParams = params;
    return this;
  }

  getRequestParams() {
    return this.requestParams;
  }

  setResponseParams(params) {
    this.responseParams = params;
    return this;
  }

  getResponseParams() {
    return this.responseParams;
  }

  setBusinessCode(code) {
    this.businessCode = code;
    return this;
  }

  getBusinessCode() {
    return this.businessCode;
  }
}

export class RestServiceLogicException extends HttpRequestLogicException {
  constructor(exceptionOrMsg) {
    super(exceptionOrMsg);
    if (this.throwingError && this.response && this.response.body) {
      this.prevError = factory(this.response.body);
    }
  }
}

export class UnauthorizedException extends LogicException {
  get statusCode() {
    return 401;
  }
}

export class OperationNotPermittedException extends LogicException {
  get statusCode() {
    return 403;
  }
}

export class ResourceNotFoundException extends LogicException {
  get statusCode() {
    return 404;
  }
}

export class OperationUnsupportedException extends LogicException {
  get statusCode() {
    return 405;
  }
}

export class ResourceConflictedException extends LogicException {
  get statusCode() {
    return 409;
  }
}

export class RuntimeException extends StandardException {
}

export class IOException extends RuntimeException {
}

export class HttpRequestIOException extends IOException {
  constructor(exceptionOrMsg) {
    super(exceptionOrMsg);
    if (this.throwingError && ['StatusCodeError', 'RequestError', 'TransformError'].includes(exceptionOrMsg.name)) {
      this.details = exceptionOrMsg;
      const { response } = exceptionOrMsg;
      this.response = response || null;
      this.request = response ? response.request : null;
    }
    this.requestParams = null;
    this.responseParams = null;
    this.businessCode = null;
  }

  getRequest() {
    return this.request;
  }

  getResponse() {
    return this.response;
  }

  setRequestParams(params) {
    this.requestParams = params;
    return this;
  }

  getRequestParams() {
    return this.requestParams;
  }

  setResponseParams(params) {
    this.responseParams = params;
    return this;
  }

  getResponseParams() {
    return this.responseParams;
  }

  setBusinessCode(code) {
    this.businessCode = code;
    return this;
  }

  getBusinessCode() {
    return this.businessCode;
  }
}

export class RestServiceIOException extends HttpRequestIOException {
  constructor(exceptionOrMsg) {
    super(exceptionOrMsg);
    if (this.throwingError && this.response && this.response.body) {
      this.prevError = factory(this.response.body);
    }
  }
}

export class DatabaseIOException extends IOException {
}

const exceptions = {
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
  const { code, name, statusCode, message, prevError, errors, fullStack = [] } = json;
  if (!code || !name || !statusCode || !message) {
    return {};
  }

  let e = null;
  if (Object.keys(exceptions).includes(name)) {
    e = new exceptions[name]; //eslint-disable-line
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
