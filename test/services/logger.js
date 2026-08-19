import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import Env from '../../src/services/env.js';
import Config from '../../src/services/config.js';
import Logger from '../../src/services/logger.js';
import winston from 'winston';

let oldEnv = null;
before(() => {
  oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
});
test('Logger init', () => {
  const logger = new Logger(new Env(), new Config());
  logger.setLogFile(`${import.meta.dirname}/../_demo_project/logs/test.log`);
  logger.setLabel('foo');
  logger.setLevel('debug');
  assert.equal(logger.getWinston(), winston);
  assert.ok(logger.getInstance() instanceof winston.Logger);
  assert.equal(Object.keys(logger.getInstance().transports).length, 2);
});
test('Logger interpolates printf placeholders', () => {
  const logger = new Logger(new Env(), new Config());
  logger.setLogFile(`${import.meta.dirname}/../_demo_project/logs/placeholder.log`);
  logger.setLevel('debug');
  const info = logger.getInstance().format.transform({
    message: 'Url %s saved to %s',
    [Symbol.for('splat')]: ['https://example.test', '/tmp/example.html']
  });
  assert.equal(info.message, 'Url https://example.test saved to /tmp/example.html');
  assert.match(info[Symbol.for('message')], /"message":"Url https:\/\/example\.test saved to \/tmp\/example\.html"/);
});
after(() => {
  process.env.NODE_ENV = oldEnv;
});
