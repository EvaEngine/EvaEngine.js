import groupBy from 'lodash/groupBy.js';
import template from 'lodash/template.js';
import Sequelize from 'sequelize';
import fs from 'fs';
import Command from './interface.ts';
import DI from '../di.ts';
import Entities from '../entities/index.ts';
import type { Dictionary } from 'lodash';

// sequelize 6 自带类型仅具名导出 Sequelize 类，运行时 CJS 默认导出即类本身，按运行时形态声明构造签名
type SequelizeCtor = new (
  database: string,
  username: string | null,
  password: string | null,
  options?: object
) => import('sequelize').Sequelize;
// QueryTypes 由 sequelize.prototype 挂载到实例上（lib/sequelize.js），类型声明缺失需随实例补充
type SequelizeInstance = import('sequelize').Sequelize & {
  QueryTypes: typeof import('sequelize').QueryTypes;
};

interface RawColumn {
  Field: string;
  Key: string;
  Comment: unknown;
  Collation: unknown;
  Extra: string;
  [key: string]: unknown;
}

interface IndexRow {
  Key_name: string;
  Non_unique: number;
  Column_name: string;
  [key: string]: unknown;
}

// describeTable 的 ColumnDescription 不含运行时写入的扩展字段，按可回写形态收窄
interface GeneratedColumn {
  type: string;
  unique?: boolean;
  comment?: unknown;
  autoIncrement?: boolean;
  [key: string]: unknown;
}

interface GeneratedIndex {
  name: string;
  unique?: boolean;
  fields?: string[];
}

export class MakeDbView extends Command {
  static override getName(): string {
    return 'make:dbview';
  }

  static override getDescription(): string {
    return 'Generate db views';
  }

  static override getSpec(): object {
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

  getSql(tableName: string, attributes: Array<{ fieldName: string }>): string {
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

  override async run(): Promise<void> {
    const logger = DI.get('logger');
    const { dir, entity_path: entityPath = `${process.cwd()}/build/entities` } = this.getArgv();
    const path = dir ? `${process.cwd()}/${dir}` : `${process.cwd()}/sql`;
    const file = [path, 'views.sql'].join('/');
    logger.info('Scan entity files under %s', entityPath);
    const entities = new Entities(entityPath as string);

    logger.info('Start generate db views to %s', file);
    fs.mkdirSync(path, { recursive: true });
    const models = Object.values(entities.getInstance().models);
    const sql: string[] = [];
    models.forEach((model) => {
      //运行时 model.attributes 携带 fieldName、getTableName 为静态方法；sequelize 类型未完整声明
      const entityModel = model as unknown as {
        getTableName(): string;
        attributes: Record<string, { fieldName: string }>;
      };
      logger.info(`Creating ${entityModel.getTableName()} view`);
      sql.push(this.getSql(entityModel.getTableName(), Object.values(entityModel.attributes)));
    });

    fs.writeFileSync(file, sql.join(''));
    logger.info('Views created');
  }
}

export class MakeEntity extends Command {
  static override getName(): string {
    return 'make:entity';
  }

  static override getDescription(): string {
    return 'Generate entities';
  }

  static override getSpec(): object {
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

  static typeMapping(_type: string): string {
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

  static typeAdditional(_type: string, sequlizeType: string, rawColumn: RawColumn): string {
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

  static async getIndexes(tableName: string, sequelize: SequelizeInstance): Promise<GeneratedIndex[]> {
    let rawIndexes: IndexRow[] | Dictionary<IndexRow[]> = await sequelize.query<IndexRow>(
      `SHOW INDEX FROM ${tableName}`,
      {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      }
    );
    if (!rawIndexes) {
      return [];
    }
    rawIndexes = groupBy(rawIndexes, 'Key_name');
    return Object.entries(rawIndexes).filter(([key]) => key !== 'PRIMARY').map(([name, columns]) => {
      const index: GeneratedIndex = columns[0].Non_unique !== 1 ? { name, unique: true } : { name };
      index.fields = columns.map(c => c.Column_name);
      return index;
    });
  }

  override async run(): Promise<void> {
    const config = DI.get('config').get() as {
      db: { database: string; [key: string]: unknown };
      sequelize: object;
    };
    const logger = DI.get('logger');
    const sequelize = new (Sequelize as unknown as SequelizeCtor)(
      config.db.database,
      null,
      null,
      Object.assign({}, config.sequelize, config.db, { logging: logger.getInstance().verbose })
    ) as SequelizeInstance;
    const query = sequelize.getQueryInterface();

    let tables = await query.showAllTables();
    const views = await sequelize.query<Record<string, unknown>>(`SHOW FULL TABLES IN ${config.db.database} WHERE TABLE_TYPE LIKE 'VIEW'`, {
      type: sequelize.QueryTypes.SELECT,
      raw: true
    });
    if (views) {
      const viewNames = views.map(v => Object.values(v)[0]);
      tables = tables.filter(t => !viewNames.includes(t));
    }
    const { dir, timestamp = true, prefix } = this.getArgv();
    if (prefix) {
      tables = tables.filter(t => t.startsWith(prefix as string));
    }

    const path = dir ? `${process.cwd()}/${dir}` : `${process.cwd()}/src/entities`;
    const schemaPath = `${path}/schemas`;
    const entityTemplate = fs.readFileSync(`${import.meta.dirname}/../../template/entity.ejs`, 'utf8');
    const schemaTemplate = fs.readFileSync(`${import.meta.dirname}/../../template/schema.ejs`, 'utf8');
    fs.mkdirSync(path, { recursive: true });
    fs.mkdirSync(schemaPath, { recursive: true });

    logger.info('Start generate DB schemas to dir %s', path);

    const tableHandler = async (table: string) => {
      //describeTable 的 ColumnsDescription 与可回写形态不直接可比，运行时字段同源
      const columns = (await query.describeTable(table)) as unknown as Record<string, GeneratedColumn>;
      const rawColumns = await sequelize.query<RawColumn>(`SHOW FULL COLUMNS FROM ${table}`, {
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
      } catch {
        fs.writeFileSync(entityFile, template(entityTemplate)({ table }));
        logger.info('Entity file %s generated as %s', table, entityFile);
      }

      try {
        fs.accessSync(schemaFile);
        logger.info('Schema file %s generate override, already exists by %s', table, schemaFile);
      } catch {
        logger.info('Schema file %s generated as %s', table, schemaFile);
      }
      //argv 值为 unknown；parseInt 对非字符串（如默认 true）按原语义得到 NaN
      fs.writeFileSync(schemaFile, template(schemaTemplate)({
        columns,
        table,
        indexes,
        timestamp: parseInt(timestamp as string, 10) > 0
      }));
    };

    //Skip sequelize migrate table
    await Promise.all(Object.values(tables).filter(t => !['sequelizemeta', 'tramp_migrations'].includes(t)).map(tableHandler));
    logger.info('All DB schemas generated');
  }
}

export class MakeGraphql extends Command {
  static override getName(): string {
    return 'make:graphql';
  }

  static override getDescription(): string {
    return 'Generate graphql schema';
  }

  static override getSpec(): object {
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

  // 原调用传入 mappedTableName 但未使用（JS 实参多于形参），可选参数保持调用形态且不改变函数 length
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static typeMapping(_type: string, _mappedTableName?: string): string {
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

  getEnums(_type: string, columnName: string, tableName: string): { name: string; values: string[] } {
    const type = _type.toLowerCase();
    const values = type.slice(5, -1).split(',').map(v => v.slice(1, -1));
    return {
      name: `ENUM_${tableName}_${columnName}`,
      values
    };
  }

  override async run(): Promise<void> {
    const config = DI.get('config').get() as {
      db: { database: string; [key: string]: unknown };
      sequelize: object;
    };
    const logger = DI.get('logger');
    const sequelize = new (Sequelize as unknown as SequelizeCtor)(
      config.db.database,
      null,
      null,
      Object.assign({}, config.sequelize, config.db, { logging: logger.getInstance().verbose })
    ) as SequelizeInstance;
    const query = sequelize.getQueryInterface();

    let tables = await query.showAllTables();
    const views = await sequelize.query<Record<string, unknown>>(`SHOW FULL TABLES IN ${config.db.database} WHERE TABLE_TYPE LIKE 'VIEW'`, {
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
      tables = tables.filter(t => t.startsWith(prefix as string));
    }

    const path = dir ? `${process.cwd()}/${dir}` : `${process.cwd()}/src/graphql`;
    const schemaPath = `${path}/entities`;
    const schemaTemplate = fs.readFileSync(`${import.meta.dirname}/../../template/graphql.ejs`, 'utf8');
    const mappingFile = mapping ? `${process.cwd()}/${mapping}` : `${process.cwd()}/src/graphql/mapping.json`;
    const mappingContent: Record<string, string> = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    const getMappedTableName = (tableName: string): string =>
      (mappingContent[tableName] ? mappingContent[tableName] : tableName);
    fs.mkdirSync(path, { recursive: true });
    fs.mkdirSync(schemaPath, { recursive: true });

    logger.info('Start generate GraphQL schemas to dir %s', path);

    const tableHandler = async (tableName: string) => {
      const enums: Array<{ name: string; values: string[] }> = [];
      //describeTable 的 ColumnsDescription 与可回写形态不直接可比，运行时字段同源
      const columns = (await query.describeTable(tableName)) as unknown as Record<string, GeneratedColumn>;
      const rawColumns = await sequelize.query<RawColumn>(`SHOW FULL COLUMNS FROM ${tableName}`, {
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
      } catch {
        logger.info('Graphql schema file %s generated as %s', tableName, schemaFile);
      }
      fs.writeFileSync(schemaFile, template(schemaTemplate)({
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
