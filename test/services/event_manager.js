import test from 'ava';
import DI from '../../src/di';
import * as exceptions from './../../src/exceptions';
import * as providers from '../../src/services/providers';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
const eventManager = DI.get('event_manager');

test('Register non function', async(t) => {
  t.throws(() => eventManager.addListener('foo'), exceptions.RuntimeException);
  t.throws(() => eventManager.addListener(class Foo {
  }), exceptions.RuntimeException);
});


test('Register standard class', async(t) => {
  t.plan(9);
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
      t.true(isLogin);
    }
  }
  eventManager.addListener(Foo);
  const events = eventManager.getAllowEvents()
  t.skip.true(events instanceof Set);
  t.is(events.size, 4);
  t.true(events.has('foo:login:before'));
  t.true(events.has('foo:login:after'));
  t.true(events.has('foo:register:before'));
  t.true(events.has('foo:register:after'));
  t.deepEqual(eventManager.getEmitter().eventNames(), ['foo:login:after']);
  t.false(isLogin);
  eventManager.emit('foo:login:after');
});

test('Emit non exists event', async(t) => {
  t.throws(() => eventManager.emit('non-exists'), exceptions.RuntimeException);
});

test('Register repeat event', async(t) => {
  class Bar {
    get prefix() {
      return 'foo';
    }

    get actions() {
      return ['login', 'other'];
    }
  }
  t.throws(() => eventManager.addListener(Bar), exceptions.RuntimeException);
});
