import Ioredis from 'ioredis';
import { Dependencies } from 'constitute';
import Config from './config';
import ServiceInterface from './interface';

let redisClient = null;

@Dependencies(Config) //eslint-disable-line new-cap
export default class Redis extends ServiceInterface {
  /**
   * @param config Config
   */
  constructor(config) {
    super();
    this.config = config;
    this.options = null;
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
    return redisClient !== null;
  }

  cleanup() {
    return this.getInstance().end();
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

