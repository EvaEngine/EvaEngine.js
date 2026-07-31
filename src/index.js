import constitute from 'constitute';
import mysql from 'mysql';
import sequelize from 'sequelize';
import Joi from 'joi';
import EvaEngine, * as engine from './engine.js';
import * as swagger from './swagger/index.js';
import * as exceptions from './exceptions/index.js';
import * as services from './services/index.js';
import * as middlewares from './middlewares/index.js';
import * as ServiceProviders from './services/providers.js';
import * as MiddlewareProviders from './middlewares/providers.js';
import * as utils from './utils/index.js';
import Command, * as commands from './commands/index.js';
import Entities from './entities/index.js';

const providers = {
  services: ServiceProviders,
  middlewares: MiddlewareProviders
};

const { wrapper } = utils;

const {
  DI,
  express
} = engine;

/**
 * @typedef {Object} engineCore
 */
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
    sequelize,
    mysql
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

module.exports = core;
exports = module.exports; //eslint-disable-line
