import test from 'node:test';
import assert from 'node:assert/strict';
import { NsStore, NullStore } from '../../src/services/namespace.ts';
import { OperationUnsupportedException } from '../../src/exceptions/index.ts';

test('NsStore set/get inside run, get outside run returns undefined', () => {
  const store = new NsStore('test.ns.basic');
  assert.equal(store.get('key'), undefined);
  store.run(() => {
    store.set('key', 'value');
    assert.equal(store.get('key'), 'value');
  });
  assert.equal(store.get('key'), undefined);
});

test('NsStore run passes created context as first callback argument (CLS semantics)', () => {
  const store = new NsStore('test.ns.context-arg');
  store.run((context) => {
    assert.ok(context instanceof Map);
    context.set('from-arg', 1);
    assert.equal(store.get('from-arg'), 1);
  });
});

test('NsStore concurrent runs are isolated', async() => {
  const store = new NsStore('test.ns.isolated');
  const picks: Array<string | undefined> = [];
  await Promise.all([
    new Promise<void>((resolve) => {
      store.run(() => {
        store.set('who', 'a');
        setTimeout(() => {
          picks.push(store.get('who') as string);
          resolve();
        }, 20);
      });
    }),
    new Promise<void>((resolve) => {
      store.run(() => {
        store.set('who', 'b');
        setTimeout(() => {
          picks.push(store.get('who') as string);
          resolve();
        }, 10);
      });
    })
  ]);
  assert.deepEqual(picks.sort(), ['a', 'b']);
});

test('NsStore bind keeps the context of binding site', async() => {
  const store = new NsStore('test.ns.bind');
  let bound: () => unknown = () => null;
  store.run(() => {
    store.set('token', 'abc');
    bound = store.bind(() => store.get('token')) as () => unknown;
  });
  // Run outside of the original run's synchronous scope; the bound function
  // must still see the context captured at bind time.
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(bound(), 'abc');
});

test('NsStore values do not leak across reset', () => {
  const store = new NsStore('test.ns.reset');
  store.run(() => {
    store.set('key', 'value');
  });
  store.reset();
  store.run(() => {
    assert.equal(store.get('key'), undefined);
  });
});

test('NsStore active and createContext', () => {
  const store = new NsStore('test.ns.active');
  assert.equal(store.active(), undefined);
  assert.ok(store.createContext() instanceof Map);
  store.run(() => {
    assert.ok(store.active() instanceof Map);
  });
});

test('NullStore is a no-op store', () => {
  const store = new NullStore('test.ns.null');
  assert.equal(store.get('key'), null);
  assert.equal(store.set('key', 'value'), store);
  assert.equal(store.active(), undefined);
  assert.equal(store.run(() => 'ran'), 'ran');
  assert.throws(() => store.getContext(), OperationUnsupportedException);
});

test('nested scopes inherit parent values without leaking child writes', () => {
  const store = new NsStore('test.ns.nested');
  store.run(() => {
    store.set('transaction', 'outer');
    store.set('tracer', 'request');
    store.run(() => {
      assert.equal(store.get('transaction'), 'outer');
      assert.equal(store.get('tracer'), 'request');
      store.set('transaction', 'inner');
    });
    assert.equal(store.get('transaction'), 'outer');
  });
});

test('bind preserves receiver, arguments and return type', () => {
  const store = new NsStore('test.ns.receiver');
  let bound: (this: { base: number }, value: number) => number;
  store.run(() => {
    store.set('increment', 3);
    bound = store.bind(function(this: { base: number }, value: number) {
      return this.base + value + (store.get('increment') as number);
    });
  });
  assert.equal(bound!.call({ base: 10 }, 2), 15);
});
