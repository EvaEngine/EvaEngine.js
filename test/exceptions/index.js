import test from 'ava';
import {
  StandardException,
  LogicException,
  UnauthorizedException,
  OperationNotPermittedException,
  ResourceNotFoundException,
  OperationUnsupportedException,
  ResourceConflictedException,
  RuntimeException
} from './../../src/exceptions';


test('Throw input', (t) => {
  t.throws(() => {
    new RuntimeException([]);
  }, TypeError);

  t.is((new StandardException()).message, 'StandardException');
  t.is((new LogicException()).message, 'LogicException');
  t.is((new StandardException('foo')).message, 'foo');
  t.is((new StandardException(new Error())).message, '');
  t.is((new StandardException(new Error('bar'))).message, 'bar');
  t.is((new StandardException(new TypeError('bar_type'))).message, 'bar_type');
  t.is((new StandardException()).setMessage('custom').message, 'custom');
  t.throws(() => {
    new RuntimeException(new LogicException());
  }, LogicException);

});

test('Throw i18n', (t) => {
  t.is((new StandardException()).i18n('foo %s', 'bar').message, 'foo bar');
});

test('Throw code', (t) => {
  t.is((new LogicException()).getCode(), 385400003318127193);
  t.is((new LogicException()).setCode(123).getCode(), 123);
});

test('Throw status code', (t) => {
  t.is((new StandardException()).getStatusCode(), 500);
  t.is((new LogicException()).getStatusCode(), 400);
  t.is((new UnauthorizedException()).getStatusCode(), 401);
  t.is((new OperationNotPermittedException()).getStatusCode(), 403);
  t.is((new ResourceNotFoundException()).getStatusCode(), 404);
  t.is((new OperationUnsupportedException()).getStatusCode(), 405);
  t.is((new ResourceConflictedException()).getStatusCode(), 409);
  t.is((new RuntimeException()).getStatusCode(), 500);
});

test('Hash', (t) => {
  t.is(StandardException.hash('111111'), '0404288374');
});
test('Should extends standard exception', (t) => {
  t.true(new LogicException('foo') instanceof StandardException);
});
test('Exception code', (t) => {
  t.is(new LogicException('foo').getCode(), 385400003318127193);
});
test('Status code', (t) => {
  t.is(new LogicException('foo').getStatusCode(), 400);
});
test('Stack Beautifier', (t) => {
  t.deepEqual(StandardException.stackBeautifier(`foo
bar`), ['foo', 'bar']);
  t.deepEqual(StandardException.stackBeautifier(`foo
node_modules/abc
something/(node.js)
something/(native)
bar`), ['foo', 'bar']);
});

