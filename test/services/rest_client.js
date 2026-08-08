import test from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import DI from '../../src/di.js';
import * as exceptions from './../../src/exceptions/index.js';
import * as providers from '../../src/services/providers.js';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const client = DI.get('rest_client');

test('Rest client request success', async () => {
  nock('http://example.com')
    .get('/foo')
    .reply(200, 'bar');
  const res = await client.request({
    url: 'http://example.com/foo'
  });
  assert.equal(res, 'bar');
});

test('Http client failed by 4XX', async () => {
  nock('http://example.com')
    .get('/foo')
    .reply(400, {
      name: 'InvalidArgumentException',
      code: 123,
      statusCode: 400,
      message: 'InvalidArgumentException'
    });

  await assert.rejects(async () => {
    try {
      await client.request({ url: 'http://example.com/foo' });
    } catch (e) {
      assert.ok(e instanceof exceptions.RestServiceLogicException);
      assert.ok(e.getPrevError() instanceof exceptions.InvalidArgumentException);
      throw e;
    }
  }, exceptions.RestServiceLogicException);
});

test('Http client failed by 5XX', async () => {
  nock('http://example.com')
    .get('/foo')
    .reply(500, 'bar');

  await assert.rejects(client.request({ url: 'http://example.com/foo' }), exceptions.RestServiceIOException);
});
