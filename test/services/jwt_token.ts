import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import Config from '../../src/services/config.ts';
import Env from '../../src/services/env.ts';
import Redis from '../../src/services/redis.ts';
import JsonWebToken from '../../src/services/jwt_token.ts';

//原测试按 JS 形态省略 Redis 的 config 依赖（options 已显式传入，不会读取配置文件）
const RedisCtor = Redis as unknown as new () => Redis;

let redisClient: Redis | null = null;
after(() => redisClient && redisClient.cleanup());

test('Get and set', async () => {
  redisClient = (new RedisCtor()).setOptions({});
  const jwt = new JsonWebToken(
    (new Config(new Env()).setPath(`${import.meta.dirname}/../_demo_project/config`)),
    redisClient);
  const str = await jwt.save(2, { foo: 'bar' });
  assert.equal(str.split('.').length, 3);
  const obj = await jwt.find(str);
  assert.deepEqual(obj, { uid: 2, foo: 'bar' });
  await jwt.clear(str);
  const objAfterClear = await jwt.find(str);
  assert.deepEqual(objAfterClear, { uid: 2, expiredAt: 0 });
});
