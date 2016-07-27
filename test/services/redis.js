import test from 'ava';
import Config from '../../src/services/config';
import Redis from '../../src/services/redis';
import ioredis from 'ioredis';

test('Redis init', (t) => {
  const redisClient = new Redis(new Config());
  redisClient.setOptions({});
  t.is(redisClient.getRedis(), ioredis);
  t.true(redisClient.getInstance() instanceof ioredis);
});
