import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import Config from '../../src/services/config.js';
import Redis from '../../src/services/redis.js';
import ioredis from 'ioredis';
import DI from '../../src/di.js';
import * as providers from '../../src/services/providers.js';

let redisClient;
after(() => redisClient && redisClient.cleanup());

test('Redis init', () => {
  redisClient = new Redis(new Config());
  redisClient.setOptions({});
  assert.equal(redisClient.getRedis(), ioredis);
  assert.ok(redisClient.getInstance() instanceof ioredis);
});

test('Redis instances do not share clients', () => {
  const first = new Redis(new Config()).setOptions({ lazyConnect: true, port: 6380 });
  const second = new Redis(new Config()).setOptions({ lazyConnect: true, port: 6381 });
  assert.notEqual(first.getInstance(), second.getInstance());
  first.cleanup();
  second.cleanup();
});

test('Redis errors are logged instead of swallowed', () => {
  DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
  const redis = DI.get('redis');
  const logger = DI.get('logger');
  const originalError = logger.error;
  let logged = null;
  logger.error = (msg, err) => {
    logged = { msg, err };
  };
  try {
    assert.doesNotThrow(() => {
      redis.getInstance().emit('error', new Error('boom'));
    });
  } finally {
    logger.error = originalError;
  }
  assert.ok(logged);
  assert.equal(logged.err.message, 'boom');
  redis.cleanup();
});
