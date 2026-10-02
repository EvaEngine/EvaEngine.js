import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import Config from '../../src/services/config.ts';
import Redis from '../../src/services/redis.ts';
import ioredis from 'ioredis';
import DI from '../../src/di.ts';
import * as providers from '../../src/services/providers.ts';

//原测试按 JS 形态省略 Config 的 env 依赖（该用例不会读取配置文件）
const ConfigCtor = Config as unknown as new () => Config;
//ioredis 自带 d.ts 无 default 导出形态，运行时 default 即 Redis 类，instanceof 按类收窄
const IoredisClass = ioredis as unknown as abstract new (...args: never[]) => object;

let redisClient: Redis | null = null;
after(() => redisClient && redisClient.cleanup());

test('Redis init', () => {
  redisClient = new Redis(new ConfigCtor());
  redisClient.setOptions({});
  assert.equal(redisClient.getRedis(), ioredis);
  assert.ok(redisClient.getInstance() instanceof IoredisClass);
});

test('Redis instances do not share clients', () => {
  const first = new Redis(new ConfigCtor()).setOptions({ lazyConnect: true, port: 6380 });
  const second = new Redis(new ConfigCtor()).setOptions({ lazyConnect: true, port: 6381 });
  assert.notEqual(first.getInstance(), second.getInstance());
  first.cleanup();
  second.cleanup();
});

test('Redis errors are logged instead of swallowed', () => {
  DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
  const redis = DI.get('redis');
  const logger = DI.get('logger');
  const originalError = logger.error;
  let logged: { msg: unknown; err: Error } | null = null;
  //mock 仅记录入参，不返回 Logger 实例
  logger.error = ((msg: unknown, err: Error) => {
    logged = { msg, err };
  }) as typeof logger.error;
  try {
    assert.doesNotThrow(() => {
      redis.getInstance().emit('error', new Error('boom'));
    });
  } finally {
    logger.error = originalError;
  }
  assert.ok(logged);
  //logged 只在闭包内赋值，TS 控制流收窄不到，按声明类型断言后取 err
  assert.equal((logged as { msg: unknown; err: Error }).err.message, 'boom');
  redis.cleanup();
});
