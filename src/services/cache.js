import { Dependencies } from 'constitute';
import { UnsupportedOperationException } from './../exceptions';
import Redis from './redis';
import DI from './../di';
import Config from './config';
import ServiceInterface from './interface';

export class Store {
  getInstance() {
    return this;
  }

  has() {
    return Promise.resolve(false);
  }

  get() {
    return Promise.resolve(null);
  }

  set() {
    return Promise.resolve(this);
  }

  flush() {
    return Promise.resolve(true);
  }

  tags() {
    throw new UnsupportedOperationException('Not support tag feature');
  }
}

export class NullStore extends Store {
  namespace() {
    return this;
  }

  tags() {
    return this;
  }
}

export class RedisNamespaceStore extends Store {
  constructor(prefix, namespace, redis) {
    super();
    this.prefix = prefix;
    this.namespace = namespace;
    this.redis = redis;
  }

  getInstance() {
    return this.redis;
  }

  has(key) {
    return this.redis.exists(this.key(key)).then(res => res > 0);
  }

  key(key) {
    return this.prefix ? [this.prefix, this.namespace, key].join(':') : key;
  }

  get(key) {
    return this.redis.get(this.key(key)).then(res => JSON.parse(res));
  }

  set(key, value, minutes, mutex) {
    const args = [
      this.key(key),
      JSON.stringify(value)
    ];
    if (minutes) {
      args.push('ex', minutes * 60);
    }
    if (mutex) {
      const m = mutex.toUpperCase();
      if (m === 'NX' || m === 'XX') {
        args.push(m);
      }
    }
    return this.redis.set(...args);
  }

  flush() {
    return this.redis.keys([this.prefix, this.namespace, '*'].join(':'))
      .then(keys => this.redis.del(keys));
  }
}

export class RedisStore extends Store {
  constructor(prefix, redis) {
    super();
    this.prefix = prefix;
    this.namespaceHandler = {};
    this.redis = redis || DI.get('redis').getInstance();
  }

  getInstance() {
    return this.redis;
  }

  namespace(namespace) {
    if ({}.hasOwnProperty.call(this.namespaceHandler, namespace)) {
      return this.namespaceHandler[namespace];
    }
    this.namespaceHandler[namespace] = new RedisNamespaceStore(this.prefix, namespace, this.redis);
    return this.namespaceHandler[namespace];
  }

  has(key) {
    return this.redis.exists(this.key(key));
  }

  key(key) {
    return this.prefix ? [this.prefix, key].join(':') : key;
  }

  get(key) {
    return this.redis.get(this.key(key)).then(res => JSON.parse(res));
  }

  set(key, value, minutes, mutex) {
    const args = [
      this.key(key),
      JSON.stringify(value)
    ];
    if (minutes) {
      args.push('ex', minutes * 60);
    }
    if (mutex) {
      const m = mutex.toUpperCase();
      if (m === 'NX' || m === 'XX') {
        args.push(m);
      }
    }
    return this.redis.set(...args);
  }

  flush() {
    return this.redis.flushall();
  }
}

@Dependencies(Config, Redis) //eslint-disable-line new-cap
export default class Cache extends ServiceInterface {
  constructor(config) {
    super();
    this.config = config.get('cache');
    this.prefix = this.config.prefix || 'eva';
    this.driver = this.config.driver;
    this.store = null;
  }

  setStore(store) {
    this.store = store;
    return this;
  }

  /**
   * @returns {Store}
   */
  getStore() {
    if (this.store) {
      return this.store;
    }
    this.store = this.driver === 'redis' ?
      new RedisStore(this.prefix) : new NullStore(this.prefix);
    return this.store;
  }

  setPrefix(prefix) {
    this.prefix = prefix;
  }

  getPrefix() {
    return this.prefix;
  }

  namespace(...args) {
    return this.getStore().namespace(...args);
  }

  has(key) {
    return this.getStore().has(key);
  }

  get(key) {
    return this.getStore().get(key);
  }

  set(...args) {
    return this.getStore().set(...args);
  }

  flush() {
    return this.getStore().flush();
  }
}

