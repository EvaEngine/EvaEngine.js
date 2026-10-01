import constitute from 'constitute';
import HttpClient from './http_client.ts';
import Namespace from './namespace.ts';
import { RestServiceLogicException, RestServiceIOException } from '../exceptions/index.ts';
import ServiceInterface from './interface.ts';

interface RequestParams {
  url?: string;
  uri?: string;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

class RestClient extends ServiceInterface {
  client: HttpClient;
  ns: Namespace;
  baseUrl: string | null;

  constructor(client: HttpClient, ns: Namespace) {
    super();
    this.client = client;
    this.ns = ns;
    this.baseUrl = null;
  }

  setBaseUrl(baseUrl: string): this {
    this.baseUrl = baseUrl;
    return this;
  }

  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  override getProto() {
    return this.client.getProto();
  }

  getInstance() {
    return this.client.getInstance();
  }

  populateTrace(params: RequestParams): RequestParams {
    const {
      traceId, spanId, sampled
    } = (this.ns.get('tracer') || {}) as { traceId?: unknown; spanId?: unknown; sampled?: unknown };
    if (!traceId || !spanId) {
      return params;
    }

    if (!params.headers) {
      Object.assign(params, { headers: {} });
    }
    Object.assign(params.headers!, {
      'X-B3-TraceId': traceId,
      'X-B3-SpanId': spanId,
      'X-B3-Sampled': sampled
    });
    return params;
  }

  saveToTracer(headers?: Record<string, unknown>): void {
    if (!headers || Object.keys(headers).length < 1) {
      return;
    }

    const tracer = this.ns.get('tracer') as { debug: Record<string, unknown> } | undefined;
    if (!tracer) {
      return;
    }
    Object.entries(headers).forEach(([key, value]) => {
      if (key.startsWith('x-debug-')) {
        tracer.debug[key] = value;
      }
    });
  }

  rawRequest(params: RequestParams): Promise<unknown> {
    if (this.baseUrl) {
      Object.assign(params, { url: this.baseUrl + ((params.url || params.uri) as string) });
      if (params.uri) {
        delete params.uri;
      }
    }
    return this.client.getInstance()(this.populateTrace(params));
  }

  async request(params: RequestParams): Promise<unknown> {
    if (this.baseUrl) {
      Object.assign(params, {
        url: this.baseUrl + ((params.url || params.uri) as string)
      });
      if (params.uri) {
        delete params.uri;
      }
    }
    try {
      const { headers, body } = (await this.client.getInstance()(Object.assign(
        this.populateTrace(params),
        {
          json: true,
          resolveWithFullResponse: true
        }
      ))) as { headers: Record<string, unknown>; body: unknown };
      this.saveToTracer(headers);
      return body;
    } catch (e) {
      //FIXME TypeError无法被记录?
      const { statusCode } = e as { statusCode?: number };
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new RestServiceLogicException(e as Error);
      }
      throw new RestServiceIOException(e as Error);
    }
  }
}

constitute.Dependencies(HttpClient, Namespace)(RestClient);
export default RestClient;
