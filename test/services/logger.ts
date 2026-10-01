import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import Env from '../../src/services/env.ts';
import Config from '../../src/services/config.ts';
import Logger from '../../src/services/logger.ts';
import winston from 'winston';

//原测试按 JS 形态省略构造依赖：Logger 的 namespace 未被触达，Config 的 env 因 logfile 已设置而不会读取
const LoggerCtor = Logger as unknown as new (env: Env, config: Config) => Logger;
const ConfigCtor = Config as unknown as new () => Config;
//logform transform 入参要求完整 TransformableInfo（含 level）、返回为对象|boolean 联合，按测试所需最小结构断言
type SplattedInfo = { message: unknown } & Record<string | symbol, unknown>;

let oldEnv: string | undefined = undefined;
before(() => {
  oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
});
test('Logger init', () => {
  const logger = new LoggerCtor(new Env(), new ConfigCtor());
  logger.setLogFile(`${import.meta.dirname}/../_demo_project/logs/test.log`);
  logger.setLabel('foo');
  logger.setLevel('debug');
  assert.equal(logger.getWinston(), winston);
  assert.ok(logger.getInstance() instanceof winston.Logger);
  assert.equal(Object.keys(logger.getInstance().transports).length, 2);
});
test('Logger interpolates printf placeholders', () => {
  const logger = new LoggerCtor(new Env(), new ConfigCtor());
  logger.setLogFile(`${import.meta.dirname}/../_demo_project/logs/placeholder.log`);
  logger.setLevel('debug');
  const info = logger.getInstance().format.transform({
    message: 'Url %s saved to %s',
    [Symbol.for('splat')]: ['https://example.test', '/tmp/example.html']
  } as never) as unknown as SplattedInfo;
  assert.equal(info.message, 'Url https://example.test saved to /tmp/example.html');
  assert.match(info[Symbol.for('message')] as string, /"message":"Url https:\/\/example\.test saved to \/tmp\/example\.html"/);
});
after(() => {
  process.env.NODE_ENV = oldEnv;
});
