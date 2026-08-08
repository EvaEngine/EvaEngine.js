import test from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import DI from '../../src/di.js';
import * as exceptions from './../../src/exceptions/index.js';
import * as providers from '../../src/services/providers.js';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const client = DI.get('http_client');

test('Http client request success', async () => {
  nock('http://example.com')
    .get('/foo')
    .reply(200, 'bar');
  assert.equal(await client.request({
    url: 'http://example.com/foo'
  }), 'bar');
});

test('Http client failed by 4XX', async () => {
  nock('http://example.com')
    .get('/foo')
    .reply(400, 'bar');

  await assert.rejects(client.request({ url: 'http://example.com/foo' }), exceptions.HttpRequestLogicException);
});

test('Http client failed by 5XX', async () => {
  nock('http://example.com')
    .get('/foo')
    .reply(500, 'bar');

  await assert.rejects(client.request({ url: 'http://example.com/foo' }), exceptions.HttpRequestIOException);
});

test('Dump req & res', async () => {
  nock('https://example.com')
    .post('/foo')
    .reply(500, 'server crashed', {
      'x-foo': 'x-bar'
    });
  try {
    await client.request({
      method: 'POST',
      url: 'https://example.com/foo',
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
    const { statusCode, headers, body } = client.dumpResponse(e.getResponse());
    assert.equal(statusCode, 500);
    assert.equal(body, 'server crashed');
    assert.deepEqual(headers, {
      'x-foo': 'x-bar'
    });
    const { method, protocol, url, body: resBody } = client.dumpRequest(e.getRequest());
    assert.equal(method, 'POST');
    assert.equal(protocol, 'https');
    assert.equal(resBody, 'key1=value1&key2=value2');
    assert.deepEqual(url, 'https://example.com/foo');
  }
});

test('Use 2XX as logic error', async () => {
  nock('http://example.com')
    .get('/foo')
    .reply(200, 'bar');

  const response = await client.request({ url: 'http://example.com/foo', resolveWithFullResponse: true });
  const e = (new exceptions.HttpRequestLogicException('Some logic error')).setResponse(response);
  const { statusCode, headers, body } = client.dumpResponse(e.getResponse());
  assert.equal(statusCode, 200);
  assert.equal(body, 'bar');
  assert.deepEqual(headers, {});
  const { method, protocol, url } = client.dumpRequest(e.getRequest());
  assert.equal(method, 'GET');
  assert.equal(protocol, 'http');
  assert.deepEqual(url, 'http://example.com/foo');
});
