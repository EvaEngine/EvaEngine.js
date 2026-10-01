import constitute from 'constitute';
import { RuntimeException } from './exceptions/index.ts';
import { ServiceProvider } from './services/providers.ts';
import type Cache from './services/cache.ts';
import type Config from './services/config.ts';
import type Env from './services/env.ts';
import type EventManager from './services/event_manager.ts';
import type HttpClient from './services/http_client.ts';
import type JsonWebToken from './services/jwt_token.ts';
import type KongJsonWebToken from './services/jwt_token_kong.ts';
import type Logger from './services/logger.ts';
import type Namespace from './services/namespace.ts';
import type Now from './services/now.ts';
import type Redis from './services/redis.ts';
import type RestClient from './services/rest_client.ts';
import type ValidatorBase from './services/joi.ts';

/**
 * Engine metadata shared between the EvaEngine runtime, service providers and mocks.
 */
export interface EngineMeta {
  projectRoot?: string;
  configPath?: string;
  sourceRoot?: string;
  config?: Record<string, unknown>;
  logger?: unknown;
  namespace?: unknown;
  // engine.port keeps the raw constructor input when it is not numeric and
  // becomes false for negative ports, so it is not always a number.
  port?: number | string | boolean;
  mode?: string;
}

/**
 * Minimal structural view of an engine (the real EvaEngine or a test mock).
 */
export interface EngineLike {
  getMeta(): EngineMeta;
}

type ServiceProviderConstructor = new (engine: EngineLike) => ServiceProvider;

let container = new constitute.Container();
let bound: Record<string, unknown> = {};
let boundKind: Record<string, string> = {};

const BIND_CLASS = 'class';
const BIND_VALUE = 'value';
const BIND_METHOD = 'method';

export default class DI {
  static getContainer() {
    return container;
  }

  static getBound() {
    return bound;
  }

  static get(name: 'env'): Env;
  static get(name: 'config'): Config;
  static get(name: 'logger'): Logger;
  static get(name: 'redis'): Redis;
  static get(name: 'cache'): Cache;
  static get(name: 'http_client'): HttpClient;
  static get(name: 'rest_client'): RestClient;
  static get(name: 'namespace'): Namespace;
  static get(name: 'now'): Now;
  static get(name: 'validator_base'): ValidatorBase;
  static get(name: 'event_manager'): EventManager;
  static get(name: 'jwt'): JsonWebToken | KongJsonWebToken;
  static get<T>(service: abstract new (...args: never[]) => T): T;
  static get<T = unknown>(name: string): T;
  static get(service: unknown): unknown {
    if (typeof service !== 'string') {
      return container.constitute(service);
    }

    if (!Object.prototype.hasOwnProperty.call(bound, service)) {
      throw new RuntimeException(`Service ${service} not bound yet`);
    }
    if (boundKind[service] === BIND_VALUE) {
      return bound[service];
    }
    return container.constitute(bound[service]);
  }

  static bindClass(target: unknown, ...args: unknown[]) {
    if (typeof target === 'string') {
      bound[target] = args[0];
      boundKind[target] = BIND_CLASS;
    }
    return container.bindClass(target, ...args);
  }

  static bindValue(target: unknown, ...args: unknown[]) {
    if (typeof target === 'string') {
      bound[target] = args[0];
      boundKind[target] = BIND_VALUE;
    }
    return container.bindValue(target, ...args);
  }

  static bindMethod(target: unknown, ...args: unknown[]) {
    if (typeof target === 'string') {
      bound[target] = target;
      boundKind[target] = BIND_METHOD;
    }
    return container.bindMethod(target, ...args);
  }

  static reset() {
    container = new constitute.Container();
    bound = {};
    boundKind = {};
  }

  static registerServiceProviders(providers: ServiceProviderConstructor[] = [], engine: EngineLike) {
    for (const providerClass of providers) {
      DI.registerService(providerClass, engine);
    }
  }

  static registerService(ProviderClass: ServiceProviderConstructor, engine: EngineLike) {
    const provider = new ProviderClass(engine);
    if (!(provider instanceof ServiceProvider)) {
      throw new RuntimeException(`Input provider ${(provider as ServiceProvider).name} not service provider`);
    }
    provider.register();
  }

  static registerMockedProviders(providers: ServiceProviderConstructor[], configPath: string) {
    const mockEngine: EngineLike = {
      getMeta: () => ({
        configPath
      })
    };
    DI.registerServiceProviders(providers, mockEngine);
  }
}
