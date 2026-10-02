import moment from 'moment-timezone';
import { Op } from 'sequelize';
import { InvalidArgumentException } from '../exceptions/index.ts';

// Op 的值是 sequelize 的 symbol 运算符；where 的键可能是 string 或 symbol
const OPERATORS: Record<string, PropertyKey> = {
  $eq: Op.eq,
  $like: Op.like,
  $in: Op.in,
  $notIn: Op.notIn,
  $gte: Op.gte,
  $lte: Op.lte
};

type SmartQueryWhere = Record<string, Record<PropertyKey, unknown>>;

type SmartQueryCriteria = {
  order?: unknown[];
  where?: SmartQueryWhere;
};

/**
 * 自动根据 req.query 生成 sequelize 查询条件, 自动判断参数清单中是否有值
 */
export default class SmartQuery {
  query: Record<string, unknown>;
  /** WHERE 查询条件 */
  where: SmartQueryWhere;
  /**
   * 排序列表
   */
  order: unknown[];

  constructor(query: Record<string, unknown>) {
    this.query = query;
    this.where = {};
    this.order = [];
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加全等查询条件
   * @param paramName query 中的参数名称
   * @param fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  equal(paramName: string, fieldName: string = paramName, defaultValue: unknown = null): this {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$eq', value);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 in 查询条件, 值可以为 `delimiter` 分割的字符串或者数组
   * @param paramName query 中的参数名称
   * @param [fieldName=paramName] 对应的数据库字段名称，默认与 paramName 一致
   * @param [defaultValue=null] 当 query 中不包含 paramName 或为空时，使用该值
   * @param [delimiter=,] 当值为字符串时的分隔符，默认为 ,
   */
  in(paramName: string, fieldName: string = paramName, defaultValue: unknown = null, delimiter = ','): this {
    return this.applyIn(paramName, fieldName, defaultValue, delimiter, false);
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 not in 查询条件, 值可以为 `delimiter` 分割的字符串或者数组
   * @param paramName query 中的参数名称
   * @param [fieldName=paramName] 对应的数据库字段名称，默认与 paramName 一致
   * @param [defaultValue=null] 当 query 中不包含 paramName 或为空时，使用该值
   * @param [delimiter=,] 当值为字符串时的分隔符，默认为 ,
   */
  notIn(paramName: string, fieldName: string = paramName, defaultValue: unknown = null, delimiter = ','): this {
    return this.applyIn(paramName, fieldName, defaultValue, delimiter, true);
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 LIKE 查询条件，并自动在值的头尾添加 %
   * @param paramName query 中的参数名称
   * @param fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  like(paramName: string, fieldName: string = paramName, defaultValue: unknown = null): this {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$like', `%${value}%`);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 LIKE 查询条件，并自动在值的尾部添加 %
   * @param paramName query 中的参数名称
   * @param fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  startsWith(paramName: string, fieldName: string = paramName, defaultValue: unknown = null): this {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$like', `${value}%`);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 LIKE 查询条件，并自动在值的头部添加 %
   * @param paramName query 中的参数名称
   * @param fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  endsWith(paramName: string, fieldName: string = paramName, defaultValue: unknown = null): this {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$like', `%${value}`);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 >= 查询条件
   * @param paramName query 中的参数名称
   * @param fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  gte(paramName: string, fieldName: string = paramName, defaultValue: unknown = null): this {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$gte', value);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 <= 查询条件
   * @param paramName query 中的参数名称
   * @param fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  lte(paramName: string, fieldName: string = paramName, defaultValue: unknown = null): this {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$lte', value);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 minParamName 的属性时，为 fieldName 添加 >= 查询条件，
   * 当 query 中包含名为 maxParamName 的属性时，为 fieldName 添加 <= 查询条件
   * @param minParamName query 中的最小值参数名称
   * @param maxParamName query 中的最大值参数名称
   * @param fieldName 对应的数据库字段名称
   * @param minDefault 当 query 中不包含 minParamName 或为空时，使用该值作为默认值
   * @param maxDefault 当 query 中不包含 maxParamName 或为空时，使用该值作为默认值
   */
  range(minParamName: string, maxParamName: string, fieldName: string, minDefault: unknown = null, maxDefault: unknown = null): this {
    const min = this.determineParam(minParamName) ? this.query[minParamName] : minDefault;
    const max = this.determineParam(maxParamName) ? this.query[maxParamName] : maxDefault;
    if (min != null) {
      this.applyWhere(fieldName, '$gte', min);
    }
    if (max != null) {
      this.applyWhere(fieldName, '$lte', max);
    }
    return this;
  }

  /**
   * 当 query 中包含名为 minParamName 的属性时，为 fieldName 添加 >= 查询条件并将时分秒设为0格式化到 targetFormat ，
   * 当 query 中包含名为 maxParamName 的属性时，为 fieldName 添加 <= 查询条件并将时分秒分别设为 23:59:59 后格式化到 targetFormat
   * @param minParamName query 中的最小值参数名称
   * @param maxParamName query 中的最大值参数名称
   * @param fieldName 对应的数据库字段名称
   * @param [minDefault=null] 当 query 中不包含 minParamName 或为空时，使用该值作为默认值
   * @param [maxDefault=null] 当 query 中不包含 maxParamName 或为空时，使用该值作为默认值
   * @param [sourceFormat='YYYY-MM-DD'] 原值时间格式
   * @param [targetFormat='X'] 数据库时间格式
   */
  dateRange(minParamName: string, maxParamName: string, fieldName: string, minDefault: string | null = null, maxDefault: string | null = null, sourceFormat = 'YYYY-MM-DD', targetFormat = 'X'): this {
    const minParam = this.determineParam(minParamName)
      ? this.query[minParamName]
      : null;
    // minDefault 为 null 时依赖 moment(null) 的 invalid 语义，不做可选值替换
    const min = minParam != null && moment(minParam as string, sourceFormat).isValid()
      ? moment(minParam as string, sourceFormat)
      : moment(minDefault as never, sourceFormat);
    const maxParam = this.determineParam(maxParamName) ? this.query[maxParamName] : null;
    const max = maxParam != null && moment(maxParam as string, sourceFormat).isValid()
      ? moment(maxParam as string, sourceFormat)
      : moment(maxDefault as never, sourceFormat);

    if (min.isValid()) {
      this.applyWhere(fieldName, '$gte', min.hours(0).minutes(0).seconds(0).format(targetFormat));
    }
    if (max.isValid()) {
      this.applyWhere(fieldName, '$lte', max.hours(23).minutes(59).seconds(59).format(targetFormat));
    }

    return this;
  }

  /**
   * 当 query 中包含名为 minParamName 的属性时，为 fieldName 添加 >= 查询条件并格式化到 targetFormat ，
   * 当 query 中包含名为 maxParamName 的属性时，为 fieldName 添加 <= 查询条件并并格式化到 targetFormat
   * @param minParamName query 中的最小值参数名称
   * @param maxParamName query 中的最大值参数名称
   * @param fieldName 对应的数据库字段名称
   * @param [minDefault=null] 当 query 中不包含 minParamName 或为空时，使用该值作为默认值
   * @param [maxDefault=null] 当 query 中不包含 maxParamName 或为空时，使用该值作为默认值
   * @param [sourceFormat='YYYY-MM-DD HH:mm:ss'] 原值时间格式
   * @param [targetFormat='X'] 数据库时间格式
   */
  dateTimeRange(minParamName: string, maxParamName: string, fieldName: string, minDefault: string | null = null, maxDefault: string | null = null, sourceFormat = 'YYYY-MM-DD HH:mm:ss', targetFormat = 'X'): this {
    const minParam = this.determineParam(minParamName)
      ? this.query[minParamName]
      : null;
    // minDefault 为 null 时依赖 moment(null) 的 invalid 语义，不做可选值替换
    const min = minParam != null && moment(minParam as string, sourceFormat).isValid()
      ? moment(minParam as string, sourceFormat)
      : moment(minDefault as never, sourceFormat);
    const maxParam = this.determineParam(maxParamName) ? this.query[maxParamName] : null;
    const max = maxParam != null && moment(maxParam as string, sourceFormat).isValid()
      ? moment(maxParam as string, sourceFormat)
      : moment(maxDefault as never, sourceFormat);

    if (min.isValid()) {
      this.applyWhere(fieldName, '$gte', min.format(targetFormat));
    }
    if (max.isValid()) {
      this.applyWhere(fieldName, '$lte', max.format(targetFormat));
    }

    return this;
  }

  /**
   * 处理用户的排序请求
   * @param [autoMapping=[]] 根据字段名自动排序，数组成员为字段名，每个字段名自动生成正反序，
   *                                  如 `created_at` 生成 `created_at` 正序和 `-created_at` 倒序
   * @param [manualMapping={}]
   * @param [defaultOrder=null] 默认排序，当 query 中不包含 `paramName` 属性时使用。如不设置则为 `autoMapping` 的第一个字段的倒序
   * @param [paramName='order'] 参数名称
   */
  orderable(autoMapping: string[] = [], manualMapping: Record<string, unknown> = {}, defaultOrder: unknown = null, paramName = 'order'): this {
    const ordersMapping: Record<string, unknown> = {};
    let conventionOrder = defaultOrder;
    if (autoMapping instanceof Array) {
      autoMapping.forEach((field) => {
        ordersMapping[`-${field}`] = [field, 'DESC'];
        ordersMapping[field] = [field, 'ASC'];
      });
      if (conventionOrder === null) {
        conventionOrder = [autoMapping[0], 'DESC'];
      }
    }

    Object.assign(ordersMapping, manualMapping);

    const order =
      this.determineParam(paramName) && Object.keys(ordersMapping).includes(this.query[paramName] as string)
        ? ordersMapping[this.query[paramName] as string] : conventionOrder;
    if (order != null) {
      this.order = [order];
    }

    return this;
  }

  /**
   * 获取完整的有效查询参数
   */
  getCriteria(): SmartQueryCriteria {
    const criteria: SmartQueryCriteria = {};
    if (this.order instanceof Array && this.order.length > 0) {
      criteria.order = this.order;
    }

    if (Object.keys(this.where).length > 0) {
      criteria.where = this.where;
    }

    return criteria;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 in 或 not in 查询条件, 值可以为 `delimiter` 分割的字符串或者数组
   * @protected
   * @param paramName query 中的参数名称
   * @param fieldName 对应的数据库字段名称
   * @param [defaultValue=null] 当 query 中不包含 paramName 或为空时，使用该值
   * @param [delimiter=,] 当值为字符串时的分隔符，默认为 ,
   * @param [negation=false] 是否取反，为 true 时使用 $notIn
   */
  applyIn(paramName: string, fieldName: string, defaultValue: unknown = null, delimiter = ',', negation = false): this {
    let value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value === null) {
      return this;
    }
    if (typeof value === 'number') {
      value = String(value);
    }
    if (typeof value === 'string') {
      value = value.split(delimiter);
    } else if (value instanceof Array === false) {
      throw new InvalidArgumentException(`Value for contains must be typeof string or array, but \`${typeof value}\` given`);
    }

    this.applyWhere(fieldName, negation ? '$notIn' : '$in', value);
    return this;
  }

  /**
   * 添加 where
   *
   * @protected
   */
  applyWhere(filedName: string, predicate: string, value: unknown) {
    if (!Object.keys(this.where).includes(filedName)) {
      this.where[filedName] = {};
    }
    this.where[filedName][OPERATORS[predicate] || predicate] = value;
  }

  /**
   * 判定指定名称的参数是否有效
   */
  determineParam(paramName: string): boolean {
    if (!Object.keys(this.query).includes(paramName)) {
      return false;
    }
    const value = this.query[paramName];
    if (value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    if (value instanceof Array) {
      return value.length > 0;
    }
    if (value instanceof Object) {
      return Object.keys(value).length > 0;
    }
    return true;
  }
}
