import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHostFullUrl,
} from './../../src/utils/host.js';

test('Host full url', () => {
  assert.equal(getHostFullUrl({
    protocol: 'http',
    originalUrl: '/foo',
    get: () => 'evaengine.com'
  }), 'http://evaengine.com/foo');

  assert.equal(getHostFullUrl({
    protocol: 'http',
    originalUrl: '/foo',
    get: () => 'evaengine.com'
  }, '/bar'), 'http://evaengine.com/bar');
});
