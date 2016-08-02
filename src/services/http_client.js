import Config from './config';
import Logger from './logger';
import { Dependencies } from 'constitute';
import request from 'request-promise';
import requestDebugger from 'request-debug';
import { HttpRequestLogicException, HttpRequestIOException } from '../exceptions';

@Dependencies(Config, Logger) //eslint-disable-line new-cap
export default class HttpClient {
  /**
   * @param config {Config}
   * @param logger {Logger}
   */
  constructor(config, logger) {
    this.config = config.get();
    this.client = request;
    requestDebugger(this.client, (type, data) => {
      logger.debug(data);
    });
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
      const { code } = e.error;
      switch (code) {
        default:
          throw new HttpRequestIOException(e);
      }
    }
  }
}
