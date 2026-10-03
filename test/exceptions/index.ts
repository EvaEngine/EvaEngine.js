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
} from './../../src/exceptions/index.ts';
import type { ExceptionInput } from './../../src/exceptions/index.ts';

test('Throw input', () => {
  assert.throws(() => {
    // 测试刻意传入非法输入以验证运行时 TypeError，仅在类型层面声明为声明的入参联合类型
    // oxlint-disable-next-line no-new
    new RuntimeException([] as unknown as ExceptionInput);
  }, TypeError);

  // src 构造参数未标可选，但零参构造是运行时合法路径（factory 亦按可选调用），故显式传 undefined
  assert.equal((new StandardException(undefined)).message, 'StandardException');
  assert.equal((new LogicException(undefined)).message, 'LogicException');
  assert.equal((new StandardException('foo')).message, 'foo');
  assert.equal((new StandardException(new Error())).message, '');
  assert.equal((new StandardException(new Error('bar'))).message, 'bar');
  assert.equal((new StandardException(new TypeError('bar_type'))).message, 'bar_type');
  assert.equal((new StandardException(undefined)).setMessage('custom').message, 'custom');
  assert.throws(() => {
    // oxlint-disable-next-line no-new
    new RuntimeException(new LogicException(undefined));
  }, LogicException);
});

test('Factory', () => {
  // factory 声明返回联合类型，测试语义下实际返回异常实例，收窄以便 instanceof
  const e = StandardException.factory({
    code: 123,
    statusCode: 409,
    name: 'ResourceConflictedException',
    message: 'foo'
  }) as StandardException;
  assert.ok(e instanceof ResourceConflictedException);
});

test('Throw i18n', () => {
  assert.equal((new StandardException(undefined)).i18n('foo %s', 'bar').message, 'foo bar');
});

test('Throw code', () => {
  assert.equal((new LogicException(undefined)).setCode(123).getCode(), 123);
});

test('Throw status code', () => {
  assert.equal((new StandardException(undefined)).getStatusCode(), 500);
  assert.equal((new LogicException(undefined)).getStatusCode(), 400);
  assert.equal((new UnauthorizedException(undefined)).getStatusCode(), 401);
  assert.equal((new OperationNotPermittedException(undefined)).getStatusCode(), 403);
  assert.equal((new ResourceNotFoundException(undefined)).getStatusCode(), 404);
  assert.equal((new OperationUnsupportedException(undefined)).getStatusCode(), 405);
  assert.equal((new ResourceConflictedException(undefined)).getStatusCode(), 409);
  assert.equal((new RuntimeException(undefined)).getStatusCode(), 500);
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
