import Redis from './redis';
import { UnsupportedOperationException, RuntimeException } from './../exceptions';
import DI from './../di';
import Config from './config';
import { Dependencies } from 'constitute';

export class Store {
  has() {
    return false;
  }

  get() {
    return null;
  }

  set() {
    return true;
  }

  flush() {
    return true;
  }

  tags() {
    throw new UnsupportedOperationException('Not support tag feature');
  }
}

export class NullStore extends Store {
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

  has(key) {
    return this.redis.exists(this.key(key)).then(res => res > 0);
  }

  key(key) {
    return this.prefix ? [this.prefix, this.namespace, key].join(':') : key;
  }

  get(key) {
    return this.redis.get(this.key(key)).then(res => JSON.parse(res));
  }

  set(key, value, minutes) {
    return this.redis.set(this.key(key), JSON.stringify(value));
  }

  flush() {
    return this.redis.keys([this.prefix, this.namespace, '*'].join(':'))
      .then(keys => this.redis.del(keys));
  }
}

export class RedisStore extends Store {
  constructor(prefix) {
    super();
    this.prefix = prefix;
    this.namespaceHandler = {};
    this.redis = DI.get('redis').getInstance();
  }

  namespace(namespace) {
    if (this.namespaceHandler.hasOwnProperty(namespace)) {
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

  set(key, value, minutes) {
    return this.redis.set(this.key(key), JSON.stringify(value));
  }

  flush() {
    return this.redis.flushall();
  }
}

@Dependencies(Config, Redis) //eslint-disable-line new-cap
export default class Cache {
  constructor(config) {
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

