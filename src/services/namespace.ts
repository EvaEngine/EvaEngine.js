import { AsyncLocalStorage } from 'node:async_hooks';
import Config from './config.ts';
import { OperationUnsupportedException } from '../exceptions/index.ts';
import ServiceInterface from './interface.ts';

/**
 * CLS 语义的上下文是键值集合；AsyncLocalStorage 的 context 是单个值，
 * 因此用 Map 承载，保持 get(key)/set(key, value) 的消费方式不变。
 */
type ClsContext = Map<string, unknown>;

const stores: Record<string, Store> = {};
const namespaces = new Map<string, AsyncLocalStorage<ClsContext>>();

export class Store {
  // Concrete stores forward their arguments to the underlying namespace
  // implementations while these base implementations are no-ops that accept
  // and ignore whatever is passed, as in the original JS signatures.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get(...args: unknown[]): unknown {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  set(...args: unknown[]): this {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bind(...args: unknown[]): unknown {
    return this;
  }

  reset(): this {
    return this;
  }

  active(): unknown {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  run(callback: (context?: unknown, ...args: unknown[]) => unknown, ...args: unknown[]): unknown {
    return callback();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bindEmitter(...args: unknown[]): unknown {
    return this;
  }

  getContext(): unknown {
    throw new OperationUnsupportedException('Not able to get namespace context when it be disabled');
  }

  createContext(): unknown {
    return undefined;
  }
}

export class NullStore extends Store {
  // Accepts and ignores the namespace argument, as the implicit constructor did.
  constructor(...args: unknown[]) {
    super(...(args as []));
  }
}

export class NsStore extends Store {
  name: string;
  storage: AsyncLocalStorage<ClsContext>;

  constructor(name: string) {
    super();
    this.name = name;
    this.storage = new AsyncLocalStorage();
    namespaces.set(name, this.storage);
  }

  override get(key: string): unknown {
    return this.storage.getStore()?.get(key);
  }

  override set(key: string, value: unknown): this {
    // 在 run 上下文之外没有可写的 context；原 CLS 行为只对 run 内的消费方可见，
    // 这里保持一致，直接丢弃。
    this.storage.getStore()?.set(key, value);
    return this;
  }

  override bind<T extends (...args: never[]) => unknown>(fn: T): (...args: never[]) => unknown {
    // Node 24 已移除 AsyncLocalStorage 实例的 bind，这里按其原语义实现：
    // 捕获绑定时刻的 context，调用时重新进入。
    const context = this.storage.getStore();
    return (...args: never[]) => this.storage.run(context as ClsContext, () => fn(...args));
  }

  override active(): ClsContext | undefined {
    return this.storage.getStore();
  }

  override run(callback: (context: ClsContext, ...args: unknown[]) => unknown, ...args: unknown[]): unknown {
    // CLS 的 run 会把新建的 context 作为回调首参传入（Sequelize._clsRun 依赖此行为）
    const context = new Map();
    return this.storage.run(context, () => callback(context, ...args));
  }

  override bindEmitter(emitter: unknown): unknown {
    // AsyncLocalStorage 通过 async chain 自动传播上下文，无需 CLS 式的 emitter 绑定；
    // 保留方法以兼容原调用面（trace 中间件等），原样返回 emitter。
    return emitter;
  }

  override getContext(): NsStore {
    // CLS 消费方（Sequelize.useCLS、session clsify）只依赖 get/set/run/bind 方法面，
    // NsStore 自身即满足该接口，直接返回实例。
    return this;
  }

  override createContext(): ClsContext {
    return new Map();
  }

  override reset(): this {
    this.storage.disable();
    this.storage = new AsyncLocalStorage();
    namespaces.set(this.name, this.storage);
    return this;
  }
}

interface NamespaceConfig {
  enable?: boolean;
}

class Namespace extends ServiceInterface {
  config: NamespaceConfig;
  defaultName: string;
  store: Store | null;
  name: string | null;

  static dependencies = [Config];

  constructor(config: Config) {
    super();
    this.config = config.get('namespace') as NamespaceConfig;
    // The original code reads defaultName off the Config service itself (not
    // off the `namespace` config object), so the quirk is kept.
    this.defaultName = (config as { defaultName?: string }).defaultName || 'eva.ns';
    this.store = null;
    this.name = null;
  }

  isEnabled(): boolean | undefined {
    return this.config.enable;
  }

  getDefaultName(): string {
    return this.defaultName;
  }

  setDefaultName(name: string): this {
    this.defaultName = name;
    return this;
  }

  getName(): string | null {
    return this.name;
  }

  getStore(): Store {
    if ({}.hasOwnProperty.call(stores, this.name as PropertyKey)) {
      return stores[this.name as string];
    }
    stores[this.name as string] = this.config.enable === true ?
      new NsStore(this.name as string) : new NullStore(this.name as string);
    return stores[this.name as string];
  }

  destroy(name: string): this {
    namespaces.get(name)?.disable();
    namespaces.delete(name);
    delete stores[name];
    return this;
  }

  use(ns?: string | null): Store {
    this.name = ns || this.defaultName;
    return this.getStore();
  }

  get(key: string): unknown {
    return this.use().get(key);
  }

  set(key: string, value: unknown): unknown {
    return this.use().set(key, value);
  }

  bind(...args: unknown[]): unknown {
    return this.use().bind(...args);
  }

  active(): unknown {
    return this.use().active();
  }

  run(...args: unknown[]): unknown {
    return this.use().run(...(args as [callback: () => unknown, ...args: unknown[]]));
  }

  bindEmitter(...args: unknown[]): unknown {
    return this.use().bindEmitter(...args);
  }

  createContext(): unknown {
    return this.use().createContext();
  }
}

export default Namespace;
