import stow from 'stow';
import Redis from './redis';
import Config from './config';
import bluebird from 'bluebird';
import { Dependencies } from 'constitute';

bluebird.promisifyAll(stow.Cache.prototype);

@Dependencies(Redis, Config) //eslint-disable-line new-cap
export default class Cache {
  constructor(redis, config) {
    this.redis = redis.getInstance();
    this.config = config.get('cache');
    this.namespace = this.config.namespace;
  }

  setNamespace(namespace) {
    this.namespace = namespace;
  }

  getNamespace() {
    return this.namespace;
  }
}
