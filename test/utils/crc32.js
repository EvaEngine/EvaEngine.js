import test from 'ava';
import crc32 from './../../src/utils/crc32';

test('CRC32', (t) => {
  t.is(crc32('Hello World'), 1243066710);
});
