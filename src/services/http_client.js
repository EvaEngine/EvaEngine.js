import Config from './config';
import Logger from './logger';
import { Dependencies } from 'constitute';
import request from 'request-promise';
import { HttpRequestLogicException, HttpRequestIOException } from '../exceptions';

export const deepClone = (obj) =>
  JSON.parse(JSON.stringify(obj));

/* eslint-disable */
let debugId = 0;
export const requestDebug = (logger) => {
  let proto = {};
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
    throw new Error(
      "Pass the object returned by require('request') to this function.");
  }
  if (!proto._initBeforeDebug) {
    proto._initBeforeDebug = proto.init;

    proto.init = function () {
      if (!this._debugId) {
        this.on('request', function (req) {
          const data = {
            // debugId: this._debugId,
            uri: this.uri.href,
            method: this.method,
            headers: deepClone(this.headers)
          };
          if (this.body) {
            data.body = this.body.toString('utf8');
          }
          logger.verbose('REQUEST', data);
        }).on('response', function (res) {

          if (this.callback) {
            // callback specified, request will buffer the body for
            // us, so wait until the complete event to do anything
          } else {
            // cannot get body since no callback specified
            logger.verbose('RESPONSE', {
              // debugId: this._debugId,
              headers: deepClone(res.headers),
              statusCode: res.statusCode
            });
          }
        }).on('complete', function (res, body) {

          if (this.callback) {
            logger.verbose('RESPONSE', {
              // debugId: this._debugId,
              headers: deepClone(res.headers),
              statusCode: res.statusCode,
              body: res.body && res.body.length < 1500 ? res.body : '______TOO_LONG_SKIPPED______'
            });
          }
        }).on('redirect', function () {

          logger.verbose('REDIRECT', {
            // debugId: this._debugId,
            statusCode: this.response.statusCode,
            headers: deepClone(this.response.headers),
            uri: this.uri.href
          }, this);
        });
        this._debugId = ++debugId;
      }
      return proto._initBeforeDebug.apply(this, arguments);
    };
  }

  if (!request.stopDebugging) {
    request.stopDebugging = () => {
      proto.init = proto._initBeforeDebug;
      delete proto._initBeforeDebug;
    };
  }
};
/* eslint-enable */

@Dependencies(Config, Logger) //eslint-disable-line new-cap
export default class HttpClient {
  /**
   * @param config {Config}
   * @param logger {Logger}
   */
  constructor(config, logger) {
    this.config = config.get();
    this.client = request;
    requestDebug(logger);
  }

  getInstance() {
    return this.client;
  }

  setBaseUrl(baseUrl) {
    this.client = this.client.defaults({ baseUrl });
    return this;
  }

  async request(...args) {
    try {
      return await this.client(...args);
    } catch (e) {
      const { statusCode } = e;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new HttpRequestLogicException(e);
      }
      throw new HttpRequestIOException(e);
    }
  }
}
