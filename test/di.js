import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeException } from '../src/exceptions/index.js';
import DI from '../src/di.js';
import constitute from 'constitute';

test('throw exception when nothing bound', () => {
  assert.throws(() => DI.get('not_bound'), RuntimeException);
});
test('bind value', () => {
  class ValueClass {
  }
  DI.bindValue(ValueClass, 123);
  assert.equal(DI.get(ValueClass), 123);
});
test('bind value by string key', () => {
  DI.bindValue('answer', 42);
  assert.equal(DI.get('answer'), 42);
  DI.bindValue('options', { a: 1, b: 'two' });
  assert.deepEqual(DI.get('options'), { a: 1, b: 'two' });
  DI.bindValue('nullable', null);
  assert.equal(DI.get('nullable'), null);
});
test('bind method', () => {
  DI.bindMethod('foo', () => () => 'bar');
  const method = DI.get('foo');
  assert.equal(typeof method, 'function');
  assert.equal('bar', method());
});
test('bind class', () => {
  class Bar {
  }
  DI.bindClass('bar', Bar);
  assert.ok(DI.get('bar') instanceof Bar);
  assert.ok(Object.keys(DI.getBound()).includes('bar'));
});
test('reset container', () => {
  class ValueClass {
  }
  DI.bindValue(ValueClass, 123);
  assert.ok(Object.keys(DI.getBound()).length > 0);
  DI.reset();
  assert.equal(Object.keys(DI.getBound()).length, 0);
  assert.ok(DI.getContainer() instanceof constitute.Container);
});
