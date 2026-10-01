import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import DI, { type EngineLike } from '../../src/di.ts';
import * as providers from '../../src/services/providers.ts';
import * as middlewares from '../../src/middlewares/providers.ts';
import {
  requestToCacheKey
} from '../../src/middlewares/view_cache.ts';
import { mockRequest } from '../../src/utils/test.ts';
import { RuntimeException } from './../../src/exceptions/index.ts';
import type { Request } from 'express';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
//中间件 providers 只做 bind 不读取 engine，原测试按 JS 形态省略该参数
DI.registerServiceProviders(Object.values(middlewares), undefined as unknown as EngineLike);
const cache = DI.get('cache');
beforeEach(async () => {
  await cache.flush();
});
after(() => DI.get('redis').cleanup());

test('No route', () => {
  assert.throws(() => {
    requestToCacheKey(mockRequest());
  }, (e) => {
    assert.ok(e instanceof RuntimeException);
    assert.match(e.message, /View cache middleware require route/);
    return true;
  });
});

test('No support post', () => {
  const req = mockRequest({
    method: 'POST', url: '/login'
  });
  //express 的 IRoute 结构完整，测试仅需空 route 触发校验路径
  req.route = {} as Request['route'];
  assert.throws(() => {
    requestToCacheKey(req);
  }, (e) => {
    assert.ok(e instanceof RuntimeException);
    assert.match(e.message, /View cache middleware only support GET method/);
    return true;
  });
});

test('Hash strategy not function', () => {
  const req = mockRequest({
    method: 'GET', url: '/login'
  });
  //express 的 IRoute 结构完整，测试仅需空 route 触发校验路径
  req.route = {} as Request['route'];
  assert.throws(() => {
    requestToCacheKey(req, 'something strange');
  }, (e) => {
    assert.ok(e instanceof RuntimeException);
    assert.match(e.message, /View cache hash strategy must be a function/);
    return true;
  });
});

test('Request hash', () => {
  const req = mockRequest({
    method: 'GET', url: '/'
  });
  //express 的 IRoute 结构完整，测试仅需空 route 触发校验路径
  req.route = {} as Request['route'];
  assert.equal(
    requestToCacheKey(req),
    'get/unknown/:b34681a09a08123738280c8744ac14a6'
  );
});

test('cache key is user aware', () => {
  const anonymous = mockRequest({
    method: 'GET', url: '/profile'
  });
  //express 的 IRoute 结构完整，测试仅需空 route 触发校验路径
  anonymous.route = {} as Request['route'];
  const authed = mockRequest({
    method: 'GET', url: '/profile'
  });
  //express 的 IRoute 结构完整，测试仅需空 route 触发校验路径
  authed.route = {} as Request['route'];
  authed.auth = { uid: 7 };
  const otherUser = mockRequest({
    method: 'GET', url: '/profile'
  });
  //express 的 IRoute 结构完整，测试仅需空 route 触发校验路径
  otherUser.route = {} as Request['route'];
  otherUser.auth = { uid: 8 };
  assert.notEqual(requestToCacheKey(anonymous), requestToCacheKey(authed));
  assert.notEqual(requestToCacheKey(authed), requestToCacheKey(otherUser));
});
