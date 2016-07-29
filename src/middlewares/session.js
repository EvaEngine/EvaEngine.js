import session from 'express-session';
import connectRedis from 'connect-redis';
import Config from '../services/config';
import Redis from '../services/redis';
import Namespace from '../services/namespace';
import { Dependencies } from 'constitute';

let middleware = null;

//Fix issue https://github.com/othiym23/node-continuation-local-storage/issues/29
const clsifyMiddleware = (fn, ns) =>
  (req, res, next) =>
    fn.call(this, req, res, ns.bind(next));

/**
 * @param _config {Config}
 * @param redis {Redis}
 * @param namespace {Namespace}
 * @returns {function()}
 * @constructor
 */
function SessionMiddleware(_config, redis, namespace) {
  return () => {
    if (middleware) {
      return middleware;
    }
    const RedisStore = connectRedis(session);
    let store = null;
    const config = _config.get().session;

    if (config.store) {
      const RedisClient = new RedisStore(Object.assign({}, config.store));
      RedisClient.client.on('error', (err) => {
        throw err;
      });
      store = RedisClient;
    } else {
      store = new RedisStore(Object.assign({}, { client: redis.getInstance() }));
    }

    middleware = session({
      store,
      cookie: Object.assign({}, _config.get().cookie),
      secret: config.secret,
      resave: config.resave,
      saveUninitialized: config.saveUninitialized
    });

    return namespace.isEnabled() ?
      clsifyMiddleware(middleware, namespace.use().getContext()) :
      middleware;
  };
}
Dependencies(Config, Redis, Namespace)(SessionMiddleware);  //eslint-disable-line new-cap

export default SessionMiddleware;
