import test from 'ava';
import Config from '../../src/services/config.js';
import Redis from '../../src/services/redis.js';
import ioredis from 'ioredis';

let redisClient;
test.after.always('Close Redis', () => redisClient && redisClient.cleanup());

test('Redis init', (t) => {
  redisClient = new Redis(new Config());
  redisClient.setOptions({});
  t.is(redisClient.getRedis(), ioredis);
  t.true(redisClient.getInstance() instanceof ioredis);
});

test('Redis instances do not share clients', (t) => {
  const first = new Redis(new Config()).setOptions({ lazyConnect: true, port: 6380 });
  const second = new Redis(new Config()).setOptions({ lazyConnect: true, port: 6381 });
  t.not(first.getInstance(), second.getInstance());
  first.cleanup();
  second.cleanup();
});
