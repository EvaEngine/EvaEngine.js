import constitute from 'constitute';
import {
  RuntimeException
} from './exceptions';
import { ServiceProvider } from './services/providers';

let container = new constitute.Container();
let bound = {};

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

    if (!bound[service]) {
      throw new RuntimeException(`Service ${service} not bound yet`);
    }
    return container.constitute(bound[service]);
  }

  static bindClass(...args) {
    if (typeof args[0] === 'string') {
      [, bound[args[0]]] = args;
    }
    return container.bindClass(...args);
  }

  static bindValue(...args) {
    if (typeof args[0] === 'string') {
      [, bound[args[0]]] = args;
    }
    return container.bindValue(...args);
  }

  static bindMethod(...args) {
    if (typeof args[0] === 'string') {
      [, bound[args[0]]] = args;
    }
    return container.bindMethod(...args);
  }

  static reset() {
    container = new constitute.Container();
    bound = {};
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
