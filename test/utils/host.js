import test from 'ava';
import {
  getHostFullUrl,
} from './../../src/utils/host';

test('Host full url', (t) => {
  t.is(getHostFullUrl({
    protocol: 'http',
    originalUrl: '/foo',
    get: () => 'evaengine.com'
  }), 'http://evaengine.com/foo');

  t.is(getHostFullUrl({
    protocol: 'http',
    originalUrl: '/foo',
    get: () => 'evaengine.com'
  }, '/bar'), 'http://evaengine.com/bar');
});
