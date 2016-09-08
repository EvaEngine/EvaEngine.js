import test from 'ava';
import { randomString } from './../../src/utils/random';

test('Random string', (t) => {
  t.is(randomString(1).length, 1);
  t.is(randomString().length, 16);
  t.is(randomString(32).length, 32);
});
