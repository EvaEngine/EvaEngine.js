import stow from 'stow';
import Redis from './redis';
import bluebird from 'bluebird';
import RedisBackend from 'stow/backends/redis';
import { Dependencies } from 'constitute';

let instance = null;
bluebird.promisifyAll(stow.Cache.prototype);

@Dependencies(Redis) //eslint-disable-line new-cap
export default class Cache {
  constructor(redis) {
    this.redis = redis;
  }

  getInstance(options) {
    if (instance) {
      return instance;
    }

    instance = stow.createCache(RedisBackend, Object.assign({
      client: this.redis.getInstance()
    }, options));
    return instance;
  }
}
