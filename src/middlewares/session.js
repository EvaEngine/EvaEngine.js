import session from 'express-session';
import connectRedis from 'connect-redis';
import Config from '../services/config';
import Redis from '../services/redis';
import { Dependencies } from 'constitute';

let middleware = null;

/**
 * @param _config {Config}
 * @param redis {Redis}
 * @returns {function()}
 * @constructor
 */
function SessionMiddleware(_config, redis) {
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
    return middleware;
  };
}
Dependencies(Config, Redis)(SessionMiddleware);  //eslint-disable-line new-cap

export default SessionMiddleware;
