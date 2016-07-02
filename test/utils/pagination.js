import test from 'ava';
import { pagination, paginationFilter } from '../../src/utils/pagination';

const req = {
  protocol: 'http',
  method: 'GET',
  baseUrl: '/',
  path: '',
  get: () => 'localhost',
  query: {}
};

test('Works when no data', (t) => {
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
  t.is(total, 0);
  t.is(offset, 15);
  t.is(limit, 10);
  t.is(prev, 5);
  t.is(next, 25);
  t.true(isFirst);
  t.true(isLast);
  t.is(prevUri, '');
  t.is(nextUri, '');
  t.is(firstUri, '');
  t.is(lastUri, '');
});

test('Works when less than 1 page', (t) => {
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
  t.is(total, 3);
  t.is(offset, 0);
  t.is(limit, 5);
  t.is(prev, -5);
  t.is(next, 5);
  t.true(isFirst);
  t.true(isLast);
  t.is(prevUri, '');
  t.is(nextUri, '');
  t.is(firstUri, 'http://localhost/?offset=0&limit=5');
  t.is(lastUri, 'http://localhost/?offset=0&limit=5');
});

test('Works when normal', (t) => {
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
  t.is(total, 100);
  t.is(offset, 30);
  t.is(limit, 15);
  t.is(prev, 15);
  t.is(next, 45);
  t.false(isFirst);
  t.false(isLast);
  t.is(prevUri, 'http://localhost/?offset=15&limit=15');
  t.is(nextUri, 'http://localhost/?offset=45&limit=15');
  t.is(firstUri, 'http://localhost/?offset=0&limit=15');
  t.is(lastUri, 'http://localhost/?offset=90&limit=15');
});

test('Works when not aligned', (t) => {
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
  t.is(total, 100);
  t.is(offset, 5);
  t.is(limit, 15);
  t.is(prev, -10);
  t.is(next, 20);
  t.false(isFirst);
  t.false(isLast);
  t.is(prevUri, 'http://localhost/?offset=-10&limit=15');
  t.is(nextUri, 'http://localhost/?offset=20&limit=15');
  t.is(firstUri, 'http://localhost/?offset=0&limit=15');
  t.is(lastUri, 'http://localhost/?offset=95&limit=15');
});

test('Works on last page', (t) => {
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
  t.is(total, 100);
  t.is(offset, 95);
  t.is(limit, 15);
  t.is(prev, 80);
  t.is(next, 110);
  t.false(isFirst);
  t.true(isLast);
  t.is(prevUri, 'http://localhost/?offset=80&limit=15');
  t.is(nextUri, '');
  t.is(firstUri, 'http://localhost/?offset=0&limit=15');
  t.is(lastUri, 'http://localhost/?offset=95&limit=15');
});

test('Works when illegal args', (t) => {
  const {
          total, offset, limit
        } =
          pagination({
            total: 'abc',
            limit: [],
            offset: 'foo',
            req
          });
  t.is(total, 0);
  t.is(offset, 0);
  t.is(limit, 1);
});

test('Works when negative', (t) => {
  const {
          total, offset, limit, prev
        } =
          pagination({
            total: 10,
            limit: -10,
            offset: -20,
            req
          });
  t.is(total, 10);
  t.is(offset, -20);
  t.is(limit, 1);
  t.is(prev, -21);
});

test('Should keep request query', (t) => {
  const {
          prevUri, nextUri, firstUri, lastUri
        } =
          pagination({
            total: 100,
            limit: 15,
            offset: 5,
            req: {
              protocol: 'http',
              method: 'GET',
              baseUrl: '/',
              path: '',
              get: () => 'localhost',
              query: { foo: 'bar' }
            }
          });
  t.is(prevUri, 'http://localhost/?foo=bar&offset=-10&limit=15');
  t.is(nextUri, 'http://localhost/?foo=bar&offset=20&limit=15');
  t.is(firstUri, 'http://localhost/?foo=bar&offset=0&limit=15');
  t.is(lastUri, 'http://localhost/?foo=bar&offset=95&limit=15');
});

test('Filter for normal number', (t) => {
  const { limit, offset } = paginationFilter({ limit: '15', offset: '5' });
  t.is(limit, 15);
  t.is(offset, 5);
});
test('Filter for negative number', (t) => {
  const { limit, offset } = paginationFilter({ limit: 15, offset: -3 });
  t.is(limit, 12);
  t.is(offset, 0);
});
test('Filter for large negative number', (t) => {
  const { limit, offset } = paginationFilter({ limit: 15, offset: -32 });
  t.is(limit, 13);
  t.is(offset, 0);
});
test('Filter for illegal input', (t) => {
  const { limit, offset } = paginationFilter({ limit: 'foo', offset: 'bar' });
  t.is(limit, 15);
  t.is(offset, 0);
});
test('Filter with default limit', (t) => {
  const { limit } = paginationFilter({}, 15);
  t.is(limit, 15);
});
test('Filter with max limit', (t) => {
  const { limit } = paginationFilter({ limit: 500 }, 15, 150);
  t.is(limit, 150);
});
test('Filter with unlimit', (t) => {
  const { limit } = paginationFilter({ limit: 500 }, 15, -1);
  t.is(limit, 500);
});
