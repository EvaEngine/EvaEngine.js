import constitute from 'constitute';
import mysql from 'mysql';
import sequelize from 'sequelize';
import Joi from 'joi';
import EvaEngine, * as engine from './engine';
import * as swagger from './swagger';
import * as exceptions from './exceptions';
import * as services from './services';
import * as middlewares from './middlewares';
import * as ServiceProviders from './services/providers';
import * as MiddlewareProviders from './middlewares/providers';
import * as utils from './utils';
import Command, * as commands from './commands';
import Entities from './entities';

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

/**
 * @type {{EvaEngine: EvaEngine, Command: Command, DI, Entities: Entities, engine, express, commands, dependencies: {Joi, constitute, sequelize: ("sequelize".sequelize.SequelizeStatic|"sequelize".sequelize), mysql}, exceptions, middlewares, sequelize: ("sequelize".sequelize.SequelizeStatic|"sequelize".sequelize), Joi, swagger, services, providers: {services, middlewares}, wrapper: ((p1:*)=>(p1?:*, p2?:*, p3?:*)), utils}}
 */
exports = module.exports = core;
