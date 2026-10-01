import test from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.ts';
import * as exceptions from './../../src/exceptions/index.ts';
import * as providers from '../../src/services/providers.ts';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const eventManager = DI.get('event_manager');

test('Register non function', () => {
  //故意传入非法监听以断言抛错，按 addListener 形参类型断言绕过字面量检查
  assert.throws(() => eventManager.addListener('foo' as unknown as Parameters<typeof eventManager.addListener>[0]), exceptions.RuntimeException);
  assert.throws(() => eventManager.addListener((class Foo {
  }) as unknown as Parameters<typeof eventManager.addListener>[0]), exceptions.RuntimeException);
});

test('Register standard class', () => {
  let isLogin = false;
  class Foo {
    get prefix() {
      return 'foo';
    }

    get actions() {
      return ['login', 'register'];
    }

    afterLogin() {
      isLogin = true;
    }
  }
  eventManager.addListener(Foo);
  const events = eventManager.getAllowEvents();
  assert.ok(events instanceof Set);
  assert.equal(events.size, 4);
  assert.ok(events.has('foo:login:before'));
  assert.ok(events.has('foo:login:after'));
  assert.ok(events.has('foo:register:before'));
  assert.ok(events.has('foo:register:after'));
  assert.deepEqual(eventManager.getEmitter().eventNames(), ['foo:login:after']);
  assert.equal(isLogin, false);
  eventManager.emit('foo:login:after');
  assert.ok(isLogin);
});

test('Emit non exists event', () => {
  assert.throws(() => eventManager.emit('non-exists'), exceptions.RuntimeException);
});

test('Register repeat event', () => {
  class Bar {
    get prefix() {
      return 'foo';
    }

    get actions() {
      return ['login', 'other'];
    }
  }
  assert.throws(() => eventManager.addListener(Bar), exceptions.RuntimeException);
});
