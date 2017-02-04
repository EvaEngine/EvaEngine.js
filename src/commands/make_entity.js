import _ from 'lodash';
import Sequelize from 'sequelize';
import fs from 'fs';
import mkdirp from 'mkdirp';
import Command from './interface';
import DI from '../di';

export default class MakeEntityCommand extends Command {
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
    // console.log(_type, sequlizeType)
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
      });
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
    const sequelize = new Sequelize(config.db.database, null, null,
      Object.assign({}, config.sequelize, config.db, { logging: logger.getInstance().verbose })
    );
    const query = sequelize.getQueryInterface();

    const tables = await query.showAllTables();
    const { dir, timestamp = true } = this.getArgv();

    const path = dir ? `${process.cwd()}/${dir}` : `${process.cwd()}/src/entities`;
    const schemaPath = `${path}/schemas`;
    const entityTemplate = fs.readFileSync(`${__dirname}/../../template/entity.ejs`, 'utf8');
    const schemaTemplate = fs.readFileSync(`${__dirname}/../../template/schema.ejs`, 'utf8');
    mkdirp.sync(path);
    mkdirp.sync(schemaPath);

    logger.info('Start generate DB schemas to dir %s', path);

    const tableHandler = async(table) => {
      const columns = await query.describeTable(table);
      const rawColumns = await sequelize.query(`SHOW FULL COLUMNS FROM ${table}`, {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      });
      Object.values(rawColumns).forEach((rawColumn) => {
        const columnName = rawColumn.Field;
        columns[columnName].type = MakeEntityCommand.typeAdditional(
          columns[columnName].type,
          MakeEntityCommand.typeMapping(columns[columnName].type),
          rawColumn
        );
        columns[columnName].unique = rawColumn.Key === 'UNI';
        columns[columnName].comment = rawColumn.Comment;
        columns[columnName].autoIncrement = rawColumn.Extra.startsWith('auto_increment') === true;
      });

      const indexes = await MakeEntityCommand.getIndexes(table, sequelize);
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
    await Promise.all(Object.values(tables).filter(t => t !== 'sequelizemeta').map(tableHandler));
    logger.info('All DB schemas generated');
  }
}
