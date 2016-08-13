import _ from 'lodash';
import { InvalidArgumentException } from '../exceptions';

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
  constructor(queryCase = SNAKE_CASE, fieldCase = CAMEL_CASE) {
    this.queryCase = queryCase;
    this.fieldCase = fieldCase;
    this.fields = [];
  }

  setFields(fields = [], defaultOrderField = null, defaultOrder = ORDER_DESC) {
    this.fields = fields;
    this.defaultOrderField = defaultOrderField;
    this.defaultOrder = defaultOrder;
  }

  getAvailableOrders() {
    const fields = this.fields;
    const queryCase = this.queryCase;
    const orders = {};
    fields.forEach((field) => {
      const ascKey = queryCase === SNAKE_CASE ? _.snakeCase(field) : _.camelCase(field);
      const descKey = `-${ascKey}`;
      orders[ascKey] = [field, ORDER_ASC];
      orders[descKey] = [field, ORDER_DESC];
    });
    return orders;
  }

  /**
   * Return sequelize order array
   * @param queryString
   * @returns {*}
   */
  getOrderByQuery(queryString) {
    if (!queryString) {
      if (this.defaultOrderField) {
        return [[this.defaultOrderField, this.defaultOrder]];
      }
      return [];
    }
    const queryArray = queryString.split(',');
    const orders = this.getAvailableOrders();
    const orderArray = [];
    queryArray.forEach(query => {
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

export const supportOperators = {
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

const operatorMapping = {
  string: [],
  number: ['$gte', '$lte'],
  date: ['$gte', '$lte'],
  'date-time': ['$gte', '$lte']
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
  constructor(queryCase = SNAKE_CASE, fieldCase = CAMEL_CASE) {
    this.queryCase = queryCase;
    this.fieldCase = fieldCase;
    this.schema = {};
  }

  addFilterSchema(name, type = FILTER_TYPE_STRING, options = {}) {
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
    const schema = {
      type,
      description,
      operators,
      defaultValue,
      enumerate
    };
    this.schema[name] = schema;
    return this;
  }

  getFilterSchema() {
    return this.schema;
  }

  setFilterSchema(schema) {
    //TODO: add check
    this.schema = schema;
    return this;
  }

  getFieldAndOperator(key) {
    const keyArray = key.split('_');
    let operator = keyArray.pop();
    let field = key;
    if (Object.values(supportOperators).includes(operator) === true) {
      field = keyArray.join('_');
    } else {
      operator = null;
    }

    if (this.fieldCase === CAMEL_CASE) {
      field = _.camelCase(field);
    } else {
      field = _.snakeCase(field);
    }
    return [field, operator];
  }

  getConditions(query) {
    const conditions = {};
    const schema = this.schema;
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
        conditions[field][operator] = value;
        continue;
      }

      throw new InvalidArgumentException('Condition conflict');
    }
    return conditions;
  }

  getConditionsByString(queryString, baseWhere = {}) {
    return _.merge(baseWhere, JSON.parse(queryString));
  }
}
