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
import type AuthKongMiddleware from './middlewares/auth_kong.ts';
import type AuthMiddleware from './middlewares/auth.ts';
import type DebugMiddleware from './middlewares/debug.ts';
import type SessionMiddleware from './middlewares/session.ts';
import type TraceMiddleware from './middlewares/trace.ts';
import type ValidatorMiddleware from './middlewares/validator.ts';
import type ViewCacheMiddleware from './middlewares/view_cache.ts';

/**
 * Injectable dependencies are declared on the target itself, as plain data the
 * container reads at instantiation time:
 * - classes use `static dependencies = [...]`
 * - function factories (no static) use the `Dependencies(...)` helper, which
 *   writes the same property onto the function
 * Each entry is resolved recursively and passed to the constructor, or as call
 * arguments for function factories.
 */

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

//容器注入目标:类(可构造)与函数工厂(可调用)统一处理
type ClassOrFunction = (abstract new (...args: never[]) => unknown) | ((...args: never[]) => unknown);

type DependencySource = ClassOrFunction & { dependencies?: unknown[] };

/**
 * Declares the injectable dependencies of a function factory (classes declare
 * `static dependencies` directly). The container resolves each entry
 * recursively and passes the results as call arguments.
 */
export function Dependencies(...dependencies: unknown[]) {
  return <T extends ClassOrFunction>(target: T): T => {
    (target as DependencySource).dependencies = dependencies;
    return target;
  };
}

interface ClassBinding {
  kind: 'class';
  target: ClassOrFunction;
  //显式依赖列表(bindClass 第三参)。给出时忽略 target 自己的 dependencies 声明
  args?: unknown[];
}

interface ValueBinding {
  kind: 'value';
  target: unknown;
}

interface MethodBinding {
  kind: 'method';
  target: ClassOrFunction;
  args?: unknown[];
}

type Binding = ClassBinding | ValueBinding | MethodBinding;

//保证每条错误只追加一次定位信息
const errorsWithDebugInfo = new WeakSet<Error>();

function isClass(candidate: unknown): boolean {
  return typeof candidate === 'function' && /^\s*class\s+/.test(candidate.toString());
}

function printPrettyKey(key: unknown): string {
  if (typeof key === 'function') {
    return key.name || (isClass(key) ? '[anonymous class]' : '[anonymous fn]');
  }
  if (typeof key === 'object') {
    return key === null ? '[null]' : '{}';
  }
  return String(key);
}

/**
 * Minimal native DI container:
 * - recursive resolution with per-container singleton cache
 * - class bindings are cached per class, so several binding names pointing at
 *   the same class share one instance; this is what keeps the providers'
 *   "get prebuilt instance, mutate it, bindClass(key, Class, [instance])"
 *   pattern visible to later `get`s
 * - value/method bindings are cached per binding, so rebinding builds fresh
 * - method (function factory) bindings are invoked with the container as
 *   `this` and their return value — the fully-injected inner function — is
 *   cached as the singleton
 * - falsy instances are rebuilt on every get
 */
export class Container {
  bindings = new Map<unknown, Binding>();
  instances = new Map<unknown, unknown>();
  stack = new Set<unknown>();

  bindClass(key: unknown, target: ClassOrFunction, args?: unknown[]): this {
    this.bindings.set(key, { kind: 'class', target, args });
    return this;
  }

  bindValue(key: unknown, value: unknown): this {
    this.bindings.set(key, { kind: 'value', target: value });
    return this;
  }

  bindMethod(key: unknown, target: ClassOrFunction, args?: unknown[]): this {
    this.bindings.set(key, { kind: 'method', target, args });
    return this;
  }

  resolve(key: unknown): unknown {
    if (this.stack.has(key)) {
      const prettyStack = [...this.stack, key].map(printPrettyKey).join(' => ');
      throw new Error(`Circular dependency detected: ${prettyStack}`);
    }
    this.stack.add(key);
    try {
      try {
        return this.instantiate(this.resolveBinding(key));
      } catch (err) {
        if (err instanceof Error && !errorsWithDebugInfo.has(err)) {
          err.message += ` (while constituting ${printPrettyKey(key)})`;
          errorsWithDebugInfo.add(err);
        }
        throw err;
      }
    } finally {
      this.stack.delete(key);
    }
  }

  private resolveBinding(key: unknown): Binding {
    const binding = this.bindings.get(key);
    if (binding) {
      return binding;
    }
    //未绑定的函数按类兜底:读它自己的 dependencies 声明并以 new 实例化
    if (typeof key === 'function') {
      return { kind: 'class', target: key as ClassOrFunction };
    }
    throw new Error(`Cannot resolve a value of type ${typeof key}`);
  }

  private instantiate(binding: Binding): unknown {
    if (binding.kind === 'value') {
      return binding.target;
    }
    if (binding.kind === 'class') {
      let instance = this.instances.get(binding.target);
      if (instance) {
        return instance;
      }
      instance = this.construct(binding);
      this.instances.set(binding.target, instance);
      return instance;
    }
    let instance = this.instances.get(binding);
    if (instance) {
      return instance;
    }
    instance = this.invoke(binding);
    this.instances.set(binding, instance);
    return instance;
  }

  //显式 args 优先于 target 自身的 dependencies 声明,两者皆无按零依赖处理
  private resolveDeps(binding: ClassBinding | MethodBinding): unknown[] {
    const declared = binding.args ?? (binding.target as DependencySource).dependencies ?? [];
    return declared.map(dep => this.resolve(dep));
  }

  private construct(binding: ClassBinding): unknown {
    const Target = binding.target as new (...args: unknown[]) => unknown;
    return new Target(...this.resolveDeps(binding));
  }

  private invoke(binding: MethodBinding): unknown {
    const fn = binding.target as (this: Container, ...args: unknown[]) => unknown;
    return fn.apply(this, this.resolveDeps(binding));
  }
}

let container = new Container();
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
  //bindMethod 绑定的中间件工厂注入依赖后，get 返回的是注入完成的内层工厂，
  //即中间件函数的返回值；auth 由 provider 按 config 在两套实现间切换
  static get(name: 'trace'): ReturnType<typeof TraceMiddleware>;
  static get(name: 'session'): ReturnType<typeof SessionMiddleware>;
  static get(name: 'auth'): ReturnType<typeof AuthMiddleware | typeof AuthKongMiddleware>;
  static get(name: 'debug'): ReturnType<typeof DebugMiddleware>;
  static get(name: 'validator'): ReturnType<typeof ValidatorMiddleware>;
  static get(name: 'view_cache'): ReturnType<typeof ViewCacheMiddleware>;
  static get<T>(service: abstract new (...args: never[]) => T): T;
  static get<T = unknown>(name: string): T;
  static get(service: unknown): unknown {
    if (typeof service !== 'string') {
      return container.resolve(service);
    }

    if (!Object.prototype.hasOwnProperty.call(bound, service)) {
      throw new RuntimeException(`Service ${service} not bound yet`);
    }
    if (boundKind[service] === BIND_VALUE) {
      return bound[service];
    }
    // Resolve the binding itself so explicit arguments and class substitutions
    // are honored; class instances still share the cache keyed by target.
    return container.resolve(service);
  }

  static bindClass(target: unknown, ...args: unknown[]) {
    if (typeof target === 'string') {
      bound[target] = args[0];
      boundKind[target] = BIND_CLASS;
    }
    return container.bindClass(target, args[0] as ClassOrFunction, args[1] as unknown[]);
  }

  static bindValue(target: unknown, ...args: unknown[]) {
    if (typeof target === 'string') {
      bound[target] = args[0];
      boundKind[target] = BIND_VALUE;
    }
    return container.bindValue(target, args[0]);
  }

  static bindMethod(target: unknown, ...args: unknown[]) {
    if (typeof target === 'string') {
      bound[target] = target;
      boundKind[target] = BIND_METHOD;
    }
    return container.bindMethod(target, args[0] as ClassOrFunction, args[1] as unknown[]);
  }

  static reset() {
    container = new Container();
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
