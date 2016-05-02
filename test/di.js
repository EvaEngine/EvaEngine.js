import { describe, it } from 'mocha/lib/mocha';
import { assert } from './helpers';
import DI from '../src/di';

describe('DI', () => {
  it('bind method', async() => {
    DI.bindMethod('foo', () => () => 'bar');
    const method = DI.get('foo');
    assert.isFunction(method);
    assert.equal('bar', method());
  });
});
