import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StandardException,
  LogicException,
  UnauthorizedException,
  OperationNotPermittedException,
  ResourceNotFoundException,
  OperationUnsupportedException,
  ResourceConflictedException,
  RuntimeException
} from './../../src/exceptions/index.js';

test('Throw input', () => {
  assert.throws(() => {
    new RuntimeException([]);
  }, TypeError);

  assert.equal((new StandardException()).message, 'StandardException');
  assert.equal((new LogicException()).message, 'LogicException');
  assert.equal((new StandardException('foo')).message, 'foo');
  assert.equal((new StandardException(new Error())).message, '');
  assert.equal((new StandardException(new Error('bar'))).message, 'bar');
  assert.equal((new StandardException(new TypeError('bar_type'))).message, 'bar_type');
  assert.equal((new StandardException()).setMessage('custom').message, 'custom');
  assert.throws(() => {
    new RuntimeException(new LogicException());
  }, LogicException);
});

test('Factory', () => {
  const e = StandardException.factory({
    code: 123,
    statusCode: 409,
    name: 'ResourceConflictedException',
    message: 'foo'
  });
  assert.ok(e instanceof ResourceConflictedException);
});

test('Throw i18n', () => {
  assert.equal((new StandardException()).i18n('foo %s', 'bar').message, 'foo bar');
});

test('Throw code', () => {
  assert.equal((new LogicException()).setCode(123).getCode(), 123);
});

test('Throw status code', () => {
  assert.equal((new StandardException()).getStatusCode(), 500);
  assert.equal((new LogicException()).getStatusCode(), 400);
  assert.equal((new UnauthorizedException()).getStatusCode(), 401);
  assert.equal((new OperationNotPermittedException()).getStatusCode(), 403);
  assert.equal((new ResourceNotFoundException()).getStatusCode(), 404);
  assert.equal((new OperationUnsupportedException()).getStatusCode(), 405);
  assert.equal((new ResourceConflictedException()).getStatusCode(), 409);
  assert.equal((new RuntimeException()).getStatusCode(), 500);
});

test('Hash', () => {
  assert.equal(StandardException.hash('111111'), '0404288374');
});

test('Should extends standard exception', () => {
  assert.ok(new LogicException('foo') instanceof StandardException);
});

test('Status code', () => {
  assert.equal(new LogicException('foo').getStatusCode(), 400);
});

test('Stack Beautifier', () => {
  assert.deepEqual(StandardException.stackBeautifier(`foo
bar`), ['foo', 'bar']);
  assert.deepEqual(StandardException.stackBeautifier(`foo
node_modules/abc
something/(node.js)
something/(native)
bar`), ['foo', 'bar']);
});
