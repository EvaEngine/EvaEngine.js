import session from 'express-session';
import { RedisStore } from 'connect-redis';
import constitute from 'constitute';
import DI from '../di.ts';
import Config from '../services/config.ts';
import Redis from '../services/redis.ts';
import Namespace from '../services/namespace.ts';
import type { RequestHandler } from 'express';
import type { Namespace as ClsNamespace } from 'continuation-local-storage';

let middleware: RequestHandler | null = null;

//Fix issue https://github.com/othiym23/node-continuation-local-storage/issues/29
const clsifyMiddleware = (fn: RequestHandler, ns: ClsNamespace): RequestHandler =>
  (req, res, next) =>
    fn.call(this, req, res, ns.bind(next));

interface SessionConfig {
  store?: { client?: unknown; [key: string]: unknown } | null;
  secret?: string;
  resave?: boolean;
  saveUninitialized?: boolean;
}

function SessionMiddleware(_config: Config, redis: Redis, namespace: Namespace) {
  return () => {
    if (middleware) {
      return middleware;
    }
    const Store = RedisStore;
    let store: InstanceType<typeof RedisStore> | null = null;
    const config = (_config.get() as { session: SessionConfig }).session;

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
      cookie: Object.assign({}, (_config.get() as { cookie?: object }).cookie),
      secret: config.secret as string,
      resave: config.resave,
      saveUninitialized: config.saveUninitialized
    });

    return namespace.isEnabled() ?
      //Store 基类 getContext() 类型为 unknown，运行时由 NsStore 返回 CLS namespace
      clsifyMiddleware(middleware, namespace.use().getContext() as ClsNamespace) :
      middleware;
  };
}
constitute.Dependencies(Config, Redis, Namespace)(SessionMiddleware);

export default SessionMiddleware;
