import * as swagger from './swagger';
import * as exceptions from './exceptions';
import * as services from './services';
import * as middlewares from './middlewares';
import * as ServiceProviders from './services/providers';
import * as MiddlewareProviders from './middlewares/providers';
import * as utils from './utils';
import Command, * as commands from './commands';
import Entities from './entities';
import EvaEngine, * as engine from './engine';
import constitute from 'constitute';
import mysql from 'mysql';
import sequelize from 'sequelize';

const providers = {
  services: ServiceProviders,
  middlewares: MiddlewareProviders
};

const wrapper = utils.wrapper;

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
    constitute,
    sequelize,
    mysql
  },
  exceptions,
  middlewares,
  sequelize,
  swagger,
  services,
  providers,
  wrapper,
  utils
};

exports = module.exports = core;
