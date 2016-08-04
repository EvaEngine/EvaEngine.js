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
    this.baseUrl = null;
  }

  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
    return this;
  }

  getBaseUrl() {
    return this.baseUrl;
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
      Object.assign(params, { headers: {} });
    }
    Object.assign(params.headers, {
      'X-B3-TraceId': traceId,
      'X-B3-SpanId': spanId
    });
    return params;
  }

  rawRequest(params) {
    if (this.baseUrl) {
      Object.assign(params, { url: this.baseUrl + (params.url || params.uri) });
    }
    return this.client.getInstance()(this.populateTrace(params));
  }

  async request(params) {
    if (this.baseUrl) {
      Object.assign(params, { url: this.baseUrl + (params.url || params.uri) });
    }
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
