import wrapper from './utils/wrapper';
import { pagination, paginationFilter } from './utils/pagination';
import * as swagger from './swagger';
import * as exceptions from './exceptions';
import * as services from './services';
import * as middlewares from './middlewares';
import * as ServiceProviders from './services/providers';
import * as MiddlewareProviders from './middlewares/providers';
import command from './command';
import EvaEngine, { yargs, express, later, DI } from './engine';

const deps = {
  yargs,
  later
};

const providers = {
  services: ServiceProviders,
  middlewares: MiddlewareProviders
};

const utils = {
  wrapper,
  pagination,
  paginationFilter
};

export default EvaEngine;

export {
  command,
  deps,
  DI,
  express,
  exceptions,
  middlewares,
  swagger,
  services,
  providers,
  utils
};
