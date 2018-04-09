import _ from 'lodash';
import Sequelize from 'sequelize';
import fs from 'fs';
import mkdirp from 'mkdirp';
import Command from './interface';
import DI from '../di';
import Entities from '../entities';


export class MakeDbView extends Command {
  static getName() {
    return 'make:dbview';
  }

  static getDescription() {
    return 'Generate db views';
  }

  static getSpec() {
    return {
      entity_path: {
        required: false,
        description: 'Entity path'
      },
      dir: {
        required: false,
        description: 'Where view.sql to be generated'
      }
    };
  }

  getSql(tableName, attributes) {
    const attrs = attributes.map((attr) => {
      const { fieldName } = attr;
      if (fieldName.endsWith('At')) {
        return ` FROM_UNIXTIME(IF(${fieldName} > 0, ${fieldName}, NULL)) AS ${fieldName}`;
      }
      return ` \`${fieldName}\` AS \`${fieldName}\``;
    });
    return `DROP VIEW IF EXISTS view_${tableName};
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW view_${tableName}
    AS SELECT
      ${attrs.join(',\n      ')}
    FROM ${tableName};

`;
  }

  async run() {
    const logger = DI.get('logger');
    const { dir, entity_path: entityPath = `${process.cwd()}/build/entities` } = this.getArgv();
    const path = dir ? `${process.cwd()}/${dir}` : `${process.cwd()}/sql`;
    const file = [path, 'views.sql'].join('/');
    logger.info('Scan entity files under %s', entityPath);
    const entities = new Entities(entityPath);

    logger.info('Start generate db views to %s', file);
    mkdirp.sync(path);
    const models = Object.values(entities.getInstance().models);
    const sql = [];
    models.forEach((model) => {
      logger.info(`Creating ${model.getTableName()} view`);
      sql.push(this.getSql(model.getTableName(), Object.values(model.attributes)));
    });

    fs.writeFileSync(file, sql.join(''));
    logger.info('Views created');
  }
}

export class MakeEntity extends Command {
  static getName() {
    return 'make:entity';
  }

  static getDescription() {
    return 'Generate entities';
  }

  static getSpec() {
    return {
      timestamp: {
        required: false,
        description: 'Sequelize timestamp enabled'
      },
      dir: {
        required: false,
        description: 'Where entity files to be generated'
      },
      prefix: {
        required: false,
        description: 'Table prefix'
      }
    };
  }

  static typeMapping(_type) {
    const type = _type.toLowerCase();
    if (type === 'tinyint(1)' || type === 'boolean' || type === 'bit(1)') {
      return 'DataTypes.BOOLEAN';
    }

    if (type.match(/^(smallint|mediumint|tinyint|int)/)) {
      const length = type.match(/\(\d+\)/) || '';
      return `DataTypes.INTEGER${length}`;
    }

    if (type.startsWith('bigint')) {
      return 'DataTypes.BIGINT';
    }
    if (type.startsWith('enum')) {
      return type.replace('enum', 'DataTypes.ENUM').replace(/,/g, ', ');
    }

    if (type.match(/^string|varchar|varying|nvarchar/)) {
      const length = type.match(/\(\d+\)/) || '';
      return length ? `DataTypes.STRING${length}` : 'DataTypes.STRING';
    }

    if (type.startsWith('char')) {
      const length = type.match(/\(\d+\)/) || '';
      return `DataTypes.CHAR${length}`;
    }

    if (type.match(/text|ntext$/)) {
      return 'DataTypes.TEXT';
    }

    if (type.startsWith('year')) {
      return 'DataTypes.INTEGER(4)';
    }

    if (type.startsWith('datetime')) {
      return 'DataTypes.DATE';
    }

    if (type.startsWith('date')) {
      return 'DataTypes.DATEONLY';
    }

    if (type.startsWith('time')) {
      return 'DataTypes.TIME';
    }

    if (type.match(/^(float8|double precision)/)) {
      return 'DataTypes.DOUBLE';
    }

    if (type.match(/^(float|float4)/)) {
      return 'DataTypes.FLOAT';
    }

    if (type.startsWith('decimal')) {
      const [, length, bits] = /\((\d+),(\d+)\)/g.exec(type) || [];
      return length ? `DataTypes.DECIMAL(${length}, ${bits})` : 'DataTypes.DECIMAL';
    }

    if (type.match(/^uuid|uniqueidentifier/)) {
      return 'DataTypes.UUIDV4';
    }

    if (type.startsWith('jsonb')) {
      return 'DataTypes.JSONB';
    }
    if (type.startsWith('json')) {
      return 'DataTypes.JSON';
    }

    if (type.startsWith('geometry')) {
      return 'DataTypes.GEOMETRY';
    }

    return type;
  }

  static typeAdditional(_type, sequlizeType, rawColumn) {
    const type = _type.toLowerCase();
    let finalType = sequlizeType;

    if (type.match(/unsigned/)) {
      finalType += '.UNSIGNED';
    }

    if (type.match(/zerofill/)) {
      finalType += '.ZEROFILL';
    }

    if (rawColumn.Collation === 'utf8_bin') {
      finalType += '.BINARY';
    }
    return finalType;
  }

  static async getIndexes(tableName, sequelize) {
    let rawIndexes = await sequelize.query(
      `SHOW INDEX FROM ${tableName}`,
      {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      }
    );
    if (!rawIndexes) {
      return [];
    }
    rawIndexes = _.groupBy(rawIndexes, 'Key_name');
    return Object.entries(rawIndexes).filter(([key]) => key !== 'PRIMARY').map(([name, columns]) => {
      const index = columns[0].Non_unique !== 1 ? { name, unique: true } : { name };
      index.fields = columns.map(c => c.Column_name);
      return index;
    });
  }

  async run() {
    const config = DI.get('config').get();
    const logger = DI.get('logger');
    const sequelize = new Sequelize(
      config.db.database,
      null,
      null,
      Object.assign({}, config.sequelize, config.db, { logging: logger.getInstance().verbose })
    );
    const query = sequelize.getQueryInterface();

    let tables = await query.showAllTables();
    const views = await sequelize.query(`SHOW FULL TABLES IN ${config.db.database} WHERE TABLE_TYPE LIKE 'VIEW'`, {
      type: sequelize.QueryTypes.SELECT,
      raw: true
    });
    if (views) {
      const viewNames = views.map(v => Object.values(v)[0]);
      tables = tables.filter(t => !viewNames.includes(t));
    }
    const { dir, timestamp = true, prefix } = this.getArgv();
    if (prefix) {
      tables = tables.filter(t => t.startsWith(prefix));
    }

    const path = dir ? `${process.cwd()}/${dir}` : `${process.cwd()}/src/entities`;
    const schemaPath = `${path}/schemas`;
    const entityTemplate = fs.readFileSync(`${__dirname}/../../template/entity.ejs`, 'utf8');
    const schemaTemplate = fs.readFileSync(`${__dirname}/../../template/schema.ejs`, 'utf8');
    mkdirp.sync(path);
    mkdirp.sync(schemaPath);

    logger.info('Start generate DB schemas to dir %s', path);

    const tableHandler = async (table) => {
      const columns = await query.describeTable(table);
      const rawColumns = await sequelize.query(`SHOW FULL COLUMNS FROM ${table}`, {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      });
      Object.values(rawColumns).forEach((rawColumn) => {
        const columnName = rawColumn.Field;
        columns[columnName].type = MakeEntity.typeAdditional(
          columns[columnName].type,
          MakeEntity.typeMapping(columns[columnName].type),
          rawColumn
        );
        columns[columnName].unique = rawColumn.Key === 'UNI';
        columns[columnName].comment = rawColumn.Comment;
        columns[columnName].autoIncrement = rawColumn.Extra.startsWith('auto_increment') === true;
      });

      const indexes = await MakeEntity.getIndexes(table, sequelize);
      const entityFile = `${path}/${table}.js`;
      const schemaFile = `${schemaPath}/${table}.js`;
      try {
        fs.accessSync(entityFile);
        logger.info('Entity file %s generate skipped, already exists by %s', table, entityFile);
      } catch (e) {
        fs.writeFileSync(entityFile, _.template(entityTemplate)({ table }));
        logger.info('Entity file %s generated as %s', table, entityFile);
      }

      try {
        fs.accessSync(schemaFile);
        logger.info('Schema file %s generate override, already exists by %s', table, schemaFile);
      } catch (e) {
        logger.info('Schema file %s generated as %s', table, schemaFile);
      }
      fs.writeFileSync(schemaFile, _.template(schemaTemplate)({
        columns,
        table,
        indexes,
        timestamp: parseInt(timestamp, 10) > 0
      }));
    };

    //Skip sequelize migrate table
    await Promise.all(Object.values(tables).filter(t => !['sequelizemeta', 'tramp_migrations'].includes(t)).map(tableHandler));
    logger.info('All DB schemas generated');
  }
}

export class MakeGraphql extends Command {
  static getName() {
    return 'make:graphql';
  }

  static getDescription() {
    return 'Generate graphql schema';
  }

  static getSpec() {
    return {
      dir: {
        required: false,
        description: 'Where entity files to be generated'
      },
      prefix: {
        required: false,
        description: 'Table prefix'
      },
      mapping: {
        required: false,
        description: 'Mapping file path'
      }
    };
  }

  static typeMapping(_type) {
    const type = _type.toLowerCase();
    if (type === 'tinyint(1)' || type === 'boolean' || type === 'bit(1)') {
      return 'Boolean';
    }

    if (type.match(/^(smallint|mediumint|tinyint|int)/)) {
      return 'Int';
    }

    if (type.startsWith('bigint')) {
      return 'Int';
    }

    if (type.startsWith('enum')) {
      return 'Enum';
    }

    if (type.match(/^string|varchar|varying|nvarchar/)) {
      return 'String';
    }

    if (type.startsWith('char')) {
      return 'String';
    }

    if (type.match(/text|ntext$/)) {
      return 'String';
    }

    if (type.startsWith('year')) {
      return 'Int';
    }

    if (type.startsWith('datetime')) {
      return 'String';
    }

    if (type.startsWith('date')) {
      return 'String';
    }

    if (type.startsWith('time')) {
      return 'String';
    }

    if (type.match(/^(float8|double precision)/)) {
      return 'Float';
    }

    if (type.match(/^(float|float4)/)) {
      return 'Float';
    }

    if (type.startsWith('decimal')) {
      return 'Float';
    }

    if (type.match(/^uuid|uniqueidentifier/)) {
      return 'String';
    }

    if (type.startsWith('jsonb')) {
      return 'JSON';
    }
    if (type.startsWith('json')) {
      return 'JSON';
    }

    if (type.startsWith('geometry')) {
      return 'String';
    }

    return type;
  }

  getEnums(_type, columnName, tableName) {
    const type = _type.toLowerCase();
    const values = type.slice(5, -1).split(',').map(v => v.slice(1, -1));
    return {
      name: `ENUM_${tableName}_${columnName}`,
      values
    };
  }

  async run() {
    const config = DI.get('config').get();
    const logger = DI.get('logger');
    const sequelize = new Sequelize(
      config.db.database,
      null,
      null,
      Object.assign({}, config.sequelize, config.db, { logging: logger.getInstance().verbose })
    );
    const query = sequelize.getQueryInterface();

    let tables = await query.showAllTables();
    const views = await sequelize.query(`SHOW FULL TABLES IN ${config.db.database} WHERE TABLE_TYPE LIKE 'VIEW'`, {
      type: sequelize.QueryTypes.SELECT,
      raw: true
    });
    if (views) {
      const viewNames = views.map(v => Object.values(v)[0]);
      tables = tables.filter(t => !viewNames.includes(t));
    }
    const {
      dir, prefix, mapping
    } = this.getArgv();
    if (prefix) {
      tables = tables.filter(t => t.startsWith(prefix));
    }

    const path = dir ? `${process.cwd()}/${dir}` : `${process.cwd()}/src/graphql`;
    const schemaPath = `${path}/entities`;
    const schemaTemplate = fs.readFileSync(`${__dirname}/../../template/graphql.ejs`, 'utf8');
    const mappingFile = mapping ? `${process.cwd()}/${mapping}` : `${process.cwd()}/src/graphql/mapping.json`;
    const mappingContent = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    const getMappedTableName = tableName =>
      (mappingContent[tableName] ? mappingContent[tableName] : tableName);
    mkdirp.sync(path);
    mkdirp.sync(schemaPath);

    logger.info('Start generate GraphQL schemas to dir %s', path);

    const tableHandler = async (tableName) => {
      const enums = [];
      const columns = await query.describeTable(tableName);
      const rawColumns = await sequelize.query(`SHOW FULL COLUMNS FROM ${tableName}`, {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      });
      const mappedTableName = getMappedTableName(tableName);
      Object.values(rawColumns).forEach((rawColumn) => {
        const columnName = rawColumn.Field;
        let type = MakeGraphql.typeMapping(columns[columnName].type, mappedTableName);
        if (type === 'Enum') {
          const enumObj = this.getEnums(columns[columnName].type, columnName, mappedTableName);
          type = enumObj.name;
          enums.push(enumObj);
        }

        columns[columnName].type = type;
        columns[columnName].unique = rawColumn.Key === 'UNI';
        columns[columnName].comment = rawColumn.Comment;
        columns[columnName].autoIncrement = rawColumn.Extra.startsWith('auto_increment') === true;
      });

      const indexes = await MakeEntity.getIndexes(tableName, sequelize);
      const schemaFile = `${schemaPath}/${tableName}.graphqls`;
      try {
        fs.accessSync(schemaFile);
        logger.info('Graphql schema file %s generate override, already exists by %s', tableName, schemaFile);
      } catch (e) {
        logger.info('Graphql schema file %s generated as %s', tableName, schemaFile);
      }
      fs.writeFileSync(schemaFile, _.template(schemaTemplate)({
        tableName,
        mappedTableName,
        columns,
        indexes,
        enums
      }));
    };

    //Skip sequelize migrate table
    await Promise.all(Object.values(tables).filter(t => !['sequelizemeta', 'tramp_migrations'].includes(t)).map(tableHandler));
    logger.info('All DB schemas generated');
  }
}
