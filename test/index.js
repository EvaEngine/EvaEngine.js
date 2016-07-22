import test from 'ava';
import engineIndex from '../src/';

test('index', (t) => {
  t.true(Object.keys(engineIndex).length >= 14);
});
