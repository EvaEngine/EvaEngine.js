import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeException } from '../src/exceptions/index.ts';
import DI, { Container, Dependencies } from '../src/di.ts';

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
test('caches singletons within the container', () => {
  class Singleton {
    hits = 0;
  }
  const first = DI.get(Singleton);
  first.hits += 1;
  const second = DI.get(Singleton);
  assert.strictEqual(second, first);
  assert.equal(second.hits, 1);
});
test('resolves dependency chains level by level', () => {
  class Layer0 {
  }
  class Layer1 {
    static dependencies = [Layer0];

    dep: Layer0;

    constructor(dep: Layer0) {
      this.dep = dep;
    }
  }
  class Layer2 {
    static dependencies = [Layer1];

    dep: Layer1;

    constructor(dep: Layer1) {
      this.dep = dep;
    }
  }
  const top = DI.get(Layer2);
  assert.ok(top.dep instanceof Layer1);
  assert.ok(top.dep.dep instanceof Layer0);
  assert.strictEqual(top.dep, DI.get(Layer1));
});
test('bindClass with a prebuilt instance keeps mutations visible (provider pattern)', () => {
  class Service {
    path: string | null = null;

    setPath(path: string): this {
      this.path = path;
      return this;
    }
  }
  const prebuilt = DI.get(Service);
  prebuilt.setPath('/before');
  DI.bindClass('prebuilt_service', Service, [prebuilt]);
  assert.strictEqual(DI.get(Service), prebuilt);
  assert.strictEqual(DI.get<object>('prebuilt_service'), prebuilt);
  assert.equal(prebuilt.path, '/before');
});
test('bindMethod injects declared dependencies and caches the inner factory', () => {
  class SessionConfig {
    secret = 's3cret';
  }
  function SessionFactory(config: SessionConfig) {
    return () => `session:${config.secret}`;
  }
  Dependencies(SessionConfig)(SessionFactory);
  DI.bindMethod('session_factory', SessionFactory);
  const first = DI.get<() => string>('session_factory');
  const second = DI.get<() => string>('session_factory');
  assert.strictEqual(first, second);
  assert.equal(first(), 'session:s3cret');
});
test('function middleware factories receive container singletons', () => {
  class RequestNamespace {
  }
  function TraceFactory(ns: RequestNamespace) {
    return { ns };
  }
  Dependencies(RequestNamespace)(TraceFactory);
  DI.bindMethod('trace_like', TraceFactory);
  const inner = DI.get<{ ns: RequestNamespace }>('trace_like');
  assert.ok(inner.ns instanceof RequestNamespace);
  assert.strictEqual(inner.ns, DI.get(RequestNamespace));
});
test('throws on circular dependencies with the resolution chain', () => {
  class LoopA {
  }
  class LoopB {
  }
  Dependencies(LoopB)(LoopA);
  Dependencies(LoopA)(LoopB);
  assert.throws(() => DI.get(LoopA), /Circular dependency detected: LoopA => LoopB => LoopA/);
});
test('reset container', () => {
  class ValueClass {
  }
  DI.bindValue(ValueClass, 123);
  assert.ok(Object.keys(DI.getBound()).length > 0);
  DI.reset();
  assert.equal(Object.keys(DI.getBound()).length, 0);
  assert.ok(DI.getContainer() instanceof Container);
});
test('reset isolates singleton cache between containers', () => {
  class Rebuilt {
  }
  const before = DI.get(Rebuilt);
  DI.reset();
  const after = DI.get(Rebuilt);
  assert.notStrictEqual(before, after);
});
