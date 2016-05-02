import chai from 'chai';
import { describe, it } from 'mocha/lib/mocha';
import { pagination, paginationFilter } from '../../src/utils/pagination';

chai.should();
const assert = chai.assert;
const req = {
  protocol: 'http',
  method: 'GET',
  baseUrl: '/',
  path: '',
  get: () => 'localhost',
  query: {}
};

describe('Pagination Utils', () => {
  describe('Pagination', () => {
    it('Works when no data', () => {
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
      assert.isTrue(isFirst);
      assert.isTrue(isLast);
      assert.equal(prevUri, '');
      assert.equal(nextUri, '');
      assert.equal(firstUri, '');
      assert.equal(lastUri, '');
    });

    it('Works when less than 1 page', () => {
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
      assert.isTrue(isFirst);
      assert.isTrue(isLast);
      assert.equal(prevUri, '');
      assert.equal(nextUri, '');
      assert.equal(firstUri, 'http://localhost/?offset=0&limit=5');
      assert.equal(lastUri, 'http://localhost/?offset=0&limit=5');
    });

    it('Works when normal', () => {
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
      assert.isFalse(isFirst);
      assert.isFalse(isLast);
      assert.equal(prevUri, 'http://localhost/?offset=15&limit=15');
      assert.equal(nextUri, 'http://localhost/?offset=45&limit=15');
      assert.equal(firstUri, 'http://localhost/?offset=0&limit=15');
      assert.equal(lastUri, 'http://localhost/?offset=90&limit=15');
    });

    it('Works when not aligned', () => {
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
      assert.isFalse(isFirst);
      assert.isFalse(isLast);
      assert.equal(prevUri, 'http://localhost/?offset=-10&limit=15');
      assert.equal(nextUri, 'http://localhost/?offset=20&limit=15');
      assert.equal(firstUri, 'http://localhost/?offset=0&limit=15');
      assert.equal(lastUri, 'http://localhost/?offset=95&limit=15');
    });

    it('Works on last page', () => {
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
      assert.isFalse(isFirst);
      assert.isTrue(isLast);
      assert.equal(prevUri, 'http://localhost/?offset=80&limit=15');
      assert.equal(nextUri, '');
      assert.equal(firstUri, 'http://localhost/?offset=0&limit=15');
      assert.equal(lastUri, 'http://localhost/?offset=95&limit=15');
    });

    it('Works when illegal args', () => {
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

    it('Works when negative', () => {
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

    it('Should keep request query', () => {
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
      assert.equal(prevUri, 'http://localhost/?foo=bar&offset=-10&limit=15');
      assert.equal(nextUri, 'http://localhost/?foo=bar&offset=20&limit=15');
      assert.equal(firstUri, 'http://localhost/?foo=bar&offset=0&limit=15');
      assert.equal(lastUri, 'http://localhost/?foo=bar&offset=95&limit=15');
    });
  });
  describe('Pagination Filter', () => {
    it('Filter for normal number', () => {
      const { limit, offset } = paginationFilter({ limit: '15', offset: '5' });
      assert.equal(limit, 15);
      assert.equal(offset, 5);
    });
    it('Filter for negative number', () => {
      const { limit, offset } = paginationFilter({ limit: 15, offset: -3 });
      assert.equal(limit, 12);
      assert.equal(offset, 0);
    });
    it('Filter for large negative number', () => {
      const { limit, offset } = paginationFilter({ limit: 15, offset: -32 });
      assert.equal(limit, 13);
      assert.equal(offset, 0);
    });
    it('Filter for illegal input', () => {
      const { limit, offset } = paginationFilter({ limit: 'foo', offset: 'bar' });
      assert.equal(limit, 15);
      assert.equal(offset, 0);
    });
    it('Filter with default limit', () => {
      const { limit } = paginationFilter({}, 15);
      assert.equal(limit, 15);
    });
    it('Filter with max limit', () => {
      const { limit } = paginationFilter({ limit: 500 }, 15, 150);
      assert.equal(limit, 150);
    });
    it('Filter with unlimit', () => {
      const { limit } = paginationFilter({ limit: 500 }, 15, -1);
      assert.equal(limit, 500);
    });
  });
});
