import test from 'ava';
import DI from '../../src/di';
import * as providers from '../../src/services/providers';
import * as middlewares from '../../src/middlewares/providers';
import {
  requestToCacheKey
} from '../../src/middlewares/view_cache';
import { mockRequest, mockResponse } from '../../src/utils/test';
import { RuntimeException } from './../../src/exceptions';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
DI.registerServiceProviders(Object.values(middlewares));
const cache = DI.get('cache');
test.beforeEach('Flush all', () => {
  cache.flush();
});

test('No route', (t) => {
  try {
    requestToCacheKey(mockRequest());
  } catch (e) {
    t.true(e instanceof RuntimeException);
    t.regex(e.message, /View cache middleware require route/);
  }
});

test('No support post', (t) => {
  const req = mockRequest({
    method: 'POST', url: '/login'
  });
  req.route = {};
  try {
    requestToCacheKey(req);
  } catch (e) {
    t.true(e instanceof RuntimeException);
    t.regex(e.message, /View cache middleware only support GET method/);
  }
});

test('Hash strategy not function', (t) => {
  const req = mockRequest({
    method: 'GET', url: '/login'
  });
  req.route = {};
  try {
    requestToCacheKey(req, 'something strange');
  } catch (e) {
    t.true(e instanceof RuntimeException);
    t.regex(e.message, /View cache hash strategy must be a function/);
  }
});

test('Request hash', (t) => {
  const req = mockRequest({
    method: 'GET', url: '/'
  });
  req.route = {};
  t.is(
    requestToCacheKey(req),
    'get/unknown/:5bb7eb919a5d177089d48a9ab171fc4e'
  );
});

test('View cache', async (t) => {
  const req = mockRequest({
    method: 'GET', url: '/'
  });
  req.route = {};
  const res = mockResponse();
  const middleware = DI.get('view_cache')(60);

  await middleware(req, res, () => {
    res.send('something');
  });

  //走缓存, 所以next中断言不执行
  await middleware(req, res, () => {
    t.true(false);
  });

  const v = await cache.namespace('view').has('get/unknown/:5bb7eb919a5d177089d48a9ab171fc4e');
  t.true(v);

  t.is(await cache.namespace('view').flush(), 1);
  t.is(await cache.namespace('view:lock').flush(), 0);
});

test('View lock', async (t) => {
  const req = mockRequest({
    method: 'GET', url: '/'
  });
  req.route = {};
  const res = mockResponse();
  const middleware = DI.get('view_cache')(60);

  await middleware(req, res, () => {
    // 不执行send
  });

  const locked = await cache.namespace('view:lock').has('get/unknown/:5bb7eb919a5d177089d48a9ab171fc4e');
  t.true(locked);

  //此时资源被锁定, 无法缓存
  await middleware(req, res, (v) => {
    res.send('something');
  });
  let v = await cache.namespace('view').has('get/unknown/:5bb7eb919a5d177089d48a9ab171fc4e');
  t.false(v);

  t.is(await cache.namespace('view:lock').flush(), 1);

  //延迟500ms, 确保当lock 被释放后, 缓存被设置成功
  const s = new Promise(resolve => setTimeout(resolve, 500));
  await s;

  v = await cache.namespace('view').has('get/unknown/:5bb7eb919a5d177089d48a9ab171fc4e');
  t.true(v);

  t.is(await cache.namespace('view').flush(), 1);

});
