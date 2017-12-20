import { Dependencies } from 'constitute';
import crypto from 'crypto';
import util from 'util';
import moment from 'moment-timezone';
import Logger from '../services/logger';
import Cache from '../services/cache';
import wrapper from '../utils/wrapper';
import { RuntimeException } from '../exceptions';

export const defaultHashStrategy = obj => obj;

export const defaultHeadersFilter = (res) => {
  const headers = [];
  ['Content-Type'].forEach((key) => {
    const value = res.get(key);
    if (value) {
      headers.push([key, value]);
    }
  });
  return headers;
};

export const requestToCacheKey = (req, hashStrategy) => {
  const {
    method,
    baseUrl,
    originalUrl,
    query: originQuery,
    route,
    uid = null //Custom rule
  } = req;
  const query = { ...originQuery };
  delete query.flush;
  if (hashStrategy && !util.isFunction(hashStrategy)) {
    throw new RuntimeException(`View cache hash strategy must be a function for ${originalUrl}`);
  }
  if (!route) {
    throw new RuntimeException(`View cache middleware require route for ${originalUrl}`);
  }
  if (method.toLowerCase() !== 'get') {
    throw new RuntimeException(
      `View cache middleware only support GET method of http request for ${originalUrl}`
    );
  }
  const { host = 'unknown' } = req.headers;
  const key = [method, `/${host}`, baseUrl, route.path].join('').replace(/:/g, '_').toLowerCase();
  const strategy = hashStrategy || defaultHashStrategy;
  const hash = crypto.createHash('md5').update(
    JSON.stringify(strategy({
      method,
      baseUrl,
      query,
      uid
    }))
  ).digest('hex');
  return [key, hash].join(':');
};


/**
 * @param {Cache} cache
 * @param {Logger} logger
 * @returns {function(*=)}
 * @constructor
 */
function ViewCacheMiddleware(cache, logger) {
  return (options = {}) => {
    if (!util.isObject(options)) {
      options = { //eslint-disable-line no-param-reassign
        ttl: options
      };
    }
    const {
      ttl,
      headersFilter,
      namespace,
      lockNamespace,
      hashStrategy
    } = Object.assign({
      ttl: 60,
      headersFilter: defaultHeadersFilter,
      hashStrategy: defaultHashStrategy,
      namespace: 'view',
      lockNamespace: 'view:lock'
    }, options);

    const getCache = async (ns, key) => await cache.namespace(ns).get(key) || {
      headers: [],
      body: null
    };

    return wrapper(async (req, res, next) => {
      const cacheKey = requestToCacheKey(req, hashStrategy);

      //加锁避免缓存失效风暴
      const lockTTL = ttl - 1;

      const sendHit = (headers, body) => {
        logger.debug('View cache hit by key %s', cacheKey);
        if (headers.length > 0) {
          headers.forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }
        res.setHeader('X-View-Cache-Hit', cacheKey);
        res.send(body);
      };

      //重设send方法
      const resetSend = () => {
        res.realSend = res.realSend || res.send; //eslint-disable-line no-param-reassign
        res.send = (body) => { //eslint-disable-line no-param-reassign
          logger.debug('View cache missed by key %s, creating...', cacheKey);
          res.setHeader('X-View-Cache-Miss', cacheKey);
          res.setHeader('X-View-Cache-Expire-At', moment().add(ttl, 'minute').format('YYYY-MM-DD HH:mm:ss Z'));
          res.setHeader('X-View-Cache-Created-At', moment().format('YYYY-MM-DD HH:mm:ss Z'));
          res.realSend(body);
          const headers = headersFilter && util.isFunction(headersFilter) ?
            headersFilter(res) : defaultHeadersFilter(res);
          if (res.statusCode <= 500) {
            cache.namespace(namespace).set(cacheKey, { headers, body }, ttl).then((ret) => {
              if (ret === null) {
                logger.error('View cache set failed for return %s', ret);
              }
              if (lockTTL > 0) {
                cache.namespace(lockNamespace).del(cacheKey);
              }
            }).catch((e) => {
              logger.error('View cache set failed for %s', cacheKey, e);
            });
          } else if (lockTTL > 0) {
            cache.namespace(lockNamespace).del(cacheKey);
          }
        };
      };

      const spinCache = async () => {
        const retry = await getCache(namespace, cacheKey);
        if (retry && retry.body) {
          return sendHit(retry.headers, retry.body);
        }
        //这里再次判断锁是否存在, 如果锁已经被释放, 代表缓存可能已经过期,则重新设置
        const lockRet = await cache.namespace(lockNamespace).set(cacheKey, 1, lockTTL, 'nx');
        if (lockRet) {
          resetSend();
          return next();
        }

        //自旋
        setTimeout(spinCache, 0);
        logger.info('View cache is spinning...');
        return true;
      };

      const {
        headers: cachedHeaders,
        body: cachedBody
      } = await getCache(namespace, cacheKey);
      if (req.query.flush !== 'true' && cachedBody) {
        sendHit(cachedHeaders, cachedBody);
        return;
      }

      if (lockTTL > 0) {
        const lockRet = await cache.namespace(lockNamespace).set(cacheKey, 1, lockTTL, 'nx');
        if (lockRet === null) {
          //get cache again
          await spinCache();
          return;
        }
      }

      resetSend();
      next();
    });
  };
}
Dependencies(Cache, Logger)(ViewCacheMiddleware);//eslint-disable-line new-cap

export default ViewCacheMiddleware;
