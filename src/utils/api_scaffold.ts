import merge from 'lodash/merge.js';
import snakeCase from 'lodash/snakeCase.js';
import camelCase from 'lodash/camelCase.js';
import { InvalidArgumentException } from '../exceptions/index.ts';

const SNAKE_CASE = 'snake';
const CAMEL_CASE = 'camel';
const ORDER_ASC = 'ASC';
const ORDER_DESC = 'DESC';

export const queryCases = [
  SNAKE_CASE,
  CAMEL_CASE
];

export const supportOrders = [
  ORDER_ASC,
  ORDER_DESC
];

/**
 * Convert query string (snake case or camel case) to DB order array
 * Support convert:
 * id => [['id', 'ASC']]
 * -created_at => [['createdAt', 'DESC']]
 * -id,created_at => [['id', 'DESC'], ['createdAt', 'ASC']]
 */
export class OrderScaffold {
  queryCase: string;
  fieldCase: string;
  fields: string[];
  // defaultOrderField/defaultOrder 仅由 setFields 写入，constructor 不初始化（与原实现一致）
  defaultOrderField!: string | null;
  defaultOrder!: string;

  constructor(queryCase: string = SNAKE_CASE, fieldCase: string = CAMEL_CASE) {
    this.queryCase = queryCase;
    this.fieldCase = fieldCase;
    this.fields = [];
  }

  setFields(fields: string[] = [], defaultOrderField: string | null = null, defaultOrder: string = ORDER_DESC) {
    this.fields = fields;
    this.defaultOrderField = defaultOrderField;
    this.defaultOrder = defaultOrder;
  }

  getAvailableOrders(): Record<string, [string, string]> {
    const { fields } = this;
    const { queryCase } = this;
    const orders: Record<string, [string, string]> = {};
    fields.forEach((field) => {
      const ascKey = queryCase === SNAKE_CASE ? snakeCase(field) : camelCase(field);
      const descKey = `-${ascKey}`;
      orders[ascKey] = [field, ORDER_ASC];
      orders[descKey] = [field, ORDER_DESC];
    });
    return orders;
  }

  /**
   * Return sequelize order array
   */
  getOrderByQuery(queryString?: string | null): [string, string][] {
    if (!queryString) {
      if (this.defaultOrderField) {
        return [[this.defaultOrderField, this.defaultOrder]];
      }
      return [];
    }
    const queryArray = queryString.split(',');
    const orders = this.getAvailableOrders();
    const orderArray: [string, string][] = [];
    queryArray.forEach((query) => {
      if (Object.keys(orders).includes(query) === true) {
        orderArray.push(orders[query]);
      }
    });
    if (orderArray.length > 0) {
      return orderArray;
    }

    if (this.defaultOrderField) {
      return [[this.defaultOrderField, this.defaultOrder]];
    }
    return [];
  }
}

const FILTER_TYPE_STRING = 'string';
const FILTER_TYPE_NUMBER = 'number';

export const filterTypes = {
  [FILTER_TYPE_STRING]: FILTER_TYPE_STRING,
  [FILTER_TYPE_NUMBER]: FILTER_TYPE_NUMBER
};

export const supportOperators: Record<string, string> = {
  not: '$not',
  like: '$like',
  notLike: '$notLike',
  in: '$in',
  notIn: '$notIn',
  ne: '$ne',
  gt: '$gt',
  gte: '$gte',
  lt: '$lt',
  lte: '$lte',
  between: '$between',
  notBetween: '$notBetween'
};

const operatorMapping: Record<string, string[]> = {
  string: [],
  number: ['$gte', '$lte'],
  date: ['$gte', '$lte'],
  'date-time': ['$gte', '$lte']
};

type FilterSchemaOptions = {
  format?: string | null;
  description?: string | null;
  defaultValue?: unknown;
  enumerate?: unknown[] | null;
  operators?: string[] | null;
};

type FilterSchemaEntry = {
  type: string;
  description: string | null;
  operators: string[];
  defaultValue: unknown;
  enumerate: unknown[] | null;
};

/**
 * Filter Schema: {
 *  name: 'id',
 *  description: 'foo',
 *  type: 'string',
 *  format: 'date',
 *  operators: ['$like'],
 *  defaultValue: 0,
 *  enumerate: [1, 2, 3]
 * }
 */

/**
 * Convert url queries to DB where conditions (JSON object)
 * DB where conditions format as same as sequelize where querying:
 * http://docs.sequelizejs.com/en/latest/docs/querying/#where
 *
 * URL query could be:
 * Key-Value object
 */
export class FilterScaffold {
  queryCase: string;
  fieldCase: string;
  schema: Record<string, FilterSchemaEntry>;

  constructor(queryCase: string = SNAKE_CASE, fieldCase: string = CAMEL_CASE) {
    this.queryCase = queryCase;
    this.fieldCase = fieldCase;
    this.schema = {};
  }

  addFilterSchema(name: string, type: string = FILTER_TYPE_STRING, options: FilterSchemaOptions = {}) {
    let mappingKey = type;
    if (Object.keys(filterTypes).includes(type) === false) {
      mappingKey = FILTER_TYPE_STRING;
    }
    const {
      format = null,
      description = null,
      defaultValue = null,
      enumerate = null
    } = options;
    mappingKey = format || mappingKey;
    let { operators = null } = options;
    if (!operators) {
      operators = operatorMapping[mappingKey];
    }
    const schema: FilterSchemaEntry = {
      type,
      description,
      operators,
      defaultValue,
      enumerate
    };
    this.schema[name] = schema;
    return this;
  }

  getFilterSchema(): Record<string, FilterSchemaEntry> {
    return this.schema;
  }

  setFilterSchema(schema: Record<string, FilterSchemaEntry>) {
    //TODO: add check
    this.schema = schema;
    return this;
  }

  getFieldAndOperator(key: string): [string, string | null] {
    const keyArray = key.split('_');
    // split 结果至少含一个元素，pop 不会返回 undefined
    let operator: string | null = keyArray.pop()!;
    let field = key;
    if (Object.values(supportOperators).includes(operator as string) === true) {
      field = keyArray.join('_');
    } else {
      operator = null;
    }

    if (this.fieldCase === CAMEL_CASE) {
      field = camelCase(field);
    } else {
      field = snakeCase(field);
    }
    return [field, operator];
  }

  getConditions(query: Record<string, unknown>): Record<string, unknown> {
    const conditions: Record<string, unknown> = {};
    const { schema } = this;
    const schemaKeys = Object.keys(schema);

    for (const [key, value] of Object.entries(query)) {
      if (value === null) {
        continue;
      }

      const [field, operator] = this.getFieldAndOperator(key);
      if (schemaKeys.includes(field) === false) {
        continue;
      }

      const schemaAllowOperators = schema[field].operators;
      if (operator && !schemaAllowOperators.includes(operator)) {
        continue;
      }

      if ({}.hasOwnProperty.call(conditions, field) === false) {
        if (!operator) {
          conditions[field] = value;
        } else {
          conditions[field] = { [operator]: value };
        }
        continue;
      }

      if (operator && typeof conditions[field] === 'object') {
        // 已知 conditions[field] 是本方法构造的普通对象，这里只做收窄不改运行时
        (conditions[field] as Record<string, unknown>)[operator] = value;
        continue;
      }

      throw new InvalidArgumentException('Condition conflict');
    }
    return conditions;
  }

  getConditionsByString(queryString: string, baseWhere: Record<string, unknown> = {}): Record<string, unknown> {
    return merge(baseWhere, JSON.parse(queryString));
  }
}
