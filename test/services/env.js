import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import Env from '../../src/services/env.js';

let oldEnv = null;

before(() => {
  oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
});
test('Default env', () => {
  const env = new Env();
  assert.equal('production', env.get());
  assert.equal(env.isDevelopment(), false);
  assert.ok(env.isProduction());
  assert.equal(env.isTest(), false);
});
test('Is Singleton mode', () => {
  const env = new Env();
  assert.equal('production', env.get());
});
after(() => {
  process.env.NODE_ENV = oldEnv;
});
