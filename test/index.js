import test from 'node:test';
import assert from 'node:assert/strict';
import engineIndex from '../src/index.js';

test('index', () => {
  assert.ok(Object.keys(engineIndex).length >= 14);
});
