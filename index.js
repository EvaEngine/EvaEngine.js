const fs = require('fs');

let core = null;
try {
  fs.accessSync(__dirname + '/lib/index.js', fs.R_OK);
  core = require('./lib');
  //Use babel polyfill when node version < 8
  if (!global._babelPolyfill && process.version.substr(1, 1) < 8) {
    require('babel-polyfill');
  }
} catch (e) {
  core = require('./src');
}

/**
 * @type {{EvaEngine: EvaEngine, Command: Command, DI, Entities: Entities, engine, express, commands, dependencies: {Joi, constitute, sequelize: ("sequelize".sequelize.SequelizeStatic|"sequelize".sequelize), mysql}, exceptions, middlewares, sequelize: ("sequelize".sequelize.SequelizeStatic|"sequelize".sequelize), Joi, swagger, services, providers: {services, middlewares}, wrapper: ((p1:*)=>(p1?:*, p2?:*, p3?:*)), utils}}
 */
exports = module.exports = core;
