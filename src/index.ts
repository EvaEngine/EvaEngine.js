import constitute from 'constitute';
import sequelize from 'sequelize';
import Joi from 'joi';
import EvaEngine, * as engine from './engine.ts';
import * as swagger from './swagger/index.ts';
import * as exceptions from './exceptions/index.ts';
import * as services from './services/index.ts';
import * as middlewares from './middlewares/index.ts';
import * as ServiceProviders from './services/providers.ts';
import * as MiddlewareProviders from './middlewares/providers.ts';
import * as utils from './utils/index.ts';
import Command, * as commands from './commands/index.ts';
import Entities from './entities/index.ts';

const providers = {
  services: ServiceProviders,
  middlewares: MiddlewareProviders
};

const { wrapper } = utils;

const {
  DI,
  express
} = engine;

const core = {
  EvaEngine,
  Command,
  DI,
  Entities,
  engine,
  express,
  commands,
  dependencies: {
    Joi,
    constitute,
    sequelize
  },
  exceptions,
  middlewares,
  sequelize,
  Joi,
  swagger,
  services,
  providers,
  wrapper,
  utils
};

export default core;
export { core };
