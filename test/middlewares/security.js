import test from 'ava';
import Joi from 'joi';
import DI from '../../src/di.js';
import * as serviceProviders from '../../src/services/providers.js';
import * as middlewareProviders from '../../src/middlewares/providers.js';
import { mockRequest, mockResponse } from '../../src/utils/test.js';
import { UnauthorizedException, FormInvalidateException } from '../../src/exceptions/index.js';
import AuthKongMiddleware from '../../src/middlewares/auth_kong.js';

DI.registerMockedProviders(Object.values(serviceProviders), `${__dirname}/../_demo_project/config`);
DI.registerServiceProviders(Object.values(middlewareProviders));

const getAuth = () => DI.get('auth')();
const getValidator = () => DI.get('validator');
const response = () => mockResponse();

test('auth rejects token without expiration', async (t) => {
  const originalFind = DI.get('jwt').find;
  DI.get('jwt').find = async () => ({ uid: 7 });
  const request = mockRequest({ headers: { 'x-token': 'missing-expiration' } });
  try {
    const error = await new Promise(resolve => {
      getAuth()(request, response(), resolve);
    });
    t.true(error instanceof UnauthorizedException);
    t.is(error.message, 'Token expired');
  } catch (error) {
    t.fail(error.message);
  } finally {
    DI.get('jwt').find = originalFind;
  }
});

test('validator accepts valid Joi 18 schema', async (t) => {
  const middleware = getValidator()(() => ({
    query: Joi.object({ page: Joi.number().integer().required() })
  }));
  const request = mockRequest({ query: { page: 2 } });
  let called = false;
  await middleware(request, response(), () => {
    called = true;
  });
  t.true(called);
});

test('validator rejects invalid Joi 18 schema', async (t) => {
  const middleware = getValidator()(() => ({
    body: Joi.object({ name: Joi.string().required() })
  }));
  const request = mockRequest({ body: {} });
  try {
    const error = await new Promise(resolve => {
      middleware(request, response(), resolve);
    });
    t.true(error instanceof FormInvalidateException);
  } catch (error) {
    t.fail(error.message);
  }
});

test('session middleware initializes with connect-redis 10', (t) => {
  const middleware = DI.get('session')();
  t.is(typeof middleware, 'function');
  t.pass();
});

test('Kong auth accepts consumer headers', async (t) => {
  const request = mockRequest({ headers: {
    'x-consumer-custom-id': '9',
    'x-consumer-custom-username': 'nine'
  } });
  const result = await new Promise((resolve, reject) => {
    new AuthKongMiddleware()()(request, response(), error => error ? reject(error) : resolve(request));
  });
  t.deepEqual(result.auth, { uid: 9, mobile: 'nine' });
});

test('Kong auth rejects anonymous consumer', async (t) => {
  const request = mockRequest({ headers: { 'x-anonymous-consumer': 'true' } });
  const error = await new Promise(resolve => {
    new AuthKongMiddleware()()(request, response(), resolve);
  });
  t.true(error instanceof UnauthorizedException);
});
