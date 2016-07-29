import Logger from '../services/logger';
import Cache from '../services/cache';
import { Dependencies } from 'constitute';
import wrapper from '../utils/wrapper';
import crypto from 'crypto';
import util from 'util';
import { RuntimeException, UnsupportedOperationException } from '../exceptions';

export const defaultHashStrategy = (obj) => obj;

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
          query,
          route,
          uid = null //Custom rule
        } = req;
  if (hashStrategy && !util.isFunction(hashStrategy)) {
    throw new RuntimeException(`View cache hash strategy must be a function for ${originalUrl}`);
  }
  if (!route) {
    throw new RuntimeException(`View cache middleware require route for ${originalUrl}`);
  }
  if (method.toLowerCase() !== 'get') {
    throw new UnsupportedOperationException(
      `View cache middleware only support GET method of http request for ${originalUrl}`
    );
  }
  const { host = 'unknown' } = req.headers;
  const key = [method, `/${host}`, baseUrl, route.path].join('').replace(/:/g, '_').toLowerCase();
  const strategy = hashStrategy || defaultHashStrategy;
  const hash = crypto.createHash('md5').update(
    JSON.stringify(strategy({
      method,
      originalUrl,
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
            hashStrategy
          } = Object
      .assign({
        ttl: 60,
        headersFilter: defaultHeadersFilter,
        hashStrategy: defaultHashStrategy,
        namespace: 'view'
      }, options);
    return wrapper(async(req, res, next) => {
      const cacheKey = requestToCacheKey(req, hashStrategy);
      const {
              headers: cachedHeaders = [],
              body: cachedBody
            } = await cache.namespace(namespace).get(cacheKey)
      || {
        headers: [],
        body: null
      };
      if (cachedBody) {
        logger.debug('View cache hit by key %s', cacheKey);
        if (cachedHeaders.length > 0) {
          cachedHeaders.forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }
        res.setHeader('X-View-Cache', cacheKey);
        res.send(cachedBody);
        return;
      }
      res.realSend = res.send; //eslint-disable-line no-param-reassign
      res.send = (body) => { //eslint-disable-line no-param-reassign
        logger.debug('View cache missed by key %s, creating...', cacheKey);
        const headers = headersFilter && util.isFunction(headersFilter) ?
          headersFilter(res) : defaultHeadersFilter(res);
        cache.namespace(namespace).set(cacheKey, { headers, body }, ttl).finally(() => {
          res.realSend(body);
        });
      };
      next();
    });
  };
}
Dependencies(Cache, Logger)(ViewCacheMiddleware);  //eslint-disable-line new-cap

export default ViewCacheMiddleware;
