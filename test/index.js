import test from 'ava';
import engineIndex from '../src/index.js';

test('index', (t) => {
  t.true(Object.keys(engineIndex).length >= 14);
});
