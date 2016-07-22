import test from 'ava';
import Env from '../../src/services/env';
import Config from '../../src/services/config';
import Logger from '../../src/services/logger';
import winston from 'winston';

let oldEnv = null;
test.before('Set env to production', () => {
  oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
});
test('Logger init', (t) => {
  const logger = new Logger(new Env(), new Config());
  logger.setLogFile(`${__dirname}/../_demo_project/logs/test.log`);
  logger.setLabel('foo');
  logger.setLevel('debug');
  t.is(logger.getWinston(), winston);
  t.true(logger.getInstance() instanceof winston.Logger);
  t.is(Object.keys(logger.getInstance().transports).length, 2);
});
test.after('Restore env', () => {
  process.env.NODE_ENV = oldEnv;
});
