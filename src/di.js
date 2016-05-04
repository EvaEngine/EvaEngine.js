import {
  RuntimeException
} from './exceptions';
import constitute from 'constitute';

const container = new constitute.Container();
const bound = {};

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
    bound[args[0]] = args[1];
    return container.bindClass(...args);
  }

  static bindValue(...args) {
    bound[args[0]] = args[1];
    return container.bindValue(...args);
  }

  static bindMethod(...args) {
    bound[args[0]] = args[1];
    return container.bindMethod(...args);
  }
}
