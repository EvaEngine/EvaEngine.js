import test from 'ava';
import nock from 'nock';
import DI from '../../src/di';
import * as exceptions from './../../src/exceptions';
import * as providers from '../../src/services/providers';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
const client = DI.get('rest_client');

test('Rest client request success', async(t) => {
  nock('http://example.com')
    .get('/foo')
    .reply(200, 'bar');
  const res = await client.request({
    url: 'http://example.com/foo'
  });
  t.is(res, 'bar');
});

test('Http client failed by 4XX', async(t) => {
  t.plan(2);
  nock('http://example.com')
    .get('/foo')
    .reply(400, {
      name: 'InvalidArgumentException',
      code: 123,
      statusCode: 400,
      message: 'InvalidArgumentException'
    });

  try {
    await client.request({ url: 'http://example.com/foo' });
  } catch (e) {
    t.true(e instanceof exceptions.RestServiceLogicException);
    t.true(e.getPrevError() instanceof exceptions.InvalidArgumentException);
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
    t.true(e instanceof exceptions.RestServiceIOException);
  }
});
