import test from 'node:test';
import assert from 'node:assert/strict';
import wrapper from './../../src/utils/wrapper.js';

test('Wrapper', () => {
  assert.equal(typeof wrapper(() => {}), 'function');
});
