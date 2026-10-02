import * as jwt from '../utils/jwt.ts';
import get from 'lodash/get.js';

import { RuntimeException } from '../exceptions/index.ts';
import Config from './config.ts';
import RestClient from '../services/rest_client.ts';
import ServiceInterface from './interface.ts';

interface KongTokenConfig {
  secret: string;
  kong: { endpoint: string };
}

class KongJsonWebToken extends ServiceInterface {
  restClient: RestClient;
  config: KongTokenConfig;

  static dependencies = [Config, RestClient];

  constructor(config: Config, restClient: RestClient) {
    super();
    this.restClient = restClient;
    this.config = config.get('token') as KongTokenConfig;
    if (!get(this.config, 'kong.endpoint')) {
      throw new RuntimeException('config item `token.kong.endpoint` can not be null');
    }
  }

  override getProto(): typeof jwt {
    return jwt;
  }

  async save(uid: string | number, item: { username?: string; expiredAt?: number }): Promise<string> {
    const toSaveItem = Object.assign({ uid }, item);
    const tokenString = this.encode(toSaveItem);
    await this.restClient.request({
      url: `${this.config.kong.endpoint}/rbac/credentials`,
      method: 'post',
      body: {
        custom_id: uid.toString(),
        username: item.username || null,
        key: tokenString,
        expired_at: item.expiredAt ? item.expiredAt * 1000 : null
      }
    });
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
    return parsedToken;
  }

  clear(tokenString: string): boolean | Promise<unknown> {
    if (!tokenString) {
      return true;
    }
    return this.restClient.request({
      url: `${this.config.kong.endpoint}/rbac/credentials/${tokenString}`,
      method: 'delete'
    });
  }

  encode(item: object, secret: string = this.config.secret): string {
    return jwt.encode(item, secret);
  }

  decode(str: string, secret: string = this.config.secret): object {
    return jwt.decode(str, secret);
  }
}

export default KongJsonWebToken;
