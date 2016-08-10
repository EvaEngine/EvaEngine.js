import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';
import DI from '../di';
import util from 'util';

export const getMicroTimestamp = () => {
  const d = new Date();
  return d.getTime() * 1000;
};

//From https://github.com/angelxmoreno/sequelize-isunique-validator
Sequelize.prototype.validateIsUnique = (col, msg) => {
  const conditions = { where: {} };
  const message = msg || `${col} must be unique`;
  return function (value, next) {
    const self = this;
    this.Model.describe().then((schema) => {
      conditions.where[col] = value;
      Object
        .keys(schema)
        .filter(field => schema[field].primaryKey)
        .forEach((pk) => {
          conditions.where[pk] = { $ne: self[pk] };
        });
    }).then(() =>
      self.Model.count(conditions).then((found) =>
        (found !== 0) ? next(message) : next()
      )
    ).catch(next);
  };
};

const entities = {};
/**
 * @type {null|Sequelize}
 */
let sequelize = null;

export default class Entities {
  /**
   *
   * @param {string} entitiesPath
   * @param {Sequelize|Function} sequelizeInstance
   */
  constructor(entitiesPath, sequelizeInstance = null) {
    this.entitiesPath = entitiesPath;
    this.sequelize = sequelizeInstance;
  }

  static addTracer(options = {}) {
    const logger = DI.get('logger');
    return Object.assign(options, {
      benchmark: true,
      logging: (...args) => {
        const tracer = DI.get('namespace').get('tracer');
        if (!tracer) {
          logger.warn('Trying to add tracer to Entities, but no tracer found, maybe Entities boot before tracer middleware called');
        }
        const [query, cost] = args;
        let pushed = false;
        if (tracer && cost > 0) {
          tracer.queries.push({
            query,
            cost: cost * 1000,
            finishedAt: getMicroTimestamp()
          });
          pushed = true;
        }
        logger.verbose(...args, pushed ? '| Pushed to tracer' : '');
      }
    });
  }

  init() {
    if (sequelize) {
      return;
    }

    if (!this.sequelize) {
      const config = DI.get('config').get();
      const logger = DI.get('logger').getInstance();
      const ns = DI.get('namespace');
      if (ns.isEnabled()) {
        //Inject sequelize inner namespace, refer: http://docs.sequelizejs.com/en/latest/docs/transactions/
        Sequelize.cls = ns.use().getContext();
      }

      sequelize = new Sequelize(config.db.database, null, null,
        Object.assign({}, config.sequelize, config.db, Entities.addTracer())
      );
      logger.debug('Builtin sequelize inited');
    } else {
      sequelize = util.isFunction(this.sequelize) ? this.sequelize() : this.sequelize;
    }

    fs
      .readdirSync(this.entitiesPath)
      .filter((file) => {
        const fileArray = file.split('.');
        return (file.indexOf('.') !== 0) &&
          (['js', 'es6'].indexOf(fileArray.pop()) !== -1) && (fileArray[0] !== 'index');
      })
      .forEach((file) => {
        const model = sequelize.import(path.join(this.entitiesPath, file));
        entities[model.name] = model;
      });

    Object.values(entities).forEach((model) => {
      if ('associate' in model) {
        model.associate(entities);
      }
    });

  }

  /**
   * Shortcut for Sequelize query
   * @param sql
   * @param bind
   * @param options
   * @returns {*|{foo}|{}}
   */
  query(sql, bind = {}, options = {}) {
    return this.getInstance().query(sql, Object.assign({
      type: this.getSequelize().QueryTypes.SELECT
    }, options, { bind }));
  }

  getTransaction(options = {}) {
    return this.getInstance().transaction(Object.assign({
      autocommit: true
    }, options));
  }

  /**
   * @returns {Sequelize}
   */
  getSequelize() {
    return Sequelize;
  }

  /**
   * @returns {Sequelize}
   */
  getInstance() {
    this.init();
    return sequelize;
  }

  /**
   * @param name
   * @returns {Sequelize}
   */
  get(name) {
    this.init();
    return entities[name];
  }

  /**
   * @returns {Object}
   */
  getAll() {
    this.init();
    return entities;
  }
};
