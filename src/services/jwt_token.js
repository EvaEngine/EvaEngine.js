import Config from './config';
import Redis from './redis';
import { Dependencies } from 'constitute';
import jwt from 'jwt-simple';

@Dependencies(Config, Redis) //eslint-disable-line new-cap
export default class JsonWebToken {
  constructor(config, redis) {
    this.redis = redis.getInstance();
    this.config = config.get().token;
  }

  getRedis() {
    return this.redis;
  }

  getPrefix() {
    return this.config.prefix;
  }

  async save(uid, item) {
    const tokenString = JsonWebToken.encode(item);
    //TODO jwToken是否严格可以用.分割
    const key = [JsonWebToken.getPrefix(), uid, tokenString.split('.').pop()].join(':');
    //TODO 过期时间
    await this.getRedis().setAsync(key, JSON.stringify(item));
    return tokenString;
  }

  async find(tokenString) {
    if (!tokenString) {
      return { uid: null, expiredAt: 0 };
    }
    const parsedToken = JsonWebToken.decode(tokenString);
    if (!parsedToken || !parsedToken.hasOwnProperty('uid')) {
      return { uid: null, expiredAt: 0 };
    }
    const key = [JsonWebToken.getPrefix(), parsedToken.uid, tokenString.split('.').pop()].join(':');
    const storedToken = await this.redis.getAsync(key);
    if (!storedToken) {
      return {
        uid: parsedToken.uid,
        expiredAt: 0
      };
    }
    return JSON.parse(storedToken);
  }

  async clear(tokenString) {
    if (!tokenString) {
      return true;
    }
    const key = JsonWebToken.getRedisKey(tokenString);
    if (!key) {
      return true;
    }
    return await this.redis.delAsync(key);
  }

  static getRedisKey(tokenString, groupOnly = false) {
    const parsedToken = JsonWebToken.decode(tokenString);
    if (!parsedToken || !parsedToken.hasOwnProperty('uid')) {
      return '';
    }
    return groupOnly === true ?
      [JsonWebToken.getPrefix(), parsedToken.uid].join(':') :
      [JsonWebToken.getPrefix(), parsedToken.uid, tokenString.split('.').pop()].join(':');
  }

  encode(item, secret = this.config.secret) {
    return jwt.encode(item, secret);
  }

  decode(str, secret = this.config.secret) {
    return jwt.decode(str, secret);
  }
}
