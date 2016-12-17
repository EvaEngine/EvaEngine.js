import appRoot from 'app-root-path';
import path from 'path';
import { format } from 'util';
import { IncomingMessage } from 'http';
import crc32 from '../utils/crc32';


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

  static hash(str, padstr = '0000000000') {
    const crcstr = crc32(str).toString();
    return padstr.substring(0, padstr.length - crcstr.length) + crcstr;
  }

  static generateCode(className, fileName = __dirname) {
    const namespace = fileName.replace(appRoot.path, '').split(path.sep).join('/');
    const group = crc32(namespace).toString().substring(0, 5);
    return parseInt(`${group}000${StandardException.hash(className)}`, 10);
  }

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

  get statusCode() {
    return 500;
  }

  /**
   * @param {Error|String} exceptionOrMsg
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

    Error.captureStackTrace(this, this.constructor);
    this.details = [];
    this.prevError = {};
    this.code = null;
    this.filename = __filename;
  }

  i18n(...args) {
    this.message = i18nHandler(...args);
    return this;
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
    return this.details;
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
      code: this.getCode(),
      name: this.constructor.name,
      message: this.message,
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
  constructor(...args) {
    let superArgs = args;
    let joiError = {};
    if (args.length > 0 && typeof args[0] === 'object' && args[0].isJoi === true) {
      joiError = args.shift();
      if (args.length === 0) {
        superArgs = joiError.details && joiError.details.length > 0 ? [joiError.details[0].message] : ['Form validation failed'];
      }
    }
    super(...superArgs);
    this.details = joiError.details;
  }
}

export class ModelInvalidateException extends InvalidArgumentException {
  constructor(...args) {
    let formErrors = {};
    let superArgs = args;
    if (args.length > 0 && typeof args[0] === 'object') {
      formErrors = args.shift();
      if (args.length === 0) {
        superArgs = ['Model validation failed'];
      }
    }
    super(...superArgs);
    this.details = formErrors.errors;
  }
}

export class HttpRequestLogicException extends InvalidArgumentException {
  constructor(errorOrResponse) {
    super();
    if (errorOrResponse instanceof Error && errorOrResponse.name === 'StatusCodeError') {
      this.details = errorOrResponse;
      const { response } = errorOrResponse;
      this.response = response || null;
      this.request = response ? response.request : null;
      this.prevError = errorOrResponse;
    }
    if (errorOrResponse instanceof IncomingMessage) {
      this.response = errorOrResponse || null;
      this.request = errorOrResponse ? errorOrResponse.request : null;
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

export class RestServiceLogicException extends HttpRequestLogicException {
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
  constructor(errorOrResponse) {
    super();
    if (errorOrResponse instanceof Error && errorOrResponse.name === 'StatusCodeError') {
      this.details = errorOrResponse;
      const { response } = errorOrResponse;
      this.response = response || null;
      this.request = response ? response.request : null;
      this.prevError = errorOrResponse;
    }
    if (errorOrResponse instanceof IncomingMessage) {
      this.response = errorOrResponse || null;
      this.request = errorOrResponse ? errorOrResponse.request : null;
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
}

export class RestServiceIOException extends HttpRequestIOException {
}

export class DatabaseIOException extends IOException {
}
