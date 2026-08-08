import constitute from 'constitute';
import crypto from 'crypto';
import moment from 'moment-timezone';
import Logger from '../services/logger.js';
import Cache from '../services/cache.js';
import wrapper from '../utils/wrapper.js';
import { RuntimeException } from '../exceptions/index.js';

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
    originalUrl,
    query: originQuery,
    route
  } = req;
  //Prefer uid resolved by auth middleware, keep req.uid as custom rule fallback
  const uid = (req.auth && req.auth.uid) || req.uid || null;
  const query = { ...originQuery };
  delete query.flush;
  if (hashStrategy && typeof hashStrategy !== 'function') {
    throw new RuntimeException(`View cache hash strategy must be a function for ${originalUrl}`);
  }
  if (!route) {
    throw new RuntimeException(`View cache middleware require route for ${originalUrl}`);
  }
  if (method.toLowerCase() !== 'get') {
    throw new RuntimeException(`View cache middleware only support GET method of http request for ${originalUrl}`);
  }
  const { host = 'unknown' } = req.headers;
  const [urlPath = ''] = originalUrl.split('?');
  const key = [method, `/${host}`, urlPath].join('').replace(/:/g, '_').toLowerCase();
  const strategy = hashStrategy || defaultHashStrategy;
  const hash = crypto
    .createHash('md5')
    .update(JSON
      .stringify(strategy({
        method,
        urlPath,
        query,
        uid
      })))
    .digest('hex');
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
    if (options === null || typeof options !== 'object') {
      options = {
        ttl: options
      };
    }
    const {
      ttl,
      headersFilter,
      namespace,
      hashStrategy
    } = Object.assign({
      ttl: 60,
      headersFilter: defaultHeadersFilter,
      hashStrategy: defaultHashStrategy,
      namespace: 'view'
    }, options);
    return wrapper(async (req, res, next) => {
      const cacheKey = requestToCacheKey(req, hashStrategy);
      const {
        headers: cachedHeaders = [],
        body: cachedBody
      } = await cache.namespace(namespace).get(cacheKey)
      || {
        headers: [],
        body: null
      };
      if (req.query.flush !== 'true' && cachedBody) {
        logger.debug('View cache hit by key %s', cacheKey);
        if (cachedHeaders.length > 0) {
          cachedHeaders.forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }
        res.setHeader('X-View-Cache-Hit', cacheKey);
        res.send(cachedBody);
        return;
      }
      res.realSend = res.send;
      res.send = (body) => {
        logger.debug('View cache missed by key %s, creating...', cacheKey);
        res.setHeader('X-View-Cache-Miss', cacheKey);
        res.setHeader('X-View-Cache-Expire-At', moment().add(ttl, 'minute').format('YYYY-MM-DD HH:mm:ss Z'));
        res.setHeader('X-View-Cache-Created-At', moment().format('YYYY-MM-DD HH:mm:ss Z'));
        res.realSend(body);
        const headers = headersFilter && typeof headersFilter === 'function' ?
          headersFilter(res) : defaultHeadersFilter(res);
        if (res.statusCode <= 500) {
          cache.namespace(namespace).set(cacheKey, { headers, body }, ttl).catch((e) => {
            logger.error('View cache set failed for %s', cacheKey, e);
          });
        }
      };
      next();
    });
  };
}

constitute.Dependencies(Cache, Logger)(ViewCacheMiddleware);

export default ViewCacheMiddleware;
