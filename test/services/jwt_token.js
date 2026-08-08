import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import Config from '../../src/services/config.js';
import Env from '../../src/services/env.js';
import Redis from '../../src/services/redis.js';
import JsonWebToken from '../../src/services/jwt_token.js';

let redisClient;
after(() => redisClient && redisClient.cleanup());

test('Get and set', async () => {
  redisClient = (new Redis()).setOptions({});
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
