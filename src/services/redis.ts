import Ioredis from 'ioredis';
import type { Redis as RedisClient, RedisOptions } from 'ioredis';
import DI from '../di.ts';
import Config from './config.ts';
import ServiceInterface from './interface.ts';

// ioredis ships a CJS entry whose d.ts types the default export as the module
// namespace, while the runtime value (module.exports) is the Redis class itself,
// so the constructor type is re-asserted locally without changing the import.
type RedisConstructor = typeof Ioredis.default;

class Redis extends ServiceInterface {
  config: Config;
  options: RedisOptions | null;
  client: RedisClient | null;

  static dependencies = [Config];

  constructor(config: Config) {
    super();
    this.config = config;
    this.options = null;
    this.client = null;
  }

  override getProto(): RedisConstructor {
    return Ioredis as unknown as RedisConstructor;
  }

  getRedis(): RedisConstructor {
    return Ioredis as unknown as RedisConstructor;
  }

  setOptions(options: RedisOptions): this {
    this.options = options;
    return this;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  cleanup(): void {
    return this.getInstance().end();
  }

  getInstance(): RedisClient {
    if (this.client) {
      return this.client;
    }
    this.client = new (Ioredis as unknown as RedisConstructor)(Object.assign({
      enableOfflineQueue: true //make redis connect failings throw error
    }, this.options || this.config.get('redis') as RedisOptions));
    this.client.on('error', (err) => {
      try {
        DI.get('logger').error('Redis client error:', err);
      } catch {
        //Logger not bound yet, keep the error visible on stderr
        console.error('Redis client error:', err);
      }
    });
    return this.client;
  }
}

export default Redis;
