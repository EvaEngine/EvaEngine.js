import test from 'ava';
import nock from 'nock';
import DI from '../../src/di';
import * as exceptions from './../../src/exceptions';
import * as providers from '../../src/services/providers';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
const client = DI.get('http_client');

test('Http client request success', async(t) => {
  nock('http://example.com')
    .get('/foo')
    .reply(200, 'bar');
  t.is(await client.request({
    url: 'http://example.com/foo'
  }), 'bar');
});

test('Http client failed by 4XX', async(t) => {
  t.plan(1);
  nock('http://example.com')
    .get('/foo')
    .reply(400, 'bar');

  try {
    await client.request({ url: 'http://example.com/foo' });
  } catch (e) {
    t.true(e instanceof exceptions.HttpRequestLogicException);
  }
});

test('Http client failed by 5XX', async(t) => {
  t.plan(1);
  nock('http://example.com')
    .get('/foo')
    .reply(500, 'bar');

  try {
    await client.request({ url: 'http://example.com/foo' });
  } catch (e) {
    t.true(e instanceof exceptions.HttpRequestIOException);
  }
});

test('Dump req & res', async(t) => {
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
  } catch (e) {
    const { statusCode, headers, body } = client.dumpResponse(e.getResponse());
    t.is(statusCode, 500);
    t.is(body, 'server crashed');
    t.deepEqual(headers, {
      'x-foo': 'x-bar'
    });
    const { method, protocol, url, body: resBody } = client.dumpRequest(e.getRequest());
    t.is(method, 'POST');
    t.is(protocol, 'https');
    t.is(resBody, 'key1=value1&key2=value2');
    t.deepEqual(url, 'https://example.com/foo');
  }
});

test('Use 2XX as logic error', async(t) => {
  nock('http://example.com')
    .get('/foo')
    .reply(200, 'bar');

  const response = await client.request({ url: 'http://example.com/foo', resolveWithFullResponse: true });
  const e = (new exceptions.HttpRequestLogicException('Some logic error')).setResponse(response);
  const { statusCode, headers, body } = client.dumpResponse(e.getResponse());
  t.is(statusCode, 200);
  t.is(body, 'bar');
  t.deepEqual(headers, {});
  const { method, protocol, url } = client.dumpRequest(e.getRequest());
  t.is(method, 'GET');
  t.is(protocol, 'http');
  t.deepEqual(url, 'http://example.com/foo');
});

