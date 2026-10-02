import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.ts';
import * as exceptions from './../../src/exceptions/index.ts';
import * as providers from '../../src/services/providers.ts';
import { createTestServer } from '../_helpers/http_server.ts';

//dumpResponse/dumpRequest 声明返回 object | string，测试按实现的最小结构断言取字段
type DumpedResponse = { statusCode: number; statusMessage: string; headers: Record<string, unknown>; body: unknown };
type DumpedRequest = { method: string; protocol: string; url: string | null; headers: Record<string, unknown>; body: unknown };
//test/_helpers/http_server 未提供类型，按用例所需最小结构声明
type TestHttpServer = {
  baseUrl: string;
  queue: Array<{ statusCode?: number; body?: unknown; headers?: Record<string, unknown> }>;
  close: () => Promise<void>;
};

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const client = DI.get('http_client');

let httpServer: TestHttpServer;
before(async () => {
  httpServer = await createTestServer() as TestHttpServer;
});
after(() => httpServer.close());

test('Http client request success', async () => {
  httpServer.queue.push({ statusCode: 200, body: 'bar' });
  assert.equal(await client.request({
    url: `${httpServer.baseUrl}/foo`
  }), 'bar');
});

test('Http client failed by 4XX', async () => {
  httpServer.queue.push({ statusCode: 400, body: 'bar' });

  await assert.rejects(client.request({ url: `${httpServer.baseUrl}/foo` }), exceptions.HttpRequestLogicException);
});

test('Http client failed by 5XX', async () => {
  httpServer.queue.push({ statusCode: 500, body: 'bar' });

  await assert.rejects(client.request({ url: `${httpServer.baseUrl}/foo` }), exceptions.HttpRequestIOException);
});

test('Dump req & res', async () => {
  httpServer.queue.push({
    statusCode: 500,
    body: 'server crashed',
    headers: { 'x-foo': 'x-bar' }
  });
  try {
    await client.request({
      method: 'POST',
      url: `${httpServer.baseUrl}/foo`,
      headers: {
        hkey1: 'value1'
      },
      formData: {
        key1: 'value1',
        key2: 'value2'
      },
      resolveWithFullResponse: true
    });
    assert.fail('Request should reject');
  } catch (e) {
    //catch 变量为 unknown，按该用例实际抛出的 HTTP IO 异常断言后取 dump 入参
    const { statusCode, headers, body } = client.dumpResponse((e as exceptions.HttpRequestIOException).getResponse() as Parameters<typeof client.dumpResponse>[0]) as DumpedResponse;
    assert.equal(statusCode, 500);
    assert.equal(body, 'server crashed');
    assert.equal(headers['x-foo'], 'x-bar');
    const { method, protocol, url, body: resBody } = client.dumpRequest((e as exceptions.HttpRequestIOException).getRequest() as Parameters<typeof client.dumpRequest>[0]) as DumpedRequest;
    assert.equal(method, 'POST');
    assert.equal(protocol, 'http');
    assert.equal(resBody, 'key1=value1&key2=value2');
    assert.equal(url, `${httpServer.baseUrl}/foo`);
  }
});

test('Use 2XX as logic error', async () => {
  httpServer.queue.push({
    statusCode: 200,
    body: 'bar',
    headers: { 'x-server': 'eva' }
  });

  const response = await client.request({ url: `${httpServer.baseUrl}/foo`, resolveWithFullResponse: true });
  const e = (new exceptions.HttpRequestLogicException('Some logic error')).setResponse(response);
  const { statusCode, headers, body } = client.dumpResponse(e.getResponse() as Parameters<typeof client.dumpResponse>[0]) as DumpedResponse;
  assert.equal(statusCode, 200);
  assert.equal(body, 'bar');
  assert.equal(headers['x-server'], 'eva');
  const { method, protocol, url } = client.dumpRequest(e.getRequest() as Parameters<typeof client.dumpRequest>[0]) as DumpedRequest;
  assert.equal(method, 'GET');
  assert.equal(protocol, 'http');
  assert.equal(url, `${httpServer.baseUrl}/foo`);
});
