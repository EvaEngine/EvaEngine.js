import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeException } from '../src/exceptions/index.ts';
import DI from '../src/di.ts';
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
  // DI.get 的字符串重载返回 unknown，按绑定语义收窄为可调用方法
  const method = DI.get<() => string>('foo');
  assert.equal(typeof method, 'function');
  assert.equal('bar', method());
});
test('bind class', () => {
  class Bar {
  }
  DI.bindClass('bar', Bar);
  // DI.get 的字符串重载返回 unknown，instanceof 要求对象类型，收窄为 object
  assert.ok(DI.get<object>('bar') instanceof Bar);
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
