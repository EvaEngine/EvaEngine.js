import Namespace from '../services/namespace';
import Config from '../services/config';
import Logger from '../services/logger';
import HttpClient from '../services/http_client';
import { Dependencies } from 'constitute';
import onHeaders from 'on-headers';
import os from 'os';


export const randomTraceId = (len = 16) => {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < len; i++) {
    const rand = Math.floor(Math.random() * len);
    if (rand !== 0 || str.length > 0) {
      str += digits[rand];
    }
  }
  return str;
};

export const getMicroTimestamp = () => {
  const d = new Date();
  return d.getTime() * 1000;
};

export const getRequestFullUrl = (req) => {
  const {
          protocol,
          originalUrl
        } = req;
  const host = req.get('host');
  return `${protocol}://${host}${originalUrl}`;
};

let localIp = null;
export const getLocalIp = () => {
  if (localIp) {
    return localIp;
  }
  const ifaces = os.networkInterfaces();
  const addresses = [];

  Object.keys(ifaces).forEach((ifname) => {
    ifaces[ifname].forEach((iface) => {
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }
      addresses.push(iface.address);
    });
  });
  localIp = addresses.length > 0 ? addresses[0] : '127.0.0.1';
  return localIp;
};

// export const getRequestIp = req => req.headers['x-forwarded-for'] ||
// req.connection.remoteAddress ||
// req.socket.remoteAddress ||
// req.connection.socket.remoteAddress;

export const getPort = req => {
  if (!req.headers || !req.headers.host) {
    return -1;
  }
  const [, port] = req.headers.host.split(':');
  return port || -1;
};

export const tracerToZipkins = (tracer) => {
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
  const endpoint = {
    serviceName,
    ipv4: getLocalIp(),
    port
  };
  const zipkin = {
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
        id: randomTraceId(),
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


function TraceMiddleware(ns, config, logger, client) {
  const enabled = config.get('trace.enable');
  return (name) => (req, res, next) => {
    const spanId = randomTraceId();
    const traceId = req.get('X-B3-TraceId') || spanId;
    const parentId = req.get('X-B3-SpanId') || '';
    const startedAt = process.hrtime();
    const timestamp = getMicroTimestamp();
    const serviceName = name || config.get('app.name');
    //目前默认全部采样
    let sampled = enabled ? 1 : 0;
    //只有service为第二级, 且通过参数关闭时才禁止采样
    if (sampled && parseInt(req.get('X-B3-Sampled'), 10) < 1 && parentId > 0) {
      sampled = 0;
    }
    const tracer = {
      serviceName,
      method: req.method,
      url: getRequestFullUrl(req),
      port: getPort(req),
      spanId,
      traceId,
      parentId,
      sampled,
      timestamp,
      duration: null,
      statusCode: null,
      queries: [],
      debug: {}
    };

    res.set({
      'X-Service-Name': serviceName,
      'X-Requested-At': timestamp,
      'X-B3-SpanId': spanId,
      'X-B3-TraceId': traceId,
      'X-B3-ParentSpanId': parentId,
      'X-B3-Sampled': enabled ? 1 : 0
    });

    if (sampled < 1) {
      onHeaders(res, () => {
        const [seconds, nanoseconds] = process.hrtime(startedAt);
        const duration = (seconds * 1e3 + nanoseconds * 1e-6);
        res.set('X-Response-Milliseconds', parseInt(duration, 10));
      });
      next();
      return;
    }

    onHeaders(res, () => {
      const [seconds, nanoseconds] = process.hrtime(startedAt);
      const duration = (seconds * 1e3 + nanoseconds * 1e-6) * 1000;
      tracer.duration = parseInt(duration, 10);
      tracer.statusCode = res.statusCode;
      res.set('X-Response-Milliseconds', tracer.duration / 1000);

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
          res.set(key.replace('x-debug', 'X-Debug'), value);
        });
      }
    });

    const recordZipkin = () => {
      const api = config.get('trace.api');
      if (!api) {
        return;
      }
      logger.debug('Tracer prepare to send for request %s', spanId);
      const zipkins = tracerToZipkins(ns.get('tracer'));
      if (!zipkins) {
        logger.warn('Tracer not send by no data for request %s', spanId);
        return;
      }
      client.request({
        url: api,
        method: 'POST',
        json: zipkins
      }).catch((e) => {
        logger.error('Error happened on sending tracing data', e);
      });
    };

    res.on('finish', recordZipkin);
    res.on('error', recordZipkin);

    ns.bindEmitter(req);
    ns.bindEmitter(res);
    ns.run(() => {
      logger.debug('Tracer settled for request %s, tracer: ', spanId, tracer);
      ns.set('tracer', tracer);
      next();
    });
  };
}
Dependencies(Namespace, Config, Logger, HttpClient)(TraceMiddleware);  //eslint-disable-line new-cap

export default TraceMiddleware;
