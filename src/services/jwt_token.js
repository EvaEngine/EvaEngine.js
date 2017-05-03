import { Dependencies } from 'constitute';
import jwt from 'jwt-simple';
import Config from './config';
import Redis from './redis';
import ServiceInterface from './interface';

@Dependencies(Config, Redis) //eslint-disable-line new-cap
export default class JsonWebToken extends ServiceInterface {
  /**
   * @param config {Config}
   * @param redis {Redis}
   */
  constructor(config, redis) {
    super();
    this.redis = redis.getInstance();
    this.config = config.get('token');
  }

  getProto() {
    return jwt;
  }

  getRedis() {
    return this.redis;
  }

  getPrefix() {
    return this.config.prefix;
  }

  async save(uid, item) {
    const toSaveItem = Object.assign({ uid }, item);
    const tokenString = this.encode(toSaveItem);
    const key = [this.getPrefix(), uid, tokenString.split('.').pop()].join(':');
    //TODO 过期时间
    await this.getRedis().set(key, JSON.stringify(toSaveItem));
    return tokenString;
  }

  async find(tokenString) {
    if (!tokenString) {
      return { uid: null, expiredAt: 0 };
    }
    const parsedToken = this.decode(tokenString);
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

  clear(tokenString) {
    if (!tokenString) {
      return true;
    }
    const key = this.getRedisKey(tokenString);
    if (!key) {
      return true;
    }
    return this.redis.del(key);
  }

  getRedisKey(tokenString, groupOnly = false) {
    const parsedToken = this.decode(tokenString);
    if (!parsedToken || !{}.hasOwnProperty.call(parsedToken, 'uid')) {
      return '';
    }
    return groupOnly === true ?
      [this.getPrefix(), parsedToken.uid].join(':') :
      [this.getPrefix(), parsedToken.uid, tokenString.split('.').pop()].join(':');
  }

  encode(item, secret = this.config.secret) {
    return jwt.encode(item, secret);
  }

  decode(str, secret = this.config.secret) {
    return jwt.decode(str, secret);
  }
}
