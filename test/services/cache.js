import test from 'ava';
import DI from '../../src/di';
import * as providers from '../../src/services/providers';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
const cache = DI.get('cache');

test.beforeEach('Flush all', () => {
  cache.flush();
});

test('Cache get & set', async(t) => {
  await cache.set('foo', 'bar');
  t.is(await cache.get('foo'), 'bar');
});

test('Cache namespace get & set', async(t) => {
  await cache.namespace('ns').set('foo', 'bar');
  t.is(await cache.namespace('ns').get('foo'), 'bar');
  t.is(await cache.namespace('ns1').has('foo'), false);
});

test('Cache namespace flush', async(t) => {
  await cache.namespace('ns').set('foo', 'bar');
  await cache.namespace('ns1').set('foo', 'bar');
  await cache.namespace('ns').flush();
  t.is(await cache.namespace('ns').has('foo'), false);
  t.is(await cache.namespace('ns1').has('foo'), true);
});

test('Cache namespace set nx || xx', async(t) => {
  let ret = await cache.namespace('ns').set('foo', 'bar', 0, 'xx');
  t.true(ret === null);

  ret = await cache.namespace('ns').set('foo', 'bar', 0, 'nx');
  t.true(ret === 'OK');
  ret = await cache.namespace('ns').set('foo', 'bar', 0, 'nx');
  t.true(ret === null);
  
  ret = await cache.namespace('ns').set('foo', 'bar', 0, 'xx');
  t.true(ret === 'OK');

  await cache.namespace('ns').flush();
});

