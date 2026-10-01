import constitute from 'constitute';
import jwt from 'jwt-simple';
import Config from './config.ts';
import Redis from './redis.ts';
import ServiceInterface from './interface.ts';
import type { Redis as RedisClient } from 'ioredis';

interface TokenConfig {
  prefix: string;
  secret: string;
}

class JsonWebToken extends ServiceInterface {
  redis: RedisClient;
  config: TokenConfig;

  constructor(config: Config, redis: Redis) {
    super();
    this.redis = redis.getInstance();
    this.config = config.get('token') as TokenConfig;
  }

  override getProto(): typeof jwt {
    return jwt;
  }

  getRedis(): RedisClient {
    return this.redis;
  }

  getPrefix(): string {
    return this.config.prefix;
  }

  async save(uid: string | number, item: object): Promise<string> {
    const toSaveItem = Object.assign({ uid }, item);
    const tokenString = this.encode(toSaveItem);
    const key = [this.getPrefix(), uid, tokenString.split('.').pop()].join(':');
    //TODO 过期时间
    await this.getRedis().set(key, JSON.stringify(toSaveItem));
    return tokenString;
  }

  async find(tokenString: string): Promise<unknown> {
    if (!tokenString) {
      return { uid: null, expiredAt: 0 };
    }
    const parsedToken = this.decode(tokenString) as { uid?: unknown } | null;
    if (!parsedToken || !{}.hasOwnProperty.call(parsedToken, 'uid')) {
      return { uid: null, expiredAt: 0 };
    }
    const key = [this.getPrefix(), parsedToken.uid, tokenString.split('.').pop()].join(':');
    const storedToken = await this.redis.get(key);
    if (!storedToken) {
      return {
        uid: parsedToken.uid,
        expiredAt: 0
      };
    }
    return JSON.parse(storedToken);
  }

  clear(tokenString: string): boolean | Promise<number> {
    if (!tokenString) {
      return true;
    }
    const key = this.getRedisKey(tokenString);
    if (!key) {
      return true;
    }
    return this.redis.del(key);
  }

  getRedisKey(tokenString: string, groupOnly = false): string {
    const parsedToken = this.decode(tokenString) as { uid?: unknown } | null;
    if (!parsedToken || !{}.hasOwnProperty.call(parsedToken, 'uid')) {
      return '';
    }
    return groupOnly === true ?
      [this.getPrefix(), parsedToken.uid].join(':') :
      [this.getPrefix(), parsedToken.uid, tokenString.split('.').pop()].join(':');
  }

  encode(item: object, secret: string = this.config.secret): string {
    return jwt.encode(item, secret);
  }

  decode(str: string, secret: string = this.config.secret): object {
    return jwt.decode(str, secret);
  }
}

constitute.Dependencies(Config, Redis)(JsonWebToken);
export default JsonWebToken;
