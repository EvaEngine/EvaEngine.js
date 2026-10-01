import Cache from './cache.ts';
import Config from './config.ts';
import Env from './env.ts';
import HttpClient from './http_client.ts';
import JsonWebToken from './jwt_token.ts';
import KongJsonWebToken from './jwt_token_kong.ts';
import Logger from './logger.ts';
import Redis from './redis.ts';
import RestClient from './rest_client.ts';
import Namespace from './namespace.ts';
import Now from './now.ts';
import ValidatorBase from './joi.ts';
import EventManager from './event_manager.ts';
import DI from '../di.ts';
import type { EngineLike } from '../di.ts';

export class ServiceProvider {
  engine: EngineLike;

  constructor(engine: EngineLike) {
    this.engine = engine;
  }

  get name(): string {
    return 'default';
  }

  register(): void {
  }
}

export class EnvProvider extends ServiceProvider {
  override get name(): string {
    return 'env';
  }

  override register(): void {
    DI.bindClass(this.name, Env);
  }
}

export class ConfigProvider extends ServiceProvider {
  override get name(): string {
    return 'config';
  }

  override register(): void {
    const config = DI.get(Config);
    config.setPath(this.engine.getMeta().configPath);
    DI.bindClass(this.name, Config, [config]);
  }
}

export class LoggerProvider extends ServiceProvider {
  override get name(): string {
    return 'logger';
  }

  override register(): void {
    const logger = DI.get(Logger);
    const { mode } = this.engine.getMeta();
    const loggerLabel = mode === 'web' ? mode + this.engine.getMeta().port
      : process.env.CLI_NAME || 'cli';
    logger.setLabel(loggerLabel);
    DI.bindClass(this.name, Logger, [logger]);
  }
}

export class RedisProvider extends ServiceProvider {
  override get name(): string {
    return 'redis';
  }

  override register(): void {
    DI.bindClass(this.name, Redis);
  }
}

export class JsonWebTokenProvider extends ServiceProvider {
  override get name(): string {
    return 'jwt';
  }

  override register(): void {
    if (DI.get('config').get('token.provider') === 'kong') {
      DI.bindClass(this.name, KongJsonWebToken);
    } else {
      DI.bindClass(this.name, JsonWebToken);
    }
  }
}

export class HttpClientProvider extends ServiceProvider {
  override get name(): string {
    return 'http_client';
  }

  override register(): void {
    DI.bindClass(this.name, HttpClient);
  }
}

export class RestClientProvider extends ServiceProvider {
  override get name(): string {
    return 'rest_client';
  }

  override register(): void {
    DI.bindClass(this.name, RestClient);
  }
}

export class CacheProvider extends ServiceProvider {
  override get name(): string {
    return 'cache';
  }

  override register(): void {
    DI.bindClass(this.name, Cache);
  }
}

export class NamespaceProvider extends ServiceProvider {
  override get name(): string {
    return 'namespace';
  }

  override register(): void {
    DI.bindClass(this.name, Namespace);
  }
}

export class ValidatorBaseProvider extends ServiceProvider {
  override get name(): string {
    return 'validator_base';
  }

  override register(): void {
    DI.bindClass(this.name, ValidatorBase);
  }
}

export class EventManagerProvider extends ServiceProvider {
  override get name(): string {
    return 'event_manager';
  }

  override register(): void {
    DI.bindClass(this.name, EventManager);
  }
}

export class NowProvider extends ServiceProvider {
  override get name(): string {
    return 'now';
  }

  override register(): void {
    DI.bindClass(this.name, Now);
  }
}
