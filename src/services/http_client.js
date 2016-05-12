import Config from './config';
import Logger from './logger';
import { Dependencies } from 'constitute';
import request from 'request-promise';
import requestDebugger from 'request-debug';

@Dependencies(Config, Logger) //eslint-disable-line new-cap
export default class HttpClient {
  /**
   * @param config {Config}
   * @param logger {Logger}
   */
  constructor(config, logger) {
    this.config = config.get();
    requestDebugger(request, (type, data) => {
      logger.verbose(data);
    });
  }

  getInstance() {
    return request;
  }
}
