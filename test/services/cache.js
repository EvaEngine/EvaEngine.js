import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.js';
import * as providers from '../../src/services/providers.js';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const cache = DI.get('cache');

beforeEach(async () => {
  await cache.flush();
});
after(() => DI.get('redis').cleanup());

test('Cache get && set && del', async () => {
  await cache.set('foo', 'bar');
  assert.equal(await cache.get('foo'), 'bar');
  await cache.del('foo');
  assert.equal(await cache.get('foo'), null);
});

test('Cache namespace get & set', async () => {
  await cache.namespace('ns').set('foo', 'bar');
  assert.equal(await cache.namespace('ns').get('foo'), 'bar');
  assert.equal(await cache.namespace('ns1').has('foo'), false);
});

test('Cache namespace flush', async () => {
  await cache.namespace('ns').set('foo', 'bar');
  await cache.namespace('ns1').set('foo', 'bar');
  await cache.namespace('ns').flush();
  assert.equal(await cache.namespace('ns').has('foo'), false);
  assert.equal(await cache.namespace('ns1').has('foo'), true);
});

test('Cache set nx || xx', async () => {
  let ret = await cache.set('foo', 'bar', 0, 'xx');

  assert.equal(ret, null);

  ret = await cache.set('foo', 'bar', 0, 'nx');
  assert.equal(ret, 'OK');
  ret = await cache.set('foo', 'bar', 0, 'nx');
  assert.equal(ret, null);

  ret = await cache.set('foo', 'bar', 0, 'xx');
  assert.equal(ret, 'OK');
  ret = await cache.set('foo', 'bar', 1, 'xx');
  assert.equal(ret, 'OK');

  await cache.flush();
});

test('Cache namespace set nx || xx', async () => {
  let ret = await cache.namespace('ns').set('foo', 'bar', 0, 'xx');

  assert.equal(ret, null);

  ret = await cache.namespace('ns').set('foo', 'bar', 0, 'nx');
  assert.equal(ret, 'OK');
  ret = await cache.namespace('ns').set('foo', 'bar', 0, 'nx');
  assert.equal(ret, null);

  ret = await cache.namespace('ns').set('foo', 'bar', 0, 'xx');
  assert.equal(ret, 'OK');
  ret = await cache.namespace('ns').set('foo', 'bar', 1, 'xx');
  assert.equal(ret, 'OK');

  await cache.namespace('ns').flush();
});

test('Cache namespace flush returns', async () => {
  assert.equal(await cache.namespace('ns').flush(), 0);

  await cache.namespace('ns').set('foo1', 'bar1', 0, 'nx');
  await cache.namespace('ns').set('foo2', 'bar2', 0, 'xx');
  await cache.namespace('ns').set('foo3', 'bar3');
  assert.equal(await cache.namespace('ns').flush(), 2);
});
