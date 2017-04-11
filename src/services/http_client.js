import { Dependencies } from 'constitute';
import request from 'request-promise-native';
import Config from './config';
import Logger from './logger';
import { HttpRequestLogicException, HttpRequestIOException } from '../exceptions';
import ServiceInterface from './interface';

export const deepClone = obj =>
  JSON.parse(JSON.stringify(obj));

const TOO_LONG_BODY = '____TLDR____';

let debugFlag = false;
/* eslint-disable */
//Mod version of https://github.com/request/request-debug
export const requestDebug = (logger, maxBodyLength = process.env.MAX_REQUEST_DEBUG_BODY || 3000) => {
  if (debugFlag === true) {
    return;
  }

  let proto = {};
  let debugId = 0;
  if (request.Request) {
    proto = request.Request.prototype;
  } else if (request.get && request.post) {
    // The object returned by request.defaults() doesn't include the
    // Request property, so do this horrible thing to get at it.  Per
    // Wikipedia, port 4 is unassigned.
    const req = request('http://localhost:4').on('error', () => {
    });
    proto = req.constructor.prototype;
  } else {
    throw new Error('Pass the object returned by require("request") to this function.');
  }
  if (proto._initBeforeDebug) {
    return;
  }

  proto._initBeforeDebug = proto.init;

  const ignoreDebug = (headers) => {
    if (!headers || Object.keys(headers).length < 1) {
      return {};
    }
    return Object.keys(headers)
      .filter(key => !key.startsWith('x-debug'))
      .reduce((res, key) => (res[key] = headers[key], res), {});
  };

  proto.init = function () {
    if (this._debugId) {
      return;
    }
    this.on('request', function (req) {
      const data = {
        headers: deepClone(this.headers)
      };
      if (this.body) {
        data.body = maxBodyLength > 0 && this.body.toString().length < maxBodyLength ? this.body.toString('utf8') : TOO_LONG_BODY;
      }

      logger.verbose('[HTTP_REQUEST_%s] [%s %s] [REQ_HEADERS: %s] [REQ_BODY: %s]', this._debugId,
        this.method.toUpperCase(), this.uri.href, JSON.stringify(data.headers), data.body || ''
      );
    }).on('response', function (res) {
      if (this.callback) {
        return;
      }

      const bodyLength = res.headers['content-length'] || (res.body ? res.body.toString().length : 0);
      logger.verbose('[HTTP_RESPONSE_%s] [%s %s] [%s] [RES_HEADERS: %s] [RES_BODY: %s]', this._debugId,
        this.method.toUpperCase(), this.uri.href, res.statusCode, JSON.stringify(ignoreDebug(res.headers)),
        bodyLength > maxBodyLength ? TOO_LONG_BODY : res.body || ''
      );
    }).on('complete', function (res) {
      if (!this.callback) {
        return;
      }

      const bodyLength = res.headers['content-length'] || (res.body ? res.body.toString().length : 0);
      logger.verbose('[HTTP_RESPONSE_%s] [%s %s] [%s] [RES_HEADERS: %s] [RES_BODY: %s]', this._debugId,
        this.method.toUpperCase(), this.uri.href, res.statusCode, JSON.stringify(ignoreDebug(res.headers)),
        bodyLength > maxBodyLength ? TOO_LONG_BODY : res.body || ''
      );
    }).on('redirect', function () {

      logger.verbose('[HTTP_REDIRECT_%s] [%s %s] [%s] [RES_HEADERS: %s] [RES_BODY: %s]', this._debugId,
        this.method.toUpperCase(), this.uri.href, this.response.statusCode, JSON.stringify(ignoreDebug(this.response.headers)), '');
    });
    this._debugId = ++debugId;
    return proto._initBeforeDebug.apply(this, arguments);
  };

  debugFlag = true;
};
/* eslint-enable */

@Dependencies(Config, Logger) //eslint-disable-line new-cap
export default class HttpClient extends ServiceInterface {
  /**
   * @param config {Config}
   * @param logger {Logger}
   */
  constructor(config, logger) {
    super();
    this.config = config.get();
    this.client = request;
    requestDebug(logger);
  }

  getProto() {
    return request;
  }

  getInstance() {
    return this.client;
  }

  async request(params) {
    try {
      return await this.client(params);
    } catch (e) {
      const { statusCode } = e;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new HttpRequestLogicException(e);
      }
      throw new HttpRequestIOException(e);
    }
  }

  dumpRequest(req, asString = false) {
    const getBody = (r) => {
      if (r._json) { //eslint-disable-line no-underscore-dangle
        return r.body;
      }
      return r.form(r.formData).body;
    };
    const dump = {
      method: req.method,
      protocol: req.uri && req.uri.protocol === 'https:' ? 'https' : 'http',
      url: req.uri ? req.uri.href : null,
      headers: req.headers,
      body: req.req && (req._json || req.formData) //eslint-disable-line no-underscore-dangle
        ? getBody(req) : null
    };
    return asString === true ? JSON.stringify(dump) : dump;
  }

  dumpResponse(res, asString = false) {
    const dump = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: res.headers,
      body: res.body
    };
    return asString === true ? JSON.stringify(dump) : dump;
  }
}
