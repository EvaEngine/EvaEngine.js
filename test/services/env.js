import test from 'ava';
import Env from '../../src/services/env';

let oldEnv = null;

test.before('Set env to production', () => {
  oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
});
test('Default env', (t) => {
  const env = new Env();
  t.is('production', env.get());
  t.false(env.isDevelopment());
  t.true(env.isProduction());
  t.false(env.isTest());
});
test('Is Singleton mode', (t) => {
  const env = new Env();
  t.is('production', env.get());
});
test.after('Restore env', () => {
  process.env.NODE_ENV = oldEnv;
});
