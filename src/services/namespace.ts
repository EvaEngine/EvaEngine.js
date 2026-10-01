import constitute from 'constitute';
import { createNamespace, getNamespace, destroyNamespace, reset } from 'continuation-local-storage';
import type { Namespace as ClsNamespace } from 'continuation-local-storage';
import Config from './config.ts';
import { OperationUnsupportedException } from '../exceptions/index.ts';
import ServiceInterface from './interface.ts';

const stores: Record<string, Store> = {};

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
  run(callback: () => unknown, ...args: unknown[]): unknown {
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

  constructor(name: string) {
    super();
    this.name = name;
    createNamespace(name);
  }

  override get(key: string): unknown {
    return getNamespace(this.name)!.get(key);
  }

  override set(key: string, value: unknown): this {
    getNamespace(this.name)!.set(key, value);
    return this;
  }

  override bind(...args: unknown[]): unknown {
    return getNamespace(this.name)!.bind(...(args as [fn: (...args: unknown[]) => unknown, context?: object]));
  }

  override active(): unknown {
    // CLS exposes `active` as the current context property while the original
    // code calls it as a method, so the call shape is kept via an assertion.
    return (getNamespace(this.name)!.active as unknown as () => unknown)();
  }

  override run(...args: unknown[]): unknown {
    return getNamespace(this.name)!.run(...(args as [fn: (...args: unknown[]) => unknown, ...args: unknown[]]));
  }

  override bindEmitter(...args: unknown[]): unknown {
    return getNamespace(this.name)!.bindEmitter(...args);
  }

  override getContext(): ClsNamespace {
    return getNamespace(this.name)!;
  }

  override createContext(): object {
    return getNamespace(this.name)!.createContext();
  }

  override reset(): this {
    reset(this.name);
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
    destroyNamespace(name);
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

constitute.Dependencies(Config)(Namespace);
export default Namespace;
