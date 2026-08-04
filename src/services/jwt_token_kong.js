import constitute from 'constitute';
import jwt from 'jwt-simple';
import _ from 'lodash';

import { RuntimeException } from '../exceptions/index.js';
import Config from './config.js';
import RestClient from '../services/rest_client.js';
import ServiceInterface from './interface.js';

class KongJsonWebToken extends ServiceInterface {
  /**
   * @param config {Config}
   * @param restClient {RestClient}
   */
  constructor(config, restClient) {
    super();
    this.restClient = restClient;
    this.config = config.get('token');
    if (!_.get(this.config, 'kong.endpoint')) {
      throw new RuntimeException('config item `token.kong.endpoint` can not be null');
    }
  }

    getProto() {
    return jwt;
  }

  async save(uid, item) {
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

  async find(tokenString) {
    if (!tokenString) {
      return { uid: null, expiredAt: 0 };
    }
    const parsedToken = this.decode(tokenString);
    if (!parsedToken || !{}.hasOwnProperty.call(parsedToken, 'uid')) {
      return { uid: null, expiredAt: 0 };
    }
    return parsedToken;
  }

  clear(tokenString) {
    if (!tokenString) {
      return true;
    }
    return this.restClient.request({
      url: `${this.config.kong.endpoint}/rbac/credentials/${tokenString}`,
      method: 'delete'
    });
  }

  encode(item, secret = this.config.secret) {
    return jwt.encode(item, secret);
  }

  decode(str, secret = this.config.secret) {
    return jwt.decode(str, secret);
  }
}

constitute.Dependencies(Config, RestClient)(KongJsonWebToken);
export default KongJsonWebToken;
