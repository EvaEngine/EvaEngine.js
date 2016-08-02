import Namespace from '../services/namespace';
import Config from '../services/config';
import Logger from '../services/logger';
import HttpClient from '../services/http_client';
import { Dependencies } from 'constitute';
import onHeaders from 'on-headers';
import os from 'os';


export const randomTraceId = (n = 16) => {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < n; i++) {
    const rand = Math.floor(Math.random() * 16);
    if (rand !== 0 || n.length > 0) {
      str += digits[rand];
    }
  }
  return n;
};

export const getMicroTimestamp = () => {
  const d = new Date();
  return d.getTime() * 1000;
};

export const getLocalIp = () => {
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
  return addresses.length > 0 ? addresses[0] : '127.0.0.1';
};

export const getRequestIp = req => req.headers['x-forwarded-for'] ||
req.connection.remoteAddress ||
req.socket.remoteAddress ||
req.connection.socket.remoteAddress;

export const getPort = req => {
  if (!req.headers || !req.headers.host) {
    return -1;
  }
  const [, port] = req.headers.host.split(':');
  return port || -1;
};

export const tracerToZipkin = (tracer) => {
  const {
          serviceName,
          spanId: id,
          traceId,
          parentId,
          timestamp,
          duration,
          port

        } = tracer;
  const zipkin = {
    id,
    traceId,
    name: 'Succeed-Request',
    timestamp,
    duration,
    annotations: [
      {
        endpoint: {
          serviceName,
          ipv4: getLocalIp(),
          port
        },
        timestamp,
        value: 'sr'
      },
      {
        endpoint: {
          serviceName,
          ipv4: getLocalIp(),
          port
        },
        timestamp: timestamp + duration,
        value: 'ss'
      }
    ],
    binaryAnnotations: []
  };

  if (parentId) {
    zipkin.parentId = parentId;
  }
  return [zipkin];
};


function TraceMiddleware(ns, config, logger, client) {
  return (name) => (req, res, next) => {
    const spanId = randomTraceId();
    const traceId = req.get('X-B3-TraceId') || spanId;
    const parentId = req.get('X-B3-SpanId') || '';
    const startedAt = process.hrtime();
    const timestamp = getMicroTimestamp();
    const serviceName = name || config.get('app.name');
    const tracer = {
      serviceName,
      spanId,
      traceId,
      parentId,
      timestamp,
      port: getPort(req),
      duration: null
    };
    res.set({
      'X-Requested-At': timestamp,
      'X-Service-Name': serviceName,
      'X-B3-SpanId': spanId,
      'X-B3-TraceId': traceId,
      'X-B3-ParentSpanId': parentId,
      'X-B3-Sampled': 1
    });

    onHeaders(res, () => {
      const [seconds, nanoseconds] = process.hrtime(startedAt);
      const duration = (seconds * 1e3 + nanoseconds * 1e-6) * 1000;
      tracer.duration = parseInt(duration, 10);
      res.set('X-Response-Milliseconds', tracer.duration / 1000);
    });

    res.on('finish', () => {
      if (!config.get('trace.enable')) {
        return;
      }
      const zipkin = tracerToZipkin(ns.get('tracer'));
      client.setBaseUrl(config.get('trace.zipkinApi')).request({
        url: '/spans',
        method: 'POST',
        json: zipkin
      }).catch((e) => {
        logger.error('------- Error happened on sending tracing data', e);
      });
    });

    ns.bindEmitter(req);
    ns.bindEmitter(res);
    ns.run(() => {
      ns.set('tracer', tracer);
      next();
    });
  };
}
Dependencies(Namespace, Config, Logger, HttpClient)(TraceMiddleware);  //eslint-disable-line new-cap

export default TraceMiddleware;
