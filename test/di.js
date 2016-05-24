import { describe, it } from 'mocha/lib/mocha';
import { assert, expect } from './helpers';
import { RuntimeException } from '../src/exceptions';
import DI from '../src/di';
import constitute from 'constitute';

describe('DI', () => {
  it('throw exception when nothing bound', () => {
    assert.throw(() => DI.get('not_bound'), RuntimeException);
  });
  it('bind value', async() => {
    class ValueClass {}
    DI.bindValue(ValueClass, 123);
    assert.equal(DI.get(ValueClass), 123);
  });
  it('bind method', async() => {
    DI.bindMethod('foo', () => () => 'bar');
    const method = DI.get('foo');
    assert.isFunction(method);
    assert.equal('bar', method());
  });
  it('bind class', async() => {
    class Bar {}
    DI.bindClass('bar', Bar);
    assert.instanceOf(DI.get('bar'), Bar);
    assert.property(DI.getBound(), 'bar');
  });
  it('reset container', async() => {
    class ValueClass {}
    DI.bindValue(ValueClass, 123);
    assert.isAbove(Object.keys(DI.getBound()).length, 0);
    DI.reset();
    assert.equal(Object.keys(DI.getBound()).length, 0);
    assert.instanceOf(DI.getContainer(), constitute.Container);
  });
});
