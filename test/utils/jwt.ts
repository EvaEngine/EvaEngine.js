import test from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode } from '../../src/utils/jwt.ts';

// 以下 token 由 jwt-simple 0.5.6 实际生成，作为替换后的字节级兼容基准
const SIMPLE_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjQyLCJ1c2VybmFtZSI6ImFsaWNlIn0.7UwNNWiVMwOPh_H7w_zkFiy4KbpNW3I7ujijtVbBp0g';
const SIMPLE_TOKEN_EXPIRED = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjcsImV4cCI6MTAwMDAwMDAwMH0.lZnrJ9K38hDhTRnuNQ5QSBdm6W4N7BMl_RV7Q0vgwNw';
const SIMPLE_TOKEN_NOT_YET_ACTIVE = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjgsIm5iZiI6NDA3MDg4MDAwMH0.MsQFNkTo-IY6UZnPfGmNjhtsF3ndXiZuG6YtyGsZCyk';
const SIMPLE_TOKEN_OTHER_SECRET = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjQyLCJ1c2VybmFtZSI6ImFsaWNlIn0.w7wCOejFY0ZAb9UcXw4ZIK1PFVOIuyNb6nNAkfWE-Os';
const SIMPLE_TOKEN_UNICODE = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjksIm5hbWUiOiLlvKDkuIkifQ.cl_Yp8zr5g09pnXKHue0TJOLBW5p78IO4Slik7xBr3k';

test('encode produces byte-identical tokens as jwt-simple', () => {
  assert.equal(encode({ uid: 42, username: 'alice' }, 'test-secret'), SIMPLE_TOKEN);
  assert.equal(encode({ uid: 9, name: '张三' }, 'test-secret'), SIMPLE_TOKEN_UNICODE);
});

test('decode accepts tokens signed by jwt-simple', () => {
  assert.deepEqual(decode(SIMPLE_TOKEN, 'test-secret'), { uid: 42, username: 'alice' });
  assert.deepEqual(decode(SIMPLE_TOKEN_UNICODE, 'test-secret'), { uid: 9, name: '张三' });
});

test('encode/decode roundtrip', () => {
  const token = encode({ uid: 1, foo: 'bar', nested: { a: 1 } }, 'roundtrip-secret');
  assert.deepEqual(decode(token, 'roundtrip-secret'), { uid: 1, foo: 'bar', nested: { a: 1 } });
});

test('expired token throws', () => {
  assert.throws(() => decode(SIMPLE_TOKEN_EXPIRED, 'test-secret'), { message: 'Token expired' });
});

test('not-yet-active token throws', () => {
  assert.throws(() => decode(SIMPLE_TOKEN_NOT_YET_ACTIVE, 'test-secret'), { message: 'Token not yet active' });
});

test('wrong signature throws', () => {
  assert.throws(() => decode(SIMPLE_TOKEN_OTHER_SECRET, 'test-secret'), { message: 'Signature verification failed' });
  assert.throws(() => decode(`${SIMPLE_TOKEN.slice(0, -2)}xx`, 'test-secret'), { message: 'Signature verification failed' });
});

test('decode errors match jwt-simple messages', () => {
  assert.throws(() => decode('', 'test-secret'), { message: 'No token supplied' });
  assert.throws(() => decode('a.b', 'test-secret'), { message: 'Not enough or too many segments' });
  assert.throws(() => encode({}, ''), { message: 'Require key' });
});

test('unsupported algorithm in token header throws', () => {
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ uid: 1 })).toString('base64url');
  assert.throws(() => decode(`${header}.${payload}.sig`, 'test-secret'), { message: 'Algorithm not supported' });
});

test('HS384 and HS512 are supported', () => {
  const payload = { uid: 3 };
  for (const algorithm of ['HS384', 'HS512'] as const) {
    const token = encode(payload, 'multi-secret', algorithm);
    assert.deepEqual(decode(token, 'multi-secret'), payload);
  }
});
