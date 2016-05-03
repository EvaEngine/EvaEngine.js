import session from 'express-session';
import connectRedis from 'connect-redis';
import Config from '../services/config';
import Redis from '../services/redis';
import { Dependencies } from 'constitute';

function SessionMiddleware(_config, redis) {
  return () => {
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
    return session({
      store,
      cookie: Object.assign({}, _config.get().cookie),
      secret: config.secret,
      resave: config.resave,
      saveUninitialized: config.saveUninitialized
    });
  };
}
Dependencies(Config, Redis)(SessionMiddleware)

export default SessionMiddleware;
