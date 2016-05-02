import redis from 'redis';
import bluebird from 'bluebird';
import Config from './config';
import { Dependencies } from 'constitute';


//Redis
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
let redisClient = null;

@Dependencies(Config)
export default class Redis {
  constructor(config) {
    this.config = config;
  }

  getRedis() {
    return redis;
  }

  getInstance() {
    if (redisClient) {
      return redisClient;
    }
    redisClient = redis.createClient(Object.assign({}, this.config.get().redis));
    redisClient.on('error', (err) => {
      throw err;
    });
    return redisClient;
  }
}
