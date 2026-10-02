import constitute from 'constitute';
import { OperationUnsupportedException } from '../exceptions/index.ts';
import Redis from './redis.ts';
import DI from '../di.ts';
import Config from './config.ts';
import ServiceInterface from './interface.ts';
import type { Redis as RedisClient } from 'ioredis';

export class Store {
  getInstance(): unknown {
    return this;
  }

  // Concrete stores forward their arguments to the underlying redis client
  // while these base implementations are no-ops that accept and ignore
  // whatever is passed, as in the original JS signatures.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  has(...args: unknown[]): Promise<boolean | number> {
    return Promise.resolve(false);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get(...args: unknown[]): Promise<unknown> {
    return Promise.resolve(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  set(...args: unknown[]): Promise<unknown> {
    return Promise.resolve(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  del(...args: unknown[]): Promise<unknown> {
    return Promise.resolve(this);
  }

  flush(): Promise<unknown> {
    return Promise.resolve(true);
  }

  tags(): unknown {
    throw new OperationUnsupportedException('Not support tag feature');
  }
}

export class NullStore extends Store {
  // Accepts and ignores the prefix argument, as the implicit constructor did.
  constructor(...args: unknown[]) {
    super(...(args as []));
  }

  namespace(): this {
    return this;
  }

  override tags(): this {
    return this;
  }
}

export class RedisNamespaceStore extends Store {
  prefix: string;
  namespace: string;
  redis: RedisClient;

  constructor(prefix: string, namespace: string, redis: RedisClient) {
    super();
    this.prefix = prefix;
    this.namespace = namespace;
    this.redis = redis;
  }

  override getInstance(): RedisClient {
    return this.redis;
  }

  override has(key: string): Promise<boolean> {
    return this.redis.exists(this.key(key)).then(res => res > 0);
  }

  key(key: string): string {
    return this.prefix ? [this.prefix, this.namespace, key].join(':') : key;
  }

  override get(key: string): Promise<unknown> {
    return this.redis.get(this.key(key)).then(res => JSON.parse(res as string));
  }

  override del(key: string): Promise<number> {
    return this.redis.del(this.key(key));
  }

  override set(key: string, value: unknown, minutes?: number, mutex?: string): Promise<unknown> {
    const args: Array<string | number> = [
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
    // ioredis types SET as fixed overloads without a variadic spread form, so
    // the dynamically built argument list is asserted to keep the call shape.
    return (this.redis.set as unknown as (...callArgs: unknown[]) => Promise<unknown>)(...args);
  }

  override flush(): Promise<number> {
    return this.redis.keys([this.prefix, this.namespace, '*'].join(':'))
      .then((keys) => {
        if (keys.length) {
          return this.redis.del(keys);
        }
        return 0;
      });
  }
}

export class RedisStore extends Store {
  prefix: string;
  namespaceHandler: Record<string, RedisNamespaceStore>;
  redis: RedisClient;

  constructor(prefix: string, redis?: RedisClient | null) {
    super();
    this.prefix = prefix;
    this.namespaceHandler = {};
    this.redis = redis || DI.get('redis').getInstance();
  }

  override getInstance(): RedisClient {
    return this.redis;
  }

  namespace(namespace: string): RedisNamespaceStore {
    if ({}.hasOwnProperty.call(this.namespaceHandler, namespace)) {
      return this.namespaceHandler[namespace];
    }
    this.namespaceHandler[namespace] = new RedisNamespaceStore(this.prefix, namespace, this.redis);
    return this.namespaceHandler[namespace];
  }

  override has(key: string): Promise<number> {
    return this.redis.exists(this.key(key));
  }

  key(key: string): string {
    return this.prefix ? [this.prefix, key].join(':') : key;
  }

  override get(key: string): Promise<unknown> {
    return this.redis.get(this.key(key)).then(res => JSON.parse(res as string));
  }

  override del(key: string): Promise<number> {
    return this.redis.del(this.key(key));
  }

  override set(key: string, value: unknown, minutes?: number, mutex?: string): Promise<unknown> {
    const args: Array<string | number> = [
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
    // ioredis types SET as fixed overloads without a variadic spread form, so
    // the dynamically built argument list is asserted to keep the call shape.
    return (this.redis.set as unknown as (...callArgs: unknown[]) => Promise<unknown>)(...args);
  }

  override flush(): Promise<'OK'> {
    return this.redis.flushall();
  }
}

interface CacheConfig {
  prefix?: string;
  driver?: string;
}

class Cache extends ServiceInterface {
  config: CacheConfig;
  prefix: string;
  driver: string | undefined;
  store: Store | null;

  constructor(config: Config) {
    super();
    this.config = config.get('cache') as CacheConfig;
    this.prefix = this.config.prefix || 'eva';
    this.driver = this.config.driver;
    this.store = null;
  }

  setStore(store: Store): this {
    this.store = store;
    return this;
  }

  getStore(): Store {
    if (this.store) {
      return this.store;
    }
    this.store = this.driver === 'redis' ?
      new RedisStore(this.prefix) : new NullStore(this.prefix);
    return this.store;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  getPrefix(): string {
    return this.prefix;
  }

  namespace(...args: [namespace: string]): NullStore | RedisNamespaceStore {
    return (this.getStore() as NullStore | RedisStore).namespace(...args);
  }

  has(key: string): Promise<boolean | number> {
    return this.getStore().has(key);
  }

  get(key: string): Promise<unknown> {
    return this.getStore().get(key);
  }

  set(...args: unknown[]): Promise<unknown> {
    return this.getStore().set(...args);
  }

  del(...args: unknown[]): Promise<unknown> {
    return this.getStore().del(...args);
  }

  flush(): Promise<unknown> {
    return this.getStore().flush();
  }
}

constitute.Dependencies(Config, Redis)(Cache);
export default Cache;
