import Config from './config.ts';
import Logger from './logger.ts';
import { createRequestClient } from '../utils/request_client.ts';
import { HttpRequestLogicException, HttpRequestIOException } from '../exceptions/index.ts';
import ServiceInterface from './interface.ts';

interface RequestParams {
  url?: string;
  uri?: string;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

interface RequestDump {
  method: string;
  uri?: { protocol: string; href: string } | null;
  headers: Record<string, unknown>;
  req?: object;
  _json?: boolean;
  formData?: Record<string, unknown> | null;
  body?: unknown;
  form?: (data: unknown) => { body: unknown };
}

interface ResponseDump {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, unknown>;
  body: unknown;
}

class HttpClient extends ServiceInterface {
  config: object;
  client: ReturnType<typeof createRequestClient>;

  static dependencies = [Config, Logger];

  constructor(config: Config, logger: Logger) {
    super();
    this.config = config.get() as object;
    this.client = createRequestClient(logger);
  }

  override getProto() {
    return this.client;
  }

  getInstance() {
    return this.client;
  }

  async request(params: RequestParams): Promise<unknown> {
    try {
      return await this.client(params);
    } catch (e) {
      const { statusCode } = e as { statusCode?: number };
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        throw new HttpRequestLogicException(e as Error);
      }
      throw new HttpRequestIOException(e as Error);
    }
  }

  dumpRequest(req: RequestDump, asString = false): object | string {
    const getBody = (r: RequestDump) => {
      if (r._json) {
        return r.body;
      }
      return r.form!(r.formData).body;
    };
    const dump = {
      method: req.method,
      protocol: req.uri && req.uri.protocol === 'https:' ? 'https' : 'http',
      url: req.uri ? req.uri.href : null,
      headers: req.headers,
      body: req.req && (req._json || req.formData)
        ? getBody(req) : null
    };
    return asString === true ? JSON.stringify(dump) : dump;
  }

  dumpResponse(res: ResponseDump, asString = false): object | string {
    const dump = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: res.headers,
      body: res.body
    };
    return asString === true ? JSON.stringify(dump) : dump;
  }
}

export default HttpClient;
