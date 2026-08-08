import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.js';
import * as providers from '../../src/services/providers.js';
import * as middlewares from '../../src/middlewares/providers.js';
import {
  requestToCacheKey
} from '../../src/middlewares/view_cache.js';
import { mockRequest } from '../../src/utils/test.js';
import { RuntimeException } from './../../src/exceptions/index.js';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
DI.registerServiceProviders(Object.values(middlewares));
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
  req.route = {};
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
  req.route = {};
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
  req.route = {};
  assert.equal(
    requestToCacheKey(req),
    'get/unknown/:b34681a09a08123738280c8744ac14a6'
  );
});

test('cache key is user aware', () => {
  const anonymous = mockRequest({
    method: 'GET', url: '/profile'
  });
  anonymous.route = {};
  const authed = mockRequest({
    method: 'GET', url: '/profile'
  });
  authed.route = {};
  authed.auth = { uid: 7 };
  const otherUser = mockRequest({
    method: 'GET', url: '/profile'
  });
  otherUser.route = {};
  otherUser.auth = { uid: 8 };
  assert.notEqual(requestToCacheKey(anonymous), requestToCacheKey(authed));
  assert.notEqual(requestToCacheKey(authed), requestToCacheKey(otherUser));
});
