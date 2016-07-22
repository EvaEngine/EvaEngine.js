import test from 'ava';
import * as exceptions from './../../src/exceptions';

test('Hash', (t) => {
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
test('Stack Beautifier', (t) => {
  t.deepEqual(exceptions.StandardException.stackBeautifier(`foo
bar`), ['foo', 'bar']);
  t.deepEqual(exceptions.StandardException.stackBeautifier(`foo
node_modules/abc
something/(node.js)
something/(native)
bar`), ['foo', 'bar']);
});
