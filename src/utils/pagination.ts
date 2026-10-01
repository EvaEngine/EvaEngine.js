import snakeCase from 'lodash/snakeCase.js';
import transform from 'lodash/transform.js';
import nodePath from 'path';

/**
 * pagination 的 req 只使用 protocol/baseUrl/path/query/get，
 * 用最小结构类型同时兼容真实 express Request 与测试用的 duck-typed mock
 */
type PaginationRequest = {
  protocol: string;
  baseUrl: string;
  path: string;
  query: Record<string, unknown>;
  get(name: string): string | undefined;
};

const toUrl = (scheme: string, host: string, path: string, query: Record<string, unknown> = {}): string => {
  let queryString = Object.keys(query)
    .map(key => `${key}=${query[key]}`)
    .join('&');
  queryString = queryString === '' ? '' : `?${queryString}`;
  return `${scheme}://${host}${path}${queryString}`;
};

const toPaginationUrl = (query: Record<string, unknown>, req: PaginationRequest): string => {
  // 与原实现一致：host 缺失时由 split 直接抛 TypeError
  const hostInfo = req.get('host')!.split(':');
  let scheme = req.protocol;
  let host = hostInfo[0];
  let port: string | number = hostInfo[1];
  if (!port) {
    port = req.protocol === 'https' ? 443 : 80;
  }
  let requestPath = req.baseUrl;
  if (req.get('x-forwarded-port')) {
    port = req.get('x-forwarded-port')!;
  }
  if (req.get('x-forwarded-host')) {
    host = req.get('x-forwarded-host')!;
  }
  if (req.get('x-forwarded-proto')) {
    scheme = req.get('x-forwarded-proto')!;
  }
  if (req.get('x-forwarded-prefix')) {
    requestPath = nodePath.join(req.get('x-forwarded-prefix')!, requestPath, req.path);
  }
  if (
    (scheme === 'http' && String(port) !== '80')
    || (scheme === 'https' && String(port) !== '443')
  ) {
    host = `${host}:${port}`;
  }
  return toUrl(
    scheme, host, requestPath,
    Object.assign({}, req.query, query)
  );
};


const toPositiveInteger = (number: unknown): number => {
  // 入参可能为任意运行时类型，parseInt 的隐式转字符串行为保持不变
  const integer = parseInt(number as string, 10);
  return integer >= 0 ? integer : 0;
};

const transferProperties = (obj: Record<string, unknown>, useSnake = false): Record<string, unknown> => {
  if (useSnake === true) {
    return transform<unknown, Record<string, unknown>>(obj, (result, value, key) => {
      result[snakeCase(key)] = value;
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
}: {
  total: unknown;
  limit: unknown;
  offset: unknown;
  req: PaginationRequest;
  snakeCase?: boolean;
}): Record<string, unknown> => {
  const totalNumber = toPositiveInteger(total);
  let offsetNumber = parseInt(offset as string, 10);
  offsetNumber = Number.isNaN(offsetNumber) ? 0 : offsetNumber;
  let limitNumber = toPositiveInteger(limit);
  limitNumber = limitNumber < 1 ? 1 : limitNumber;
  const prev = offsetNumber - limitNumber;
  const next = offsetNumber + limitNumber;
  let prevUri = '';
  let nextUri = '';
  let firstUri = '';
  let lastUri = '';

  // total/limit/offset 运行时可能为任意类型；比较与减法沿用 JS 的数值强制转换语义
  if (Number(total) < 1) {
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

  const isFirst = Number(offset) <= 0;
  // 加法保留原始 JS 语义（字符串入参时会拼接），仅用类型断言满足编译
  const isLast = (offset as number) + (limit as number) >= (total as number);
  const lastOffset = ((total as number) - (offset as number)) % (limit as number);
  const last = lastOffset === 0 ? (total as number) - (limit as number) : (total as number) - lastOffset;
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

export const paginationFilter = ({ offset, limit }: { offset?: unknown; limit?: unknown }, defaultLimit = 15, maxLimit = 100): { offset: number; limit: number } => {
  //Solve offset is negative
  let offsetNumber = Number.parseInt(offset as string, 10);
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
