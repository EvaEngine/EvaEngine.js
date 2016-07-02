import test from 'ava';
import * as exceptions from './../../src/exceptions';

test('CRC32', (t) => {
  t.is(exceptions.StandardException.crc32('Hello World'), 1243066710);
});
test('Hash', (t) => {
  t.is(exceptions.StandardException.crc32('111111'), 404288374);
  t.is(exceptions.StandardException.hash('111111'), '0404288374');
});
test('Should extends standard exception', (t) => {
  t.true(new exceptions.LogicException('foo') instanceof exceptions.StandardException);
});
test('Code', (t) => {
  t.is(new exceptions.LogicException('foo').getCode(), 385400003318127193);
});
test('Status code', (t) => {
  t.is(new exceptions.LogicException('foo').getStatusCode(), 400);
});
