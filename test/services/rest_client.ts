import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.ts';
import * as exceptions from './../../src/exceptions/index.ts';
import * as providers from '../../src/services/providers.ts';
import { createTestServer } from '../_helpers/http_server.ts';

//test/_helpers/http_server 未提供类型，按用例所需最小结构声明
type TestHttpServer = {
  baseUrl: string;
  queue: Array<{ statusCode?: number; body?: unknown; headers?: Record<string, unknown> }>;
  close: () => Promise<void>;
};

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const client = DI.get('rest_client');

let httpServer: TestHttpServer;
before(async () => {
  httpServer = await createTestServer() as TestHttpServer;
});
after(() => httpServer.close());

test('Rest client request success', async () => {
  httpServer.queue.push({ statusCode: 200, body: 'bar' });
  const res = await client.request({
    url: `${httpServer.baseUrl}/foo`
  });
  assert.equal(res, 'bar');
});

test('Http client failed by 4XX', async () => {
  httpServer.queue.push({
    statusCode: 400,
    body: {
      name: 'InvalidArgumentException',
      code: 123,
      statusCode: 400,
      message: 'InvalidArgumentException'
    }
  });

  await assert.rejects(async () => {
    try {
      await client.request({ url: `${httpServer.baseUrl}/foo` });
    } catch (e) {
      assert.ok(e instanceof exceptions.RestServiceLogicException);
      assert.ok(e.getPrevError() instanceof exceptions.InvalidArgumentException);
      throw e;
    }
  }, exceptions.RestServiceLogicException);
});

test('Http client failed by 5XX', async () => {
  httpServer.queue.push({ statusCode: 500, body: 'bar' });

  await assert.rejects(client.request({ url: `${httpServer.baseUrl}/foo` }), exceptions.RestServiceIOException);
});
