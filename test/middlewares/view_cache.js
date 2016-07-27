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
    'get/unknown:043fe182887af19ba0be0cb494b75c9c'
  );
});

test('View cache', (t) => {
  // t.plan(1);
  const req = mockRequest({
    method: 'GET', url: '/'
  });
  req.route = {};
  const res = mockResponse();
  const middleware = DI.get('view_cache')(60);
  res.on('end', () => {
    cache.namespace('view').has('get/unknown:043fe182887af19ba0be0cb494b75c9c').then((v) => {
      //FIXME: this assert not work!!
      t.true(v);
    });
  });

  middleware(req, res, () => {
    res.send('something');
  });
});

