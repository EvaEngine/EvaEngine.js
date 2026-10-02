import test from 'node:test';
import assert from 'node:assert/strict';
import { pagination, paginationFilter } from '../../src/utils/pagination.ts';

// pagination 只消费 protocol/baseUrl/path/query/get；保留 mock 原有的 method 字段
type MockRequest = {
  protocol: string;
  method: string;
  baseUrl: string;
  path: string;
  get(name: string): string | undefined;
  query: Record<string, unknown>;
};

const req: MockRequest = {
  protocol: 'http',
  method: 'GET',
  baseUrl: '/',
  path: '',
  get(name) {
    // 按字符串键取 header，需要索引签名避免隐式 any
    const headers: Record<string, string | undefined> = {
      host: 'localhost'
    };
    return headers[name];
  },
  query: {}
};

test('Works when no data', () => {
  const {
    total, offset, limit, prev, next, isFirst, isLast,
    prevUri, nextUri, firstUri, lastUri
  } =
    pagination({
      total: 0,
      limit: 10,
      offset: 15,
      req
    });
  assert.equal(total, 0);
  assert.equal(offset, 15);
  assert.equal(limit, 10);
  assert.equal(prev, 5);
  assert.equal(next, 25);
  assert.ok(isFirst);
  assert.ok(isLast);
  assert.equal(prevUri, '');
  assert.equal(nextUri, '');
  assert.equal(firstUri, '');
  assert.equal(lastUri, '');
});

test('Works when less than 1 page', () => {
  const {
    total, offset, limit, prev, next, isFirst, isLast,
    prevUri, nextUri, firstUri, lastUri
  } =
    pagination({
      total: 3,
      limit: 5,
      offset: 0,
      req
    });
  assert.equal(total, 3);
  assert.equal(offset, 0);
  assert.equal(limit, 5);
  assert.equal(prev, -5);
  assert.equal(next, 5);
  assert.ok(isFirst);
  assert.ok(isLast);
  assert.equal(prevUri, '');
  assert.equal(nextUri, '');
  assert.equal(firstUri, 'http://localhost/?offset=0&limit=5');
  assert.equal(lastUri, 'http://localhost/?offset=0&limit=5');
});

test('Works when normal', () => {
  const {
    total, offset, limit, prev, next, isFirst, isLast,
    prevUri, nextUri, firstUri, lastUri
  } =
    pagination({
      total: 100,
      limit: 15,
      offset: 30,
      req
    });
  assert.equal(total, 100);
  assert.equal(offset, 30);
  assert.equal(limit, 15);
  assert.equal(prev, 15);
  assert.equal(next, 45);
  assert.equal(isFirst, false);
  assert.equal(isLast, false);
  assert.equal(prevUri, 'http://localhost/?offset=15&limit=15');
  assert.equal(nextUri, 'http://localhost/?offset=45&limit=15');
  assert.equal(firstUri, 'http://localhost/?offset=0&limit=15');
  assert.equal(lastUri, 'http://localhost/?offset=90&limit=15');
});

test('Works when not aligned', () => {
  const {
    total, offset, limit, prev, next, isFirst, isLast,
    prevUri, nextUri, firstUri, lastUri
  } =
    pagination({
      total: 100,
      limit: 15,
      offset: 5,
      req
    });
  assert.equal(total, 100);
  assert.equal(offset, 5);
  assert.equal(limit, 15);
  assert.equal(prev, -10);
  assert.equal(next, 20);
  assert.equal(isFirst, false);
  assert.equal(isLast, false);
  assert.equal(prevUri, 'http://localhost/?offset=-10&limit=15');
  assert.equal(nextUri, 'http://localhost/?offset=20&limit=15');
  assert.equal(firstUri, 'http://localhost/?offset=0&limit=15');
  assert.equal(lastUri, 'http://localhost/?offset=95&limit=15');
});

test('Works on last page', () => {
  const {
    total, offset, limit, prev, next, isFirst, isLast,
    prevUri, nextUri, firstUri, lastUri
  } =
    pagination({
      total: 100,
      limit: 15,
      offset: 95,
      req
    });
  assert.equal(total, 100);
  assert.equal(offset, 95);
  assert.equal(limit, 15);
  assert.equal(prev, 80);
  assert.equal(next, 110);
  assert.equal(isFirst, false);
  assert.ok(isLast);
  assert.equal(prevUri, 'http://localhost/?offset=80&limit=15');
  assert.equal(nextUri, '');
  assert.equal(firstUri, 'http://localhost/?offset=0&limit=15');
  assert.equal(lastUri, 'http://localhost/?offset=95&limit=15');
});

test('Works when illegal args', () => {
  const {
    total, offset, limit
  } =
    pagination({
      total: 'abc',
      limit: [],
      offset: 'foo',
      req
    });
  assert.equal(total, 0);
  assert.equal(offset, 0);
  assert.equal(limit, 1);
});

test('Works when negative', () => {
  const {
    total, offset, limit, prev
  } =
    pagination({
      total: 10,
      limit: -10,
      offset: -20,
      req
    });
  assert.equal(total, 10);
  assert.equal(offset, -20);
  assert.equal(limit, 1);
  assert.equal(prev, -21);
});

test('Should keep request query', () => {
  const {
    prevUri, nextUri, firstUri, lastUri
  } =
    pagination({
      total: 100,
      limit: 15,
      offset: 5,
      // 内联 mock 含 pagination 参数类型之外的字段，按最小结构类型断言；
      // 断言操作数无上下文类型，get 的参数需显式标注
      req: {
        protocol: 'http',
        method: 'GET',
        baseUrl: '/',
        path: '',
        get(name: string) {
          const headers: Record<string, string | undefined> = {
            host: 'localhost'
          };
          return headers[name];
        },
        query: { foo: 'bar' }
      } as MockRequest
    });
  assert.equal(prevUri, 'http://localhost/?foo=bar&offset=-10&limit=15');
  assert.equal(nextUri, 'http://localhost/?foo=bar&offset=20&limit=15');
  assert.equal(firstUri, 'http://localhost/?foo=bar&offset=0&limit=15');
  assert.equal(lastUri, 'http://localhost/?foo=bar&offset=95&limit=15');
});

test('does not mutate request query', () => {
  const localReq: MockRequest = {
    protocol: 'http',
    method: 'GET',
    baseUrl: '/',
    path: '',
    get(name) {
      // 按字符串键取 header，需要索引签名避免隐式 any
      return ({ host: 'localhost' } as Record<string, string | undefined>)[name];
    },
    query: { foo: 'bar' }
  };
  pagination({
    total: 100,
    limit: 15,
    offset: 5,
    req: localReq
  });
  assert.deepEqual(localReq.query, { foo: 'bar' });
});

test('Filter for normal number', () => {
  const { limit, offset } = paginationFilter({ limit: '15', offset: '5' });
  assert.equal(limit, 15);
  assert.equal(offset, 5);
});
test('Filter for negative number', () => {
  const { limit, offset } = paginationFilter({ limit: 15, offset: -3 });
  assert.equal(limit, 12);
  assert.equal(offset, 0);
});
test('Filter for large negative number', () => {
  const { limit, offset } = paginationFilter({ limit: 15, offset: -32 });
  assert.equal(limit, 13);
  assert.equal(offset, 0);
});
test('Filter for illegal input', () => {
  const { limit, offset } = paginationFilter({ limit: 'foo', offset: 'bar' });
  assert.equal(limit, 15);
  assert.equal(offset, 0);
});
test('Filter with default limit', () => {
  const { limit } = paginationFilter({}, 15);
  assert.equal(limit, 15);
});
test('Filter with max limit', () => {
  const { limit } = paginationFilter({ limit: 500 }, 15, 150);
  assert.equal(limit, 150);
});
test('Filter with unlimit', () => {
  const { limit } = paginationFilter({ limit: 500 }, 15, -1);
  assert.equal(limit, 500);
});
