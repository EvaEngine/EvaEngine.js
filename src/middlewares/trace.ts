import constitute from 'constitute';
import { randomString, getHostFullUrl, getHostPort, getHostIp, getMicroTimestamp } from '../utils/index.ts';
import Namespace from '../services/namespace.ts';
import Config from '../services/config.ts';
import Logger from '../services/logger.ts';
import HttpClient from '../services/http_client.ts';
import type { Request, Response, NextFunction } from 'express';

const hostIp = getHostIp();

/**
 * Execute a listener when a response is about to write headers.
 * Inlined from the on-headers package (MIT), limited to the behavior trace middleware needs.
 */
const onHeaders = (res: Response, listener: () => void) => {
  if (!res) {
    throw new TypeError('argument res is required');
  }
  if (typeof listener !== 'function') {
    throw new TypeError('argument listener must be a function');
  }

  //writeHead 在 ServerResponse 上是重载签名，补丁替换按可变参数收敛为 unknown，运行时仍透传全部实参
  const prevWriteHead = res.writeHead as unknown as (this: Response, ...args: unknown[]) => Response;
  let fired = false;

  res.writeHead = function writeHead(this: Response, ...args: unknown[]) {
    if (!fired) {
      fired = true;
      listener.call(this);
    }
    return prevWriteHead.apply(this, args);
  };
};

interface ZipkinEndpoint {
  serviceName: unknown;
  ipv4: string;
  port: unknown;
}

interface ZipkinAnnotation {
  endpoint: ZipkinEndpoint;
  timestamp: number;
  value: string;
}

interface ZipkinBinaryAnnotation {
  key: string;
  value: unknown;
}

interface ZipkinSpan {
  id: string;
  traceId: string;
  name: string;
  timestamp: number;
  duration: number;
  annotations: ZipkinAnnotation[];
  binaryAnnotations: ZipkinBinaryAnnotation[];
  parentId?: string;
}

interface TracerQuery {
  query: unknown;
  cost: number;
  finishedAt: number;
}

interface Tracer {
  serviceName: unknown;
  method: string;
  url: string;
  port: string | number;
  spanId: string;
  traceId: string;
  parentId: string;
  sampled: number;
  timestamp: number;
  //duration/statusCode 在响应头写出时才回填，运行时初始值为 null
  duration: number;
  statusCode: number;
  queries: TracerQuery[];
  debug: Record<string, unknown>;
}

export const tracerToZipkins = (tracer: Tracer | null | undefined): false | ZipkinSpan[] => {
  if (!tracer) {
    return false;
  }
  const {
    url,
    method,
    serviceName,
    spanId: id,
    traceId,
    parentId,
    timestamp,
    duration,
    statusCode,
    port,
    queries
  } = tracer;

  const name = `${statusCode} ${method} ${url}`;
  const endpoint: ZipkinEndpoint = {
    serviceName,
    ipv4: hostIp,
    port
  };
  const zipkin: ZipkinSpan = {
    id,
    traceId,
    name,
    timestamp,
    duration,
    annotations: [
      {
        endpoint,
        timestamp,
        value: 'sr'
      },
      {
        endpoint,
        timestamp: timestamp + duration,
        value: 'ss'
      }
    ],
    binaryAnnotations: [
      {
        key: 'traceId',
        value: traceId
      },
      {
        key: 'spanId',
        value: id
      },
      {
        key: 'method',
        value: method
      },
      {
        key: 'url',
        value: url
      },
      {
        key: 'port',
        value: port.toString()
      },
      {
        key: 'statusCode',
        value: statusCode.toString()
      }
    ]
  };

  if (parentId) {
    zipkin.parentId = parentId;
  }

  const zipkins = [zipkin];
  if (queries && queries.length > 0) {
    queries.forEach((element) => {
      const { query, cost, finishedAt } = element;
      zipkins.push({
        id: randomString(),
        parentId: id,
        traceId,
        name: 'sequelize',
        timestamp: finishedAt - cost,
        duration: cost,
        annotations: [
          {
            endpoint,
            timestamp: finishedAt - cost,
            value: 'cs'
          },
          {
            endpoint,
            timestamp: finishedAt,
            value: 'cr'
          }
        ],
        binaryAnnotations: [{
          key: 'query',
          value: query
        }]
      });
    });
  }
  return zipkins;
};


function TraceMiddleware(ns: Namespace, config: Config, logger: Logger, client: HttpClient) {
  const enabled = config.get('trace.enable');
  return (name?: string) => (req: Request, res: Response, next: NextFunction) => {
    const spanId = randomString();
    const traceId = req.get('X-B3-TraceId') || spanId;
    const parentId = req.get('X-B3-SpanId') || '';
    const startedAt = process.hrtime();
    const timestamp = getMicroTimestamp();
    const serviceName = name || config.get('app.name');
    //目前默认全部采样
    let sampled = enabled ? 1 : 0;
    //只有service为第二级, 且通过参数关闭时才禁止采样
    if (sampled && parseInt(req.get('X-B3-Sampled') as string, 10) < 1 && (parentId as unknown as number) > 0) {
      sampled = 0;
    }
    const tracer: Tracer = {
      serviceName,
      method: req.method,
      url: getHostFullUrl(req),
      port: getHostPort(req),
      spanId,
      traceId,
      parentId,
      sampled,
      timestamp,
      //初始为 null，响应头写出后由下方 onHeaders 回填，类型按回填后的形态声明
      duration: null as unknown as number,
      statusCode: null as unknown as number,
      queries: [],
      debug: {}
    };

    res.set({
      'X-Service-Name': serviceName,
      'X-Requested-At': timestamp,
      'X-B3-SpanId': spanId,
      'X-B3-TraceId': traceId,
      'X-B3-ParentSpanId': parentId,
      'X-B3-Sampled': sampled
    });

    if (sampled < 1) {
      onHeaders(res, () => {
        const [seconds, nanoseconds] = process.hrtime(startedAt);
        const duration = ((seconds * 1e3) + (nanoseconds * 1e-6));
        //express 的 set 类型仅声明 string，运行时 Node 接受数字并自动强转
        res.set('X-Response-Milliseconds', parseInt(duration as unknown as string, 10) as unknown as string);
      });
      next();
      return;
    }

    onHeaders(res, () => {
      const [seconds, nanoseconds] = process.hrtime(startedAt);
      const duration = ((seconds * 1e3) + (nanoseconds * 1e-6)) * 1000;
      tracer.duration = parseInt(duration as unknown as string, 10);
      tracer.statusCode = res.statusCode;
      res.set('X-Response-Milliseconds', (tracer.duration / 1000) as unknown as string);

      const useHeader = config.get('trace.header');
      if (!useHeader) {
        return;
      }
      const zipkins = tracerToZipkins(tracer);
      if (!zipkins) {
        logger.warn('Tracer not send by no data for request %s', spanId);
      } else {
        res.set(`X-Debug-${spanId}`, JSON.stringify(zipkins));
      }

      if (Object.keys(tracer.debug).length > 0) {
        Object.entries(tracer.debug).forEach(([key, value]) => {
          res.set(key.replace('x-debug', 'X-Debug'), value as string);
        });
      }
    });

    const recordZipkin = () => {
      const api = config.get('trace.api');
      if (!api) {
        return;
      }
      logger.debug('Tracer prepare to send for request %s', spanId);
      const zipkins = tracerToZipkins(ns.get('tracer') as Tracer | null);
      if (!zipkins) {
        logger.warn('Tracer not send by no data for request %s', spanId);
        return;
      }
      client.request({
        url: api as string,
        method: 'POST',
        json: zipkins
      }).catch((e) => {
        logger.error('Error happened on sending tracing data: %o', e);
      });
    };

    res.on('finish', recordZipkin);
    res.on('error', recordZipkin);

    ns.bindEmitter(req);
    ns.bindEmitter(res);
    ns.run(() => {
      // logger.debug('Tracer settled for request %s, tracer: %j', spanId, tracer);
      ns.set('tracer', tracer);
      next();
    });
  };
}

constitute.Dependencies(Namespace, Config, Logger, HttpClient)(TraceMiddleware);

export default TraceMiddleware;
