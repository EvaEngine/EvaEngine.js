import HttpClient from './http_client';
import { Dependencies } from 'constitute';
import { RestServiceLogicException, RestServiceIOException } from '../exceptions';

@Dependencies(HttpClient) //eslint-disable-line new-cap
export default class RestClient {
  /**
   * @param {HttpClient} client
   */
  constructor(client) {
    this.client = client;
  }

  setBaseUrl(baseUrl) {
    this.client.setBaseUrl(baseUrl);
  }

  getBaseUrl() {
    return this.client.getBaseUrl();
  }

  getInstance() {
    return this.client.getInstance();
  }

  rawRequest(params) {
    return this.client.getInstance()(params);
  }

  async request(params) {
    try {
      return await this.client.getInstance()(params);
    } catch (e) {
      const { statusCode } = e;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new RestServiceLogicException(e);
      }
      throw new RestServiceIOException(e);
    }
  }
}
