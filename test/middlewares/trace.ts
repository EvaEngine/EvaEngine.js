import test from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.ts';
import * as providers from '../../src/services/providers.ts';
import * as middlewares from '../../src/middlewares/providers.ts';
import { mockRequest, mockResponse } from '../../src/utils/test.ts';
import type { RequestHandler } from 'express';

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
