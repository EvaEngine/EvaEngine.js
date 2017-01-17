import morgan from 'morgan';
import os from 'os';
import { Dependencies } from 'constitute';
import Logger from '../services/logger';

/**
 Log format:
 NCSA Combined Log Format + extended fields

 Nginx config as below

 log_format upstream '$http_x_forwarded_for - $remote_user [$time_local] '
 '"$request" $status $body_bytes_sent '
 '"$http_referer" "$http_user_agent" '
 '"$remote_addr" $host $request_time $upstream_response_time $scheme $server_port '
 '$hostname $upstream_addr $http_x_device_id $sent_http_x_uid $sent_http_x_token '
 '$sent_http_x_service_name $sent_http_x_b3_spanid $sent_http_x_b3_traceid '
 '$sent_http_x_b3_parentspanid $sent_http_x_b3_sampled';
 */

morgan.token('host', req =>
  req.headers.host
);

morgan.token('real-ip', req =>
  req.headers['x-real-ip'] ||
  req.headers['x-forwarded-for'] ||
  req.ip ||
  (req.connection && req.connection.remoteAddress)
);

morgan.token('port', req =>
  (req.headers.host && req.headers.host.split(':')[1]) || -1
);

const hostname = os.hostname();
morgan.token('hostname', () => hostname);

morgan.token('tokens', (req, res) =>
  [
    res.getHeader('X-Uid') || '-',
    res.getHeader('X-Token') || '-'
  ].join(' ')
);

morgan.token('tracer', (req, res) =>
  [
    res.getHeader('X-Service-Name') || '-',
    res.getHeader('X-B3-SpanId') || '-',
    res.getHeader('X-B3-TraceId') || '-',
    res.getHeader('X-B3-ParentSpanId') || '-',
    res.getHeader('X-B3-Sampled') || '-'
  ].join(' ')
);


/**
 * @param logger {Logger}
 * @returns {function()}
 * @constructor
 */
function DebugMiddleware(logger) {
  return () =>
    morgan(
      ':real-ip - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" ' +
      '":remote-addr" :host :response-time - :http-version :port :hostname - :tokens :tracer %s', {
        stream: {
          write: (message) => {
            logger.info(message);
          }
        }
      });
}
Dependencies(Logger)(DebugMiddleware); //eslint-disable-line new-cap
export default DebugMiddleware;
