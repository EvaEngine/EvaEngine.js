import test from 'ava';
import { RuntimeException } from '../src/exceptions';
import DI from '../src/di';
import constitute from 'constitute';

test('throw exception when nothing bound', (t) => {
  t.throws(() => DI.get('not_bound'), RuntimeException);
});
test('bind value', async(t) => {
  class ValueClass {
  }
  DI.bindValue(ValueClass, 123);
  t.is(DI.get(ValueClass), 123);
});
test('bind method', async(t) => {
  DI.bindMethod('foo', () => () => 'bar');
  const method = DI.get('foo');
  t.true(typeof method === 'function');
  t.is('bar', method());
});
test('bind class', async(t) => {
  class Bar {
  }
  DI.bindClass('bar', Bar);
  t.true(DI.get('bar') instanceof Bar);
  t.true(Object.keys(DI.getBound()).includes('bar'));
});
test('reset container', async(t) => {
  class ValueClass {
  }
  DI.bindValue(ValueClass, 123);
  t.true(Object.keys(DI.getBound()).length > 0);
  DI.reset();
  t.is(Object.keys(DI.getBound()).length, 0);
  t.true(DI.getContainer() instanceof constitute.Container);
});
