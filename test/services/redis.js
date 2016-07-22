import test from 'ava';
import Config from '../../src/services/config';
import Redis from '../../src/services/redis';
import redis from 'redis';

test('Redis init', (t) => {
  const redisClient = new Redis(new Config());
  redisClient.setOptions({});
  t.is(redisClient.getRedis(), redis);
  t.true(redisClient.getInstance() instanceof redis.RedisClient);
  t.true(typeof redisClient.getInstance().getAsync === 'function');
});
