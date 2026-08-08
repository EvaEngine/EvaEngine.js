import test from 'node:test';
import assert from 'node:assert/strict';
import { randomString } from './../../src/utils/random.js';

test('Random string', () => {
  assert.equal(randomString(1).length, 1);
  assert.equal(randomString().length, 16);
  assert.equal(randomString(512).length, 512);
});
