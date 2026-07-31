import Ioredis from 'ioredis';
import { Dependencies } from 'constitute';
import Config from './config.js';
import ServiceInterface from './interface.js';

@Dependencies(Config) //eslint-disable-line new-cap
export default class Redis extends ServiceInterface {
  /**
   * @param config Config
   */
  constructor(config) {
    super();
    this.config = config;
    this.options = null;
    this.client = null;
  }

  getProto() {
    return Ioredis;
  }

  getRedis() {
    return Ioredis;
  }

  setOptions(options) {
    this.options = options;
    return this;
  }

  isConnected() {
    return this.client !== null;
  }

  cleanup() {
    return this.getInstance().end();
  }

  /**
   * @returns {Ioredis}
   */
  getInstance() {
    if (this.client) {
      return this.client;
    }
    this.client = new Ioredis(Object.assign({
      enableOfflineQueue: true //make redis connect failings throw error
    }, this.options || this.config.get('redis')));
    this.client.on('error', () => {});
    return this.client;
  }
}

