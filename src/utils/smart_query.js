import moment from 'moment';
import { InvalidArgumentException } from '../exceptions';

/**
 * 自动根据 req.query 生成 sequelize 查询条件, 自动判断参数清单中是否有值
 */
export default class SmartQuery {
  constructor(query) {
    this.query = query;
    /**
     * WHERE 查询条件
     * @type {{}}
     */
    this.where = {};
    /**'
     * 排序列表
     * @type {Array}
     */
    this.order = [];
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加全等查询条件
   * @param {String} paramName query 中的参数名称
   * @param {String} fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param {String} defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  equal(paramName, fieldName = paramName, defaultValue = null) {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$eq', value);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 in 查询条件, 值可以为 `delimiter` 分割的字符串或者数组
   * @param {String} paramName query 中的参数名称
   * @param {String} [fieldName=paramName] 对应的数据库字段名称，默认与 paramName 一致
   * @param {String|Array} [defaultValue=null] 当 query 中不包含 paramName 或为空时，使用该值
   * @param {String} [delimiter=,] 当值为字符串时的分隔符，默认为 ,
   */
  in(paramName, fieldName = paramName, defaultValue = null, delimiter = ',') {
    return this.applyIn(paramName, fieldName, defaultValue, delimiter, false);
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 not in 查询条件, 值可以为 `delimiter` 分割的字符串或者数组
   * @param {String} paramName query 中的参数名称
   * @param {String} [fieldName=paramName] 对应的数据库字段名称，默认与 paramName 一致
   * @param {String|Array} [defaultValue=null] 当 query 中不包含 paramName 或为空时，使用该值
   * @param {String} [delimiter=,] 当值为字符串时的分隔符，默认为 ,
   */
  notIn(paramName, fieldName = paramName, defaultValue = null, delimiter = ',') {
    return this.applyIn(paramName, fieldName, defaultValue, delimiter, true);
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 LIKE 查询条件，并自动在值的头尾添加 %
   * @param {String} paramName query 中的参数名称
   * @param {String} fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param {String} defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  like(paramName, fieldName = paramName, defaultValue = null) {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$like', `%${value}%`);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 LIKE 查询条件，并自动在值的尾部添加 %
   * @param {String} paramName query 中的参数名称
   * @param {String} fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param {String} defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  startsWith(paramName, fieldName = paramName, defaultValue = null) {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$like', `${value}%`);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 LIKE 查询条件，并自动在值的头部添加 %
   * @param {String} paramName query 中的参数名称
   * @param {String} fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param {String} defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  endsWith(paramName, fieldName = paramName, defaultValue = null) {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$like', `%${value}`);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 >= 查询条件
   * @param {String} paramName query 中的参数名称
   * @param {String} fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param {String} defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  gte(paramName, fieldName = paramName, defaultValue = null) {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$gte', value);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 <= 查询条件
   * @param {String} paramName query 中的参数名称
   * @param {String} fieldName 对应的数据库字段名称，默认与 paramName 一致
   * @param {String} defaultValue 当 query 中不包含 paramName 或为空时，使用该值
   */
  lte(paramName, fieldName = paramName, defaultValue = null) {
    const value = this.determineParam(paramName) ? this.query[paramName] : defaultValue;
    if (value != null) {
      this.applyWhere(fieldName, '$lte', value);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 minParamName 的属性时，为 fieldName 添加 >= 查询条件，
   * 当 query 中包含名为 maxParamName 的属性时，为 fieldName 添加 <= 查询条件
   * @param {String} minParamName query 中的最小值参数名称
   * @param {String} maxParamName query 中的最大值参数名称
   * @param {String} fieldName 对应的数据库字段名称
   * @param {String} minDefault 当 query 中不包含 minParamName 或为空时，使用该值作为默认值
   * @param {String} maxDefault 当 query 中不包含 maxParamName 或为空时，使用该值作为默认值
   */
  range(minParamName, maxParamName, fieldName, minDefault = null, maxDefault = null) {
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
   * @param {String} minParamName query 中的最小值参数名称
   * @param {String} maxParamName query 中的最大值参数名称
   * @param {String} fieldName 对应的数据库字段名称
   * @param {String} [minDefault=null] 当 query 中不包含 minParamName 或为空时，使用该值作为默认值
   * @param {String} [maxDefault=null] 当 query 中不包含 maxParamName 或为空时，使用该值作为默认值
   * @param {String} [sourceFormat='YYYY-MM-DD'] 原值时间格式
   * @param {String } [targetFormat='X'] 数据库时间格式
   */
  dateRange(minParamName, maxParamName, fieldName, minDefault = null, maxDefault = null, sourceFormat = 'YYYY-MM-DD', targetFormat = 'X') {
    let min = this.determineParam(minParamName)
      ? this.query[minParamName]
      : null;
    min = min != null && moment(min, sourceFormat).isValid()
      ? moment(min, sourceFormat)
      : moment(minDefault, sourceFormat);
    let max = this.determineParam(maxParamName) ? this.query[maxParamName] : null;
    max = max != null && moment(max, sourceFormat).isValid()
      ? moment(max, sourceFormat)
      : moment(maxDefault, sourceFormat);

    if (min.isValid()) {
      min = min.hours(0).minutes(0).seconds(0).format(targetFormat);
      this.applyWhere(fieldName, '$gte', min);
    }
    if (max.isValid()) {
      max = max.hours(23).minutes(59).seconds(59).format(targetFormat);
      this.applyWhere(fieldName, '$lte', max);
    }

    return this;
  }

  /**
   * 当 query 中包含名为 minParamName 的属性时，为 fieldName 添加 >= 查询条件并格式化到 targetFormat ，
   * 当 query 中包含名为 maxParamName 的属性时，为 fieldName 添加 <= 查询条件并并格式化到 targetFormat
   * @param {String} minParamName query 中的最小值参数名称
   * @param {String} maxParamName query 中的最大值参数名称
   * @param {String} fieldName 对应的数据库字段名称
   * @param {String} [minDefault=null] 当 query 中不包含 minParamName 或为空时，使用该值作为默认值
   * @param {String} [maxDefault=null] 当 query 中不包含 maxParamName 或为空时，使用该值作为默认值
   * @param {String} [sourceFormat='YYYY-MM-DD'] 原值时间格式
   * @param {String } [targetFormat='X'] 数据库时间格式
   */
  dateTimeRange(minParamName, maxParamName, fieldName, minDefault = null, maxDefault = null, sourceFormat = 'YYYY-MM-DD HH:mm:ss', targetFormat = 'X') {
    let min = this.determineParam(minParamName)
      ? this.query[minParamName]
      : null;
    min = min != null && moment(min, sourceFormat).isValid()
      ? moment(min, sourceFormat)
      : moment(minDefault, sourceFormat);
    let max = this.determineParam(maxParamName) ? this.query[maxParamName] : null;
    max = max != null && moment(max, sourceFormat).isValid()
      ? moment(max, sourceFormat)
      : moment(maxDefault, sourceFormat);

    if (min.isValid()) {
      min = min.format(targetFormat);
      this.applyWhere(fieldName, '$gte', min);
    }
    if (max.isValid()) {
      max = max.format(targetFormat);
      this.applyWhere(fieldName, '$lte', max);
    }

    return this;
  }

  /**
   * 处理用户的排序请求
   * @param {Array} [autoMapping=[]] 根据字段名自动排序，数组成员为字段名，每个字段名自动生成正反序，
   *                                  如 `created_at` 生成 `created_at` 正序和 `-created_at` 倒序
   * @param {Object} [manualMapping={}]
   * @param [defaultOrder=null] 默认排序，当 query 中不包含 `paramName` 属性时使用。如不设置则为 `autoMapping` 的第一个字段的倒序
   * @param {String} [paramName='sort'] 参数名称
   */
  orderable(autoMapping = [], manualMapping = {}, defaultOrder = null, paramName = 'order') {
    const ordersMapping = {};
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
      this.determineParam(paramName) && Object.keys(ordersMapping).includes(this.query[paramName])
        ? ordersMapping[this.query[paramName]] : conventionOrder;
    if (order != null) {
      this.order = [order];
    }

    return this;
  }

  /**
   * 获取完整的有效查询参数
   * @returns {{}}
   */
  getCriteria() {
    const criteria = {};
    if (this.order instanceof Array && this.order.length > 0) {
      criteria.order = this.order;
    }

    if (this.where instanceof Object && this.where.length > 0) {
      criteria.where = this.where;
    }

    return criteria;
  }

  /**
   * 当 query 中包含名为 paramName 的属性时，为 fieldName 添加 in 或 not in 查询条件, 值可以为 `delimiter` 分割的字符串或者数组
   * @protected
   * @param {String} paramName query 中的参数名称
   * @param {String} fieldName 对应的数据库字段名称
   * @param {String|Array} [defaultValue=null] 当 query 中不包含 paramName 或为空时，使用该值
   * @param {String} [delimiter=,] 当值为字符串时的分隔符，默认为 ,
   * @param {Boolean} [negation=false] 是否取反，为 true 时使用 $notIn
   */
  applyIn(paramName, fieldName, defaultValue = null, delimiter = ',', negation = false) {
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
   * @param filedName
   * @param predicate
   * @param value
   */
  applyWhere(filedName, predicate, value) {
    if (!Object.keys(this.where).includes(filedName)) {
      this.where[filedName] = {};
    }
    this.where[filedName][predicate] = value;
  }

  /**
   * 判定指定名称的参数是否有效
   *
   * @param paramName
   * @returns {boolean}
   */
  determineParam(paramName) {
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
