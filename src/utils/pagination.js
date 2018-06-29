import snakeCase from 'lodash/snakeCase';
import transform from 'lodash/transform';
import nodePath from 'path';

const toUrl = (scheme, host, path, query = {}) => {
  let queryString = Object.keys(query)
    .map(key => `${key}=${query[key]}`)
    .join('&');
  queryString = queryString === '' ? '' : `?${queryString}`;
  return `${scheme}://${host}${path}${queryString}`;
};

const toPaginationUrl = (query, req) => {
  const hostInfo = req.get('host');

  let host = hostInfo[0];
  let port = hostInfo[1];
  let scheme = req.protocol;
  let requestPath = req.baseUrl;
  if (req.get('x-forwarded-port')) {
    port = req.get('x-forwarded-port');
  }
  if (req.get('x-forwarded-host')) {
    host = req.get('x-forwarded-host');
  }
  if (req.get('x-forwarded-proto')) {
    scheme = req.get('x-forwarded-proto');
  }
  if (req.get('x-forwarded-prefix')) {
    requestPath = nodePath.join(req.get('x-forwarded-prefix'), requestPath, req.path);
  }
  if (
    (scheme === 'http' && String(port) !== '80')
    || (scheme === 'https' && String(port) !== '443')
  ) {
    host = `${host}:${port}`;
  }
  return toUrl(
    scheme, host, requestPath,
    Object.assign(req.query, query)
  );
};


const toPositiveInteger = (number) => {
  const integer = parseInt(number, 10);
  return integer >= 0 ? integer : 0;
};

const transferProperties = (obj, useSnake = false) => {
  if (useSnake === true) {
    return transform(obj, (result, value, key) => {
      result[snakeCase(key)] = value; //eslint-disable-line no-param-reassign
    });
  }
  return obj;
};

//@formatter:off
/**
 @swagger
 PaginationSnake:
   type: object
   properties:
     total:
       type: integer
       description: 总数据量
     offset:
       type: integer
       description: 偏移量
     limit:
       type: integer
       description: 单页数据量
     prev:
       type: integer
       description: 上页偏移量
     next:
       type: integer
       description: 下页偏移量
     prev_uri:
       type: string
       description: 上页Uri
     next_uri:
       type: string
       description: 下页Uri
     is_first:
       type: boolean
       description: 是否为首页
     is_last:
       type: boolean
       description: 是否为末页
     first_uri:
       type: string
       description: 首页Uri
     last_uri:
       type: string
       description: 末页Uri
   required:
   - total
   - offset
   - limit
   - prev
   - next
   - prev_uri
   - next_uri
   - is_first
   - is_last
   - first_uri
   - last_uri
   example:
     total: 100
     offset: 30
     limit: 15
     prev: 15
     next: 45
     prev_uri: http://localhost/v1/posts?offset=15&limit=15
     next_uri: http://localhost/v1/posts?offset=30&limit=15
     is_first: false
     is_last: false
     first_uri: http://localhost/v1/posts?offset=0&limit=15
     last_uri: http://localhost/v1/posts?offset=90&limit=15
 @swagger
 Pagination:
   type: object
   properties:
     total:
       type: integer
       description: 总数据量
     offset:
       type: integer
       description: 偏移量
     limit:
       type: integer
       description: 单页数据量
     prev:
       type: integer
       description: 上页偏移量
     next:
       type: integer
       description: 下页偏移量
     prevUri:
       type: string
       description: 上页Uri
     nextUri:
       type: string
       description: 下页Uri
     isFirst:
       type: boolean
       description: 是否为首页
     isLast:
       type: boolean
       description: 是否为末页
     firstUri:
       type: string
       description: 首页Uri
     lastUri:
       type: string
       description: 末页Uri
   required:
   - total
   - offset
   - limit
   - prev
   - next
   - prevUri
   - nextUri
   - isFirst
   - isLast
   - firstUri
   - lastUri
   example:
     total: 100
     offset: 30
     limit: 15
     prev: 15
     next: 45
     prevUri: http://localhost/v1/posts?offset=15&limit=15
     nextUri: http://localhost/v1/posts?offset=30&limit=15
     isFirst: false
     isLast: false
     firstUri: http://localhost/v1/posts?offset=0&limit=15
     lastUri: http://localhost/v1/posts?offset=90&limit=15
 */
//@formatter:on
export const pagination = ({
  total,
  limit,
  offset,
  req,
  snakeCase: useSnake
}) => {
  const totalNumber = toPositiveInteger(total);
  let offsetNumber = parseInt(offset, 10);
  offsetNumber = Number.isNaN(offsetNumber) ? 0 : offsetNumber;
  let limitNumber = toPositiveInteger(limit);
  limitNumber = limitNumber < 1 ? 1 : limitNumber;
  const prev = offsetNumber - limitNumber;
  const next = offsetNumber + limitNumber;
  let prevUri = '';
  let nextUri = '';
  let firstUri = '';
  let lastUri = '';

  if (total < 1) {
    return transferProperties({
      total: totalNumber,
      offset: offsetNumber,
      limit: limitNumber,
      isFirst: true,
      isLast: true,
      prev,
      next,
      prevUri,
      nextUri,
      firstUri,
      lastUri
    }, useSnake);
  }

  const isFirst = offset <= 0;
  const isLast = offset + limit >= total;
  const lastOffset = (total - offset) % limit;
  const last = lastOffset === 0 ? total - limit : total - lastOffset;
  prevUri = isFirst ? prevUri : toPaginationUrl({ offset: prev, limit: limitNumber }, req);
  nextUri = isLast ? nextUri : toPaginationUrl({ offset: next, limit: limitNumber }, req);
  firstUri = toPaginationUrl({ offset: 0, limit: limitNumber }, req);
  lastUri = toPaginationUrl({ offset: last, limit: limitNumber }, req);
  return transferProperties({
    total: totalNumber,
    offset: offsetNumber,
    limit: limitNumber,
    prev,
    next,
    isFirst,
    isLast,
    prevUri,
    nextUri,
    firstUri,
    lastUri
  }, useSnake);
};

export const paginationFilter = ({ offset, limit }, defaultLimit = 15, maxLimit = 100) => {
  //Solve offset is negative
  let offsetNumber = Number.parseInt(offset, 10);
  offsetNumber = Number.isNaN(offsetNumber) ? 0 : offsetNumber;
  let limitNumber = toPositiveInteger(limit);
  limitNumber = limitNumber < 1 ? defaultLimit : limitNumber;

  if (offsetNumber < 0) {
    limitNumber += (offsetNumber % limitNumber);
    offsetNumber = 0;
  }

  limitNumber = maxLimit > 0 && limitNumber > maxLimit ? maxLimit : limitNumber;

  return { offset: offsetNumber, limit: limitNumber };
};
