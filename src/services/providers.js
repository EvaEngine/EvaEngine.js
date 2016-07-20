import Env from './env';
import Cache from './cache';
import Config from './config';
import Logger from './logger';
import Redis from './redis';
import JsonWebToken from './jwt_token';
import HttpClient from './http_client';
import DI from '../di';

export class ServiceProvider {
  constructor(engine) {
    this.engine = engine;
  }

  get name() {
    return 'default';
  }

  register() {
  }
}

export class EnvProvider extends ServiceProvider {
  get name() {
    return 'env';
  }

  register() {
    DI.bindClass(this.name, Env);
  }
}

export class ConfigProvider extends ServiceProvider {
  get name() {
    return 'config';
  }

  register() {
    const config = DI.get(Config);
    config.setPath(this.engine.getMeta().configPath);
    DI.bindClass(this.name, Config, [config]);
  }
}

export class LoggerProvider extends ServiceProvider {
  get name() {
    return 'logger';
  }

  register() {
    const logger = DI.get(Logger);
    const mode = this.engine.meta.mode;
    logger.setLabel(mode === 'web' ? mode + this.engine.meta.port : 'cli');
    DI.bindClass(this.name, Logger, [logger]);
  }
}

export class RedisProvider extends ServiceProvider {
  get name() {
    return 'redis';
  }

  register() {
    DI.bindClass(this.name, Redis);
  }
}

export class JsonWebTokenProvider extends ServiceProvider {
  get name() {
    return 'jwt';
  }

  register() {
    DI.bindClass(this.name, JsonWebToken);
  }
}

export class HttpClientProvider extends ServiceProvider {
  get name() {
    return 'http_client';
  }

  register() {
    DI.bindClass(this.name, HttpClient);
  }
}

export class CacheProvider extends ServiceProvider {
  get name() {
    return 'cache';
  }

  register() {
    DI.bindClass(this.name, Cache);
  }
}
