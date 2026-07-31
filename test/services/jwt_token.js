import test from 'ava';
import Config from '../../src/services/config.js';
import Env from '../../src/services/env.js';
import Redis from '../../src/services/redis.js';
import JsonWebToken from '../../src/services/jwt_token.js';

test('Get and set', async(t) => {
  const jwt = new JsonWebToken(
    (new Config(new Env()).setPath(`${__dirname}/../_demo_project/config`)),
    (new Redis()).setOptions({}));
  const str = await jwt.save(2, { foo: 'bar' });
  t.is(str.split('.').length, 3);
  const obj = await jwt.find(str);
  t.deepEqual(obj, { uid: 2, foo: 'bar' });
  await jwt.clear(str);
  const objAfterClear = await jwt.find(str);
  t.deepEqual(objAfterClear, { uid: 2, expiredAt: 0 });
});
