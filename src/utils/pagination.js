const toUrl = (scheme, host, path, query = {}) => {
  let queryString = Object.keys(query)
    .map(key => `${key}=${query[key]}`)
    .join('&');
  queryString = queryString === '' ? '' : `?${queryString}`;
  return `${scheme}://${host}${path}${queryString}`;
};

const toPaginationUrl = (query, req) =>
  toUrl(
    req.protocol, req.get('host'), req.baseUrl + req.path,
    Object.assign(req.query, query)
  );


const toPositiveInteger = (number) => {
  const integer = parseInt(number, 10);
  return integer >= 0 ? integer : 0;
};

//@formatter:off
/**
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
  req
}) => {
  const totalNumber = toPositiveInteger(total);
  let offsetNumber = parseInt(offset, 10);
  offsetNumber = isNaN(offsetNumber) ? 0 : offsetNumber;
  let limitNumber = toPositiveInteger(limit);
  limitNumber = limitNumber < 1 ? 1 : limitNumber;
  const prev = offsetNumber - limitNumber;
  const next = offsetNumber + limitNumber;
  let prevUri = '';
  let nextUri = '';
  let firstUri = '';
  let lastUri = '';

  if (total < 1) {
    return {
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
    };
  }

  const isFirst = offset <= 0;
  const isLast = offset + limit >= total;
  const lastOffset = (total - offset) % limit;
  const last = lastOffset === 0 ? total - limit : total - lastOffset;
  prevUri = isFirst ? prevUri : toPaginationUrl({ offset: prev, limit: limitNumber }, req);
  nextUri = isLast ? nextUri : toPaginationUrl({ offset: next, limit: limitNumber }, req);
  firstUri = toPaginationUrl({ offset: 0, limit: limitNumber }, req);
  lastUri = toPaginationUrl({ offset: last, limit: limitNumber }, req);
  return {
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
  };
};

export const paginationFilter = ({ offset, limit }, defaultLimit = 15, maxLimit = 100) => {
  //Solve offset is negative
  let offsetNumber = parseInt(offset, 10);
  offsetNumber = isNaN(offsetNumber) ? 0 : offsetNumber;
  let limitNumber = toPositiveInteger(limit);
  limitNumber = limitNumber < 1 ? defaultLimit : limitNumber;

  if (offsetNumber < 0) {
    limitNumber = limitNumber + offsetNumber % limitNumber;
    offsetNumber = 0;
  }

  limitNumber = maxLimit > 0 && limitNumber > maxLimit ? maxLimit : limitNumber;

  return { offset: offsetNumber, limit: limitNumber };
};
