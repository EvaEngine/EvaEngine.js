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
            traceId, spanId, sampled
          } = this.ns.get('tracer') || {};
    if (!traceId || !spanId) {
      return params;
    }

    if (!params.headers) {
      Object.assign(params, { headers: {} });
    }
    Object.assign(params.headers, {
      'X-B3-TraceId': traceId,
      'X-B3-SpanId': spanId,
      'X-B3-Sampled': sampled
    });
    return params;
  }

  saveToTracer(headers) {
    if (!headers || Object.keys(headers).length < 1) {
      return;
    }

    const tracer = this.ns.get('tracer');
    if (!tracer) {
      return;
    }
    Object.entries(headers).forEach(([key, value]) => {
      if (key.startsWith('x-debug-')) {
        tracer.debug[key] = value;
      }
    });
  }

  rawRequest(params) {
    if (this.baseUrl) {
      Object.assign(params, { url: this.baseUrl + (params.url || params.uri) });
      if (params.uri) {
        delete params.uri; //eslint-disable-line no-param-reassign
      }
    }
    return this.client.getInstance()(this.populateTrace(params));
  }

  async request(params) {
    if (this.baseUrl) {
      Object.assign(params, {
        url: this.baseUrl + (params.url || params.uri),
        resolveWithFullResponse: true
      });
      if (params.uri) {
        delete params.uri; //eslint-disable-line no-param-reassign
      }
    }
    try {
      const { headers, body } = await this.client.getInstance()(this.populateTrace(params));
      this.saveToTracer(headers);
      return body;
    } catch (e) {
      //FIXME TypeError无法被记录?
      const { statusCode } = e;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new RestServiceLogicException(e);
      }
      throw new RestServiceIOException(e);
    }
  }
}
