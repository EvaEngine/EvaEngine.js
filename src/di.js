import constitute from 'constitute';
import { RuntimeException } from './exceptions/index.js';
import { ServiceProvider } from './services/providers.js';

let container = new constitute.Container();
let bound = {};
let boundKind = {};

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

  static get(service) {
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

  static bindClass(...args) {
    if (typeof args[0] === 'string') {
      [, bound[args[0]]] = args;
      boundKind[args[0]] = BIND_CLASS;
    }
    return container.bindClass(...args);
  }

  static bindValue(...args) {
    if (typeof args[0] === 'string') {
      [, bound[args[0]]] = args;
      boundKind[args[0]] = BIND_VALUE;
    }
    return container.bindValue(...args);
  }

  static bindMethod(...args) {
    if (typeof args[0] === 'string') {
      bound[args[0]] = args[0];
      boundKind[args[0]] = BIND_METHOD;
    }
    return container.bindMethod(...args);
  }

  static reset() {
    container = new constitute.Container();
    bound = {};
    boundKind = {};
  }

  /**
   * @param {Array} providers
   * @param {EvaEngine} engine
   */
  static registerServiceProviders(providers = [], engine) {
    for (const providerClass of providers) {
      DI.registerService(providerClass, engine);
    }
  }

  /**
   * @param {constructor} ProviderClass
   * @param {EvaEngine} engine
   */
  static registerService(ProviderClass, engine) {
    const provider = new ProviderClass(engine);
    if (!(provider instanceof ServiceProvider)) {
      throw new RuntimeException(`Input provider ${provider.name} not service provider`);
    }
    provider.register();
  }

  static registerMockedProviders(providers, configPath) {
    const mockEngine = {
      getMeta: () => ({
        configPath
      })
    };
    DI.registerServiceProviders(providers, mockEngine);
  }
}
