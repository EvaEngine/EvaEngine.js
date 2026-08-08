import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import Joi from 'joi';
import DI from '../../src/di.js';
import * as serviceProviders from '../../src/services/providers.js';
import * as middlewareProviders from '../../src/middlewares/providers.js';
import { mockRequest, mockResponse } from '../../src/utils/test.js';
import { UnauthorizedException, FormInvalidateException } from '../../src/exceptions/index.js';
import AuthKongMiddleware from '../../src/middlewares/auth_kong.js';

DI.registerMockedProviders(Object.values(serviceProviders), `${import.meta.dirname}/../_demo_project/config`);
DI.registerServiceProviders(Object.values(middlewareProviders));

const getAuth = () => DI.get('auth')();
const getValidator = () => DI.get('validator');
const response = () => mockResponse();

test('auth rejects token without expiration', async () => {
  const originalFind = DI.get('jwt').find;
  DI.get('jwt').find = async () => ({ uid: 7 });
  const request = mockRequest({ headers: { 'x-token': 'missing-expiration' } });
  try {
    const error = await new Promise(resolve => {
      getAuth()(request, response(), resolve);
    });
    assert.ok(error instanceof UnauthorizedException);
    assert.equal(error.message, 'Token expired');
  } catch (error) {
    assert.fail(error.message);
  } finally {
    DI.get('jwt').find = originalFind;
  }
});

test('validator accepts valid Joi 18 schema', async () => {
  const middleware = getValidator()(() => ({
    query: Joi.object({ page: Joi.number().integer().required() })
  }));
  const request = mockRequest({ query: { page: 2 } });
  let called = false;
  await middleware(request, response(), () => {
    called = true;
  });
  assert.ok(called);
});

test('validator rejects invalid Joi 18 schema', async () => {
  const middleware = getValidator()(() => ({
    body: Joi.object({ name: Joi.string().required() })
  }));
  const request = mockRequest({ body: {} });
  try {
    const error = await new Promise(resolve => {
      middleware(request, response(), resolve);
    });
    assert.ok(error instanceof FormInvalidateException);
  } catch (error) {
    assert.fail(error.message);
  }
});

test('session store redis errors are logged instead of thrown', () => {
  const config = DI.get('config');
  const originalStore = config.get('session').store;
  const fakeClient = new EventEmitter();
  config.get().session.store = { client: fakeClient };

  const logger = DI.get('logger');
  const originalError = logger.error;
  let logged = null;
  logger.error = (msg, err) => {
    logged = { msg, err };
  };

  try {
    const middleware = DI.get('session')();
    assert.equal(typeof middleware, 'function');
    assert.doesNotThrow(() => fakeClient.emit('error', new Error('redis down')));
  } finally {
    config.get().session.store = originalStore;
    logger.error = originalError;
  }
  assert.ok(logged);
  assert.equal(logged.err.message, 'redis down');
});

test('session middleware initializes with connect-redis 10', () => {
  const middleware = DI.get('session')();
  assert.equal(typeof middleware, 'function');
});

test('Kong auth accepts consumer headers', async () => {
  const request = mockRequest({ headers: {
    'x-consumer-custom-id': '9',
    'x-consumer-custom-username': 'nine'
  } });
  const result = await new Promise((resolve, reject) => {
    new AuthKongMiddleware()()(request, response(), error => error ? reject(error) : resolve(request));
  });
  assert.deepEqual(result.auth, { uid: 9, mobile: 'nine' });
});

test('Kong auth rejects anonymous consumer', async () => {
  const request = mockRequest({ headers: { 'x-anonymous-consumer': 'true' } });
  const error = await new Promise(resolve => {
    new AuthKongMiddleware()()(request, response(), resolve);
  });
  assert.ok(error instanceof UnauthorizedException);
});
