import test from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.ts';
import * as providers from '../../src/services/providers.ts';
import * as middlewares from '../../src/middlewares/providers.ts';
import { mockRequest, mockResponse } from '../../src/utils/test.ts';
import type { RequestHandler } from 'express';
import TraceMiddleware from '../../src/middlewares/trace.ts';
import Namespace from '../../src/services/namespace.ts';
import Config from '../../src/services/config.ts';
import Logger from '../../src/services/logger.ts';
import HttpClient from '../../src/services/http_client.ts';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
//中间件 providers 只做 bind 不读取 config path，原测试按 JS 形态省略该参数
DI.registerMockedProviders(Object.values(middlewares), undefined as unknown as string);
test('Unique request id', () => {
  //DI 对 trace 无具名重载返回 unknown，按中间件工厂最小结构断言
  const middleware = (DI.get('trace') as () => RequestHandler)();
  const req = mockRequest();
  const res = mockResponse();
  middleware(req, res, () => {
  });
  assert.ok(res.getHeader('X-B3-SpanId'));
});

test('propagates disabled upstream sampling', () => {
  const middleware = (DI.get('trace') as () => RequestHandler)();
  const req = mockRequest({
    headers: {
      'x-b3-traceid': 'trace-id',
      'x-b3-spanid': '1',
      'x-b3-sampled': '0'
    }
  });
  const res = mockResponse();
  middleware(req, res, () => {
  });
  assert.equal(res.getHeader('X-B3-Sampled'), 0);
});

test('response events retain their trace after leaving the request context', () => {
  const config = {
    get: (key: string) => ({
      namespace: { enable: true },
      'trace.enable': true,
      'trace.api': 'http://trace.test/spans'
    } as Record<string, unknown>)[key]
  } as Config;
  const ns = new Namespace(config).setDefaultName('test.trace.response');
  const spans: unknown[] = [];
  const client = {
    request: (params: { json: unknown }) => {
      spans.push(params.json);
      return Promise.resolve();
    }
  } as unknown as HttpClient;
  const middleware = TraceMiddleware(ns, config, DI.get('logger') as Logger, client)('test-service');
  const responses = ['first', 'second'].map(id => {
    const req = mockRequest({ headers: { 'x-b3-traceid': id } });
    const res = mockResponse();
    middleware(req, res, () => {});
    res.writeHead(200);
    return res;
  });
  assert.equal(ns.get('tracer'), undefined);
  responses[1].emit('finish');
  responses[0].emit('finish');
  assert.deepEqual(spans.map(span => (span as Array<{ traceId: string }>)[0].traceId), ['second', 'first']);
  ns.destroy('test.trace.response');
});
