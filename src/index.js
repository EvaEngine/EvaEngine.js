import * as swagger from './swagger';
import * as exceptions from './exceptions';
import * as services from './services';
import * as middlewares from './middlewares';
import * as ServiceProviders from './services/providers';
import * as MiddlewareProviders from './middlewares/providers';
import * as utils from './utils';
import Command from './command';
import EvaEngine, * as engine from './engine';

const providers = {
  services: ServiceProviders,
  middlewares: MiddlewareProviders
};

const wrapper = utils.wrapper;

const {
        DI,
        express
      } = engine;

export default EvaEngine;

export {
  Command,
  DI,
  engine,
  express,
  exceptions,
  middlewares,
  swagger,
  services,
  providers,
  wrapper,
  utils
};
