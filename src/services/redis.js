import Ioredis from 'ioredis';
import Config from './config';
import { Dependencies } from 'constitute';

let redisClient = null;

@Dependencies(Config) //eslint-disable-line new-cap
export default class Redis {
  /**
   * @param config Config
   */
  constructor(config) {
    this.config = config;
    this.options = null;
  }

  getRedis() {
    return Ioredis;
  }

  setOptions(options) {
    this.options = options;
    return this;
  }

  /**
   * @returns {Ioredis}
   */
  getInstance() {
    if (redisClient) {
      return redisClient;
    }
    redisClient = new Ioredis(Object.assign({
      enableOfflineQueue: true //make redis connect failings throw error
    }, this.options || this.config.get('redis')));
    redisClient.on('error', (e) => {
      throw e;
    });
    return redisClient;
  }
}

