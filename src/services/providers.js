import Env from './env';
import Config from './config';
import Logger from './logger';
import Redis from './redis';
import JsonWebToken from './jwt_token';
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
    DI.bindClass(this.name, Logger);
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
