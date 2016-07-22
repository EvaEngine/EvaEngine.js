import redis from 'redis';
import bluebird from 'bluebird';
import Config from './config';
import { Dependencies } from 'constitute';

//Redis
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
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
    return redis;
  }

  setOptions(options) {
    this.options = options;
    return this;
  }

  getInstance() {
    if (redisClient) {
      return redisClient;
    }
    redisClient = redis.createClient(Object.assign({}, this.options || this.config.get('redis')));
    redisClient.on('error', (err) => {
      throw err;
    });
    return redisClient;
  }
}
