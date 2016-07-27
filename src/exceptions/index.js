import appRoot from 'app-root-path';
import path from 'path';
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

  constructor(...args) {
    //unique args
    const params = Array.from(new Set(args));
    const [msg, statusCode] = params;
    if (typeof msg === 'number' || (params.length === 1 && msg.startsWith(path.sep) === true)) {
      throw new TypeError('Exception message not allow pure number or a file path');
    }
    super(msg);
    let fileName = __filename;
    if (['StandardException', 'Error'].includes(this.constructor.name) === false) {
      const lastArg = args.pop();
      if (!lastArg || lastArg.includes(path.sep) === false) {
        throw new TypeError(`Exception ${this.constructor.name} require __filename input`);
      }
      fileName = lastArg;
    }
    this.code = StandardException.generateCode(this.constructor.name, fileName) || -1;
    this.statusCode = statusCode || 500;
    this.details = [];
    this.prevError = {};
  }

  getCode() {
    return this.code;
  }

  setStatusCode(statusCode) {
    this.statusCode = statusCode;
  }

  getStatusCode() {
    return this.statusCode;
  }

  getDetails() {
    return this.details;
  }

  getPrevError() {
    return this.prevError;
  }

  toJSON(env) {
    return {
      code: this.getCode(),
      name: this.constructor.name,
      message: this.message,
      prevError: this.getPrevError(),
      errors: Array.isArray(this.getDetails()) ?
        this.getDetails() : [this.getDetails()],
      stack: env.isDevelopment() ? StandardException.stackBeautifier(this.stack) : [],
      fullStack: env.isDevelopment() ? this.stack.split('\n') : []
    };
  }
}

export class LogicException extends StandardException {
  constructor(...args) {
    args.push(__filename);
    super(...args);
    this.statusCode = 400;
  }
}

export class InvalidArgumentException extends LogicException {
}

export class FormInvalidateException extends InvalidArgumentException {
  constructor(...args) {
    let formErrors = {};
    let superArgs = args;
    if (args.length > 0 && typeof args[0] === 'object') {
      formErrors = args.shift();
      if (args.length === 0) {
        superArgs = ['Form validation failed'];
      }
    }
    super(...superArgs);
    this.details = formErrors.errors;
  }
}

export class HttpRequestLogicException extends InvalidArgumentException {
  constructor(...args) {
    let remoteErrors = {};
    let superArgs = args;
    if (args.length > 0 && typeof args[0] === 'object') {
      remoteErrors = args.shift();
      if (args.length === 0) {
        superArgs = ['Remote Logic errors'];
      }
    }
    super(...superArgs);
    this.details = remoteErrors;
    const { response } = remoteErrors;
    this.response = response || null;
    this.request = response ? response.request : null;
    this.prevError = remoteErrors;
  }

  getRequest() {
    return this.request;
  }

  getResponse() {
    return this.response;
  }
}

export class RestServiceLogicException extends InvalidArgumentException {
  constructor(...args) {
    let remoteErrors = {};
    let superArgs = args;
    if (args.length > 0 && typeof args[0] === 'object') {
      remoteErrors = args.shift();
      if (args.length === 0) {
        superArgs = ['Remote Logic errors'];
      }
    }
    super(...superArgs);
    const { error, response } = remoteErrors;
    this.details = typeof error === 'object' ? error : remoteErrors;
    this.response = response || null;
    this.request = response ? response.request : null;
    this.prevError = typeof error === 'object' ? error : remoteErrors;
  }

  getRequest() {
    return this.request;
  }

  getResponse() {
    return this.response;
  }
}

export class UnauthorizedException extends LogicException {
  constructor(...args) {
    super(...args);
    this.statusCode = 401;
  }
}

export class ResourceNotFoundException extends LogicException {
  constructor(...args) {
    super(...args);
    this.statusCode = 404;
  }
}

export class ResourceConflictedException extends LogicException {
  constructor(...args) {
    super(...args);
    this.statusCode = 409;
  }
}

export class RuntimeException extends StandardException {
  constructor(...args) {
    args.push(__filename);
    super(...args);
    this.statusCode = 500;
  }
}

export class UnsupportedOperationException extends RuntimeException {
}

export class IOException extends RuntimeException {
}

export class HttpRequestIOException extends IOException {
  constructor(...args) {
    let remoteErrors = {};
    let superArgs = args;
    if (args.length > 0 && typeof args[0] === 'object') {
      remoteErrors = args.shift();
      if (args.length === 0) {
        superArgs = ['Remote IO errors'];
      }
    }
    super(...superArgs);
    this.details = remoteErrors;
    const { response } = remoteErrors;
    this.response = response || null;
    this.request = response ? response.request : null;
    this.prevError = remoteErrors;
  }

  getRequest() {
    return this.request;
  }

  getResponse() {
    return this.response;
  }
}

export class RestServiceIOException extends HttpRequestIOException {
  constructor(...args) {
    let remoteErrors = {};
    let superArgs = args;
    if (args.length > 0 && typeof args[0] === 'object') {
      remoteErrors = args.shift();
      if (args.length === 0) {
        superArgs = ['Remote IO errors'];
      }
    }
    super(...superArgs);
    const { error, response } = remoteErrors;
    this.details = typeof error === 'string' ? remoteErrors : error;
    this.response = response || null;
    this.request = response ? response.request : null;
    this.prevError = typeof error === 'string' ? remoteErrors : error;
  }

  getRequest() {
    return this.request;
  }

  getResponse() {
    return this.response;
  }
}

export class DatabaseIOException extends IOException {
}
