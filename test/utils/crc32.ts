import test from 'node:test';
import assert from 'node:assert/strict';
import crc32 from './../../src/utils/crc32.ts';

test('CRC32', () => {
  assert.equal(crc32('Hello World'), 1243066710);
});
