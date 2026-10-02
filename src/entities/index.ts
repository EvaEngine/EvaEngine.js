import fs from 'fs';
import path from 'path';
import assert from 'assert';
import cloneDeep from 'lodash/cloneDeep.js';
import { Sequelize, Op, QueryTypes } from 'sequelize';
import type {
  DataTypes,
  Model,
  ModelStatic,
  QueryOptions,
  Transaction,
  TransactionOptions,
  Options as SequelizeOptions
} from 'sequelize';
import { createRequire } from 'module';
import DI from '../di.ts';
import { getMicroTimestamp } from '../utils/index.ts';
import { StandardException } from '../exceptions/index.ts';

const require = createRequire(import.meta.url);

//From https://github.com/angelxmoreno/sequelize-isunique-validator
//sequelize 自带类型未声明该原型方法，这里仅做类型层收窄，运行时补丁逻辑保持不变
type UniqueValidatorModel = {
  Model: {
    describe(): Promise<Record<string, { primaryKey?: boolean }>>;
    count(conditions: unknown): Promise<number>;
  };
  [key: string]: unknown;
};

(Sequelize.prototype as unknown as {
  validateIsUnique: (col: string, msg?: string) => (
    this: UniqueValidatorModel, value: unknown, next: (err?: unknown) => void
  ) => void;
}).validateIsUnique = (col, msg) => {
  const conditions: { where: Record<string, unknown> } = { where: {} };
  const message = msg || `${col} must be unique`;
  return function v(this: UniqueValidatorModel, value: unknown, next: (err?: unknown) => void) {
    //原实现的 this 别名，闭包内沿用
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.Model.describe().then((schema) => {
      conditions.where[col] = value;
      Object
        .keys(schema)
        .filter(field => schema[field].primaryKey)
        .forEach((pk) => {
          conditions.where[pk] = { [Op.ne]: self[pk] };
        });
    }).then(() =>
      self.Model.count(conditions).then((found) => {
        if (found !== 0) {
          return next(message);
        }
        return next();
      })).catch(next);
  };
};

type EntityFactory = (sequelize: Sequelize, dataTypes: typeof Sequelize) => EntityModel;

//扫描到的实体是 Sequelize 模型类，保留完整静态查询能力；associate 是真实扩展点
type EntityModel = ModelStatic<Model> & {
  associate?: (entities: Record<string, EntityModel>) => void;
};

//运行时 Sequelize 类挂载了 DataTypes/Op/QueryTypes 等静态属性，但上游声明未暴露，作为兼容入口显式补齐
type SequelizeStatic = typeof Sequelize & {
  DataTypes: typeof DataTypes;
  Op: typeof Op;
  QueryTypes: typeof QueryTypes;
};

export default class Entities {
  entitiesPath: string;
  sequelize: Sequelize | (() => Sequelize) | null;
  entities: Record<string, EntityModel>;
  scanned: boolean;

  constructor(entitiesPath: string, sequelizeInstance: Sequelize | (() => Sequelize) | null = null) {
    this.entitiesPath = entitiesPath;
    this.sequelize = sequelizeInstance;
    this.entities = {};
    this.scanned = false;
  }

  /**
   * Add tracer info to end of SQL query logging
   */
  static addTracer(options: Record<string, unknown> = {}) {
    return Object.assign(options, {
      benchmark: true,
      logging: (...args: unknown[]) => {
        // namespace.get 返回 unknown，sequelize 回调里只使用 queries 数组
        const tracer = DI.get('namespace').get('tracer') as { queries: unknown[] } | undefined;
        const [query, cost] = args;
        // sequelize 在 benchmark 模式下以 (sql, 耗时 ms) 调用 logging，cost 为 unknown 时与原实现同样按假值/NaN 处理
        if (tracer && (cost as number) > 0) {
          tracer.queries.push({
            query,
            cost: (cost as number) * 1000,
            finishedAt: getMicroTimestamp()
          });
        }
      }
    });
  }

  /**
   * Scan all entity schemas under a special path
   */
  scan(entitiesPath: string, withAssociate = true) {
    assert(this.sequelize && this.sequelize instanceof Sequelize, 'Scan entities require a sequelize instance');
    // assert 收窄后的引用提为局部变量，供下方闭包使用
    const sequelize = this.sequelize;

    fs
      .readdirSync(entitiesPath)
      .filter((file) => {
        const fileArray = file.split('.');
        // split('.') 至少产生一段，pop() 不会返回 undefined
        return (file.indexOf('.') !== 0) &&
          (['js', 'es6', 'cjs'].indexOf(fileArray.pop() as string) !== -1) && (fileArray[0] !== 'index');
      })
      .forEach((file) => {
        const entityModule: unknown = require(path.join(entitiesPath, file));
        const entityFactory = ((entityModule as { default?: unknown }).default || entityModule) as
          EntityFactory | EntityModel;
        // 模型类同样满足 typeof 'function'（带构造签名），运行时保持原判定：仅工厂被调用
        const entity = typeof entityFactory === 'function' ?
          (entityFactory as EntityFactory)(sequelize, Sequelize) : entityFactory;
        this.entities[entity.name] = entity;
      });

    if (!withAssociate) {
      return this;
    }

    Object.values(this.entities).forEach((entity) => {
      if ('associate' in entity) {
        entity.associate!(this.entities);
      }
    });
    return this;
  }

  /**
   * Init sequelize instance from DI config
   */
  init(withAssociate = true) {
    if (this.sequelize && this.scanned) {
      return this.sequelize;
    }

    const logger = DI.get('logger').getInstance();
    if (!this.sequelize) {
      // Config.get 公共签名返回 unknown，这里只消费 db 与 sequelize 两个配置段
      const config = DI.get('config').get() as {
        db: { database: string } & Record<string, unknown>;
        sequelize?: Record<string, unknown>;
      };
      const ns = DI.get('namespace');
      if (ns.isEnabled()) {
        //Inject sequelize inner namespace, refer: http://docs.sequelizejs.com/en/latest/docs/transactions/
        const context = ns.use().getContext() as object;
        if (typeof Sequelize.useCLS === 'function') {
          Sequelize.useCLS(context);
        } else {
          // 老版本回退分支；sequelize 自带类型未声明 cls 静态属性
          (Sequelize as unknown as { cls: unknown }).cls = context;
        }
      }

      const dbConfig: Record<string, unknown> = cloneDeep(config.db);
      if (process.env.SEQUELIZE_REPLICATION_CONFIG_KEY) {
        dbConfig.replication = dbConfig[process.env.SEQUELIZE_REPLICATION_CONFIG_KEY as string];
      }
      const sequelizeOptions = Object.assign({}, config.sequelize, dbConfig);
      if (sequelizeOptions.logging !== false) {
        Object.assign(sequelizeOptions, Entities.addTracer());
      }
      // sequelize 类型声明 username/password 为必填 string；运行时保留原 null 实参
      this.sequelize = new Sequelize(
        config.db.database, null as unknown as string, null as unknown as string,
        sequelizeOptions as unknown as SequelizeOptions
      );
    } else {
      this.sequelize = typeof this.sequelize === 'function' ? this.sequelize() : this.sequelize;
    }

    this.scan(this.entitiesPath, withAssociate);
    this.scanned = true;

    logger.debug('Entities init by scanned %s', this.entitiesPath);
    return this;
  }

  /**
   * Shortcut for Sequelize query
   */
  query(sql: string, bind: Record<string, unknown> = {}, options: QueryOptions = {}): Promise<unknown> {
    return this.getInstance().query(sql, Object.assign({
      type: QueryTypes.SELECT
    }, options, { bind }));
  }

  /**
   * A shortcut to prevent repeat insert
   */
  uniqueInsert({
    tableName,
    input,
    uniqueCondition,
    transaction
  }: {
    tableName: string;
    input: Record<string, unknown>;
    uniqueCondition: string | Record<string, unknown>;
    transaction?: Transaction;
  }, options: QueryOptions = {}) {
    const inputObj = Object.assign({}, input);
    const typeAllowed = ['number', 'string', 'boolean'];
    Object.entries(inputObj).forEach((p) => {
      const valType = typeof p[1];
      //Allow null type here
      if (typeAllowed.indexOf(valType) === -1 && p[1] !== null) {
        throw new StandardException(`SQL inputObj ${p[0]}:${p[1]} with unsupported type ${valType}.`);
      } else if (valType === 'boolean') {
        if (p[1] === true) {
          inputObj[p[0]] = 1;
        } else {
          inputObj[p[0]] = 0;
        }
      }
    });
    const columns = Object.keys(inputObj);
    const columnString = ['`', columns.join('`, `'), '`'].join('');
    const valueString = Object.entries(inputObj).map(([key]) => `$${key} \`${key}\``).join(' , ');
    // sequelize 自带类型未声明实例的 dialect 属性
    const uniqueString = typeof uniqueCondition === 'string' ? uniqueCondition :
      [`SELECT * FROM ${tableName} WHERE `, (this.getInstance() as unknown as {
        dialect: {
          QueryGenerator: { getWhereConditions(where: unknown): string };
        };
      }).dialect.QueryGenerator.getWhereConditions(uniqueCondition)].join('');
    /*
     Original Example:
     entities.getInstance().query(`INSERT INTO ${tableName}
     (userId, status)
     (
     SELECT *
     FROM (SELECT $userId userId, $status status) AS tmp
     WHERE NOT EXISTS (
     SELECT id FROM ${auditTable} WHERE userId = $userId AND status = 'pending'
     ) LIMIT 1
     )`, { bind, transaction, type: entities.getSequelize().QueryTypes.INSERT });
     */

    const sql = `INSERT INTO ${tableName}
      (${columnString})
      (
        SELECT *
        FROM (SELECT ${valueString}) AS tmp
        WHERE NOT EXISTS (
          ${uniqueString} FOR UPDATE
        ) LIMIT 1
      )`; //add FOR UPDATE to use eXclusive Lock
    return this.getInstance().query(sql, Object.assign({
      bind: inputObj,
      transaction,
      type: QueryTypes.INSERT
    }, options));
  }

  /**
   * A short cut to start a database transaction
   */
  getTransaction(options: TransactionOptions = {}) {
    return this.getInstance().transaction(Object.assign({
      autocommit: true
    }, options));
  }

  getSequelize(): SequelizeStatic {
    return Sequelize as SequelizeStatic;
  }

  getInstance(): Sequelize {
    this.init();
    // scan() 内的 instanceof 断言保证 init() 之后必为 Sequelize 实例
    return this.sequelize as Sequelize;
  }

  get<T extends EntityModel = EntityModel>(name: string): T {
    this.init();
    return this.entities[name] as T;
  }

  getAll(): Record<string, EntityModel> {
    this.init();
    return this.entities;
  }
}
