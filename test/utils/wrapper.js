import test from 'node:test';
import assert from 'node:assert/strict';
import * as is from 'is-type-of';
import wrapper from './../../src/utils/wrapper.js';

test('Wrapper', () => {
  assert.ok(is.function(wrapper(() => {})));
});
