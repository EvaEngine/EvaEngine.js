import HttpClient from './http_client';
import { Dependencies } from 'constitute';
import { RestServiceLogicException, RestServiceIOException } from '../exceptions';

@Dependencies(HttpClient) //eslint-disable-line new-cap
export default class RestClient {
  /**
   * @param {HttpClient} request
   */
  constructor(request) {
    this.client = request.getInstance();
    this.baseUrl = '';
  }

  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
    this.client = this.client.defaults({ baseUrl });
  }

  getBaseUri() {
    return this.baseUrl;
  }

  rawRequest(...args) {
    return this.client(...args);
  }

  async request(...args) {
    try {
      return await this.client(...args);
    } catch (e) {
      const { statusCode } = e;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new RestServiceLogicException(e);
      }
      const { code } = e.error;
      switch (code) {
        default:
          throw new RestServiceIOException(e);
      }
    }
  }
}
