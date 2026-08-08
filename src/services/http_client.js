import constitute from 'constitute';
import Config from './config.js';
import Logger from './logger.js';
import { createRequestClient } from '../utils/request_client.js';
import { HttpRequestLogicException, HttpRequestIOException } from '../exceptions/index.js';
import ServiceInterface from './interface.js';

class HttpClient extends ServiceInterface {
  /**
   * @param config {Config}
   * @param logger {Logger}
   */
  constructor(config, logger) {
    super();
    this.config = config.get();
    this.client = createRequestClient(logger);
  }

    getProto() {
    return this.client;
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
      if (r._json) {
        return r.body;
      }
      return r.form(r.formData).body;
    };
    const dump = {
      method: req.method,
      protocol: req.uri && req.uri.protocol === 'https:' ? 'https' : 'http',
      url: req.uri ? req.uri.href : null,
      headers: req.headers,
      body: req.req && (req._json || req.formData)
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

constitute.Dependencies(Config, Logger)(HttpClient);
export default HttpClient;
