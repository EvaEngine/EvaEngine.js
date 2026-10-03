import session from 'express-session';
import { RedisStore } from 'connect-redis';
import DI, { Dependencies } from '../di.ts';
import Config from '../services/config.ts';
import Redis from '../services/redis.ts';
import type { RequestHandler } from 'express';

let middleware: RequestHandler | null = null;

interface SessionConfig {
  store?: { client?: unknown; [key: string]: unknown } | null;
  secret?: string;
  resave?: boolean;
  saveUninitialized?: boolean;
}

function SessionMiddleware(_config: Config, redis: Redis) {
  return () => {
    if (middleware) {
      return middleware;
    }
    const Store = RedisStore;
    let store: InstanceType<typeof RedisStore> | null;
    const config = (_config.get() as { session: SessionConfig }).session;

    if (config.store) {
      const RedisClient = new Store(Object.assign({}, config.store, {
        client: config.store.client || redis.getInstance()
      }));
      RedisClient.client.on('error', (err: unknown) => {
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

    // AsyncLocalStorage 经 async chain 自动传播上下文，不再需要 CLS 时代
    // 针对 othiym23/node-continuation-local-storage#29 的 clsify 绑定补丁
    return middleware;
  };
}
Dependencies(Config, Redis)(SessionMiddleware);

export default SessionMiddleware;
