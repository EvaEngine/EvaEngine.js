import session from 'express-session';
import { RedisStore } from 'connect-redis';
import constitute from 'constitute';
import DI from '../di.js';
import Config from '../services/config.js';
import Redis from '../services/redis.js';
import Namespace from '../services/namespace.js';

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
    const Store = RedisStore;
    let store = null;
    const config = _config.get().session;

    if (config.store) {
      const RedisClient = new Store(Object.assign({}, config.store, {
        client: config.store.client || redis.getInstance()
      }));
      RedisClient.client.on('error', (err) => {
        try {
          DI.get('logger').error('Session Redis store error:', err);
        } catch {
          console.error('Session Redis store error:', err);
        }
      });
      store = RedisClient;
    } else {
      store = new Store(Object.assign({}, { client: redis.getInstance() }));
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
constitute.Dependencies(Config, Redis, Namespace)(SessionMiddleware);

export default SessionMiddleware;
