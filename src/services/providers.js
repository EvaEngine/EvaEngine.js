import Cache from './cache';
import Config from './config';
import Env from './env';
import HttpClient from './http_client';
import JsonWebToken from './jwt_token';
import Logger from './logger';
import Redis from './redis';
import RestClient from './rest_client';
import Namespace from './namespace';
import Now from './now';
import ValidatorBase from './joi';
import EventManager from './event_manager';
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
    const { mode } = this.engine.getMeta();
    const loggerLabel = mode === 'web' ? mode + this.engine.getMeta().port
      : process.env.CLI_NAME || 'cli';
    logger.setLabel(loggerLabel);
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

export class RestClientProvider extends ServiceProvider {
  get name() {
    return 'rest_client';
  }

  register() {
    DI.bindClass(this.name, RestClient);
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

export class NamespaceProvider extends ServiceProvider {
  get name() {
    return 'namespace';
  }

  register() {
    DI.bindClass(this.name, Namespace);
  }
}

export class ValidatorBaseProvider extends ServiceProvider {
  get name() {
    return 'validator_base';
  }

  register() {
    DI.bindClass(this.name, ValidatorBase);
  }
}

export class EventManagerProvider extends ServiceProvider {
  get name() {
    return 'event_manager';
  }

  register() {
    DI.bindClass(this.name, EventManager);
  }
}

export class NowProvider extends ServiceProvider {
  get name() {
    return 'now';
  }

  register() {
    DI.bindClass(this.name, Now);
  }
}
