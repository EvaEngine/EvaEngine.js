import test from 'node:test';
import assert from 'node:assert/strict';
import DI from '../../src/di.js';
import * as exceptions from './../../src/exceptions/index.js';
import * as providers from '../../src/services/providers.js';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const eventManager = DI.get('event_manager');

test('Register non function', () => {
  assert.throws(() => eventManager.addListener('foo'), exceptions.RuntimeException);
  assert.throws(() => eventManager.addListener(class Foo {
  }), exceptions.RuntimeException);
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
