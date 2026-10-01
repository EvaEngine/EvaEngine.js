import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import Joi from 'joi';
import DI, { type EngineLike } from '../../src/di.ts';
import * as serviceProviders from '../../src/services/providers.ts';
import * as middlewareProviders from '../../src/middlewares/providers.ts';
import { mockRequest, mockResponse } from '../../src/utils/test.ts';
import { UnauthorizedException, FormInvalidateException } from '../../src/exceptions/index.ts';
import AuthKongMiddleware from '../../src/middlewares/auth_kong.ts';
import type { RequestHandler } from 'express';
import type { Schema } from 'joi';

DI.registerMockedProviders(Object.values(serviceProviders), `${import.meta.dirname}/../_demo_project/config`);
//中间件 providers 只做 bind 不读取 engine，原测试按 JS 形态省略该参数
DI.registerServiceProviders(Object.values(middlewareProviders), undefined as unknown as EngineLike);

//DI 对 auth/validator/session 无具名重载返回 unknown，按各中间件工厂的最小结构断言
type ValidatorFactory = (getSchema: (joi: typeof Joi) => { query?: Schema; body?: Schema; path?: Schema }) => RequestHandler;
//AuthKongMiddleware 是工厂函数，原测试以 new 调用（构造返回其内部中间件工厂），按构造形态断言保留调用方式
type AuthKongCtor = new () => () => RequestHandler;
const AuthKongMiddlewareCtor = AuthKongMiddleware as unknown as AuthKongCtor;

const getAuth = () => (DI.get('auth') as () => RequestHandler)();
const getValidator = () => (DI.get('validator') as ValidatorFactory);
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
    //catch 变量为 unknown，按抛出对象为 Error 断言
    assert.fail((error as Error).message);
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
    //catch 变量为 unknown，按抛出对象为 Error 断言
    assert.fail((error as Error).message);
  }
});

test('session store redis errors are logged instead of thrown', () => {
  const config = DI.get('config');
  //Config.get() 返回 unknown，按 session 配置结构取 store
  const originalStore = (config.get('session') as { store: unknown }).store;
  const fakeClient = new EventEmitter();
  (config.get() as { session: { store: unknown } }).session.store = { client: fakeClient };

  const logger = DI.get('logger');
  const originalError = logger.error;
  let logged: { msg: unknown; err: Error } | null = null;
  //mock 仅记录入参，不返回 Logger 实例
  logger.error = ((msg: unknown, err: Error) => {
    logged = { msg, err };
  }) as typeof logger.error;

  try {
    const middleware = (DI.get('session') as () => RequestHandler)();
    assert.equal(typeof middleware, 'function');
    assert.doesNotThrow(() => fakeClient.emit('error', new Error('redis down')));
  } finally {
    (config.get() as { session: { store: unknown } }).session.store = originalStore;
    logger.error = originalError;
  }
  //logged 只在闭包内赋值，TS 控制流收窄不到，按声明类型断言后取 err
  assert.ok(logged);
  assert.equal((logged as { msg: unknown; err: Error }).err.message, 'redis down');
});

test('session middleware initializes with connect-redis 10', () => {
  const middleware = (DI.get('session') as () => RequestHandler)();
  assert.equal(typeof middleware, 'function');
});

test('Kong auth accepts consumer headers', async () => {
  const request = mockRequest({ headers: {
    'x-consumer-custom-id': '9',
    'x-consumer-custom-username': 'nine'
  } });
  //中间件运行时在请求对象上挂载 auth，按最小结构断言
  const result = (await new Promise<unknown>((resolve, reject) => {
    new AuthKongMiddlewareCtor()()(request, response(), error => error ? reject(error) : resolve(request));
  })) as { auth: unknown };
  assert.deepEqual(result.auth, { uid: 9, mobile: 'nine' });
});

test('Kong auth rejects anonymous consumer', async () => {
  const request = mockRequest({ headers: { 'x-anonymous-consumer': 'true' } });
  const error = await new Promise(resolve => {
    new AuthKongMiddlewareCtor()()(request, response(), resolve);
  });
  assert.ok(error instanceof UnauthorizedException);
});
