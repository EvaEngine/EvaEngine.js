import HttpClient from './http_client';
import Namespace from './namespace';
import { Dependencies } from 'constitute';
import { RestServiceLogicException, RestServiceIOException } from '../exceptions';

@Dependencies(HttpClient, Namespace) //eslint-disable-line new-cap
export default class RestClient {
  /**
   * @param {HttpClient} client
   * @param {Namespace} ns
   */
  constructor(client, ns) {
    this.client = client;
    this.ns = ns;
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

  populateTrace(params) {
    const {
            traceId, spanId
          } = this.ns.get('tracer');
    if (!traceId || !spanId) {
      return params;
    }

    if (!params.headers) {
      Object.assign(params.headers, {});
    }
    Object.assign(params.headers, {
      'X-B3-TraceId': traceId,
      'X-B3-SpanId': spanId
    });
    return params;
  }

  rawRequest(params) {
    return this.client.getInstance()(this.populateTrace(params));
  }

  async request(params) {
    try {
      return await this.client.getInstance()(this.populateTrace(params));
    } catch (e) {
      const { statusCode } = e;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new RestServiceLogicException(e);
      }
      throw new RestServiceIOException(e);
    }
  }
}
