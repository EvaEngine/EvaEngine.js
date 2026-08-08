import test from 'ava';
import moment from 'moment-timezone';
import { Op } from 'sequelize';
import SmartQuery from '../../src/utils/smart_query.js';

moment.tz.setDefault('Asia/Shanghai');

test('SmartQuery: equal', (t) => {
  t.deepEqual(
    new SmartQuery({ title: 'foo', redundant: 'bar' }).equal('title').where,
    { title: { [Op.eq]: 'foo' } }
  );
  t.deepEqual(
    new SmartQuery({ title: 'foo', redundant: 'bar' }).equal('title').equal('content').where,
    { title: { [Op.eq]: 'foo' } }
  );
  // test default value
  t.deepEqual(
    new SmartQuery({
      title: 'foo',
      redundant: 'bar'
    }).equal('title').equal('content', 'content', 'defaultContent').where,
    { title: { [Op.eq]: 'foo' }, content: { [Op.eq]: 'defaultContent' } }
  );
});

test('SmartQuery: like', (t) => {
  t.deepEqual(
    new SmartQuery({ title: 'foo', redundant: 'bar' }).like('title').where,
    { title: { [Op.like]: '%foo%' } }
  );
  // test default value
  t.deepEqual(
    new SmartQuery({ titlex: 'foo', redundant: 'bar' }).like('title', 'title', 'defaultTitle').where,
    { title: { [Op.like]: '%defaultTitle%' } }
  );
});

test('SmartQuery: startsWith', (t) => {
  t.deepEqual(
    new SmartQuery({ title: 'foo', redundant: 'bar' }).startsWith('title').where,
    { title: { [Op.like]: 'foo%' } }
  );
  // test default value
  t.deepEqual(
    new SmartQuery({ titlex: 'foo', redundant: 'bar' }).startsWith('title', 'title', 'defaultTitle').where,
    { title: { [Op.like]: 'defaultTitle%' } }
  );
});

test('SmartQuery: endsWith', (t) => {
  t.deepEqual(
    new SmartQuery({ title: 'foo', redundant: 'bar' }).endsWith('title').where,
    { title: { [Op.like]: '%foo' } }
  );
  // test default value
  t.deepEqual(
    new SmartQuery({ titlex: 'foo', redundant: 'bar' }).endsWith('title', 'title', 'defaultTitle').where,
    { title: { [Op.like]: '%defaultTitle' } }
  );
});
test('SmartQuery: gte', (t) => {
  t.deepEqual(
    new SmartQuery({ created_starts: 12345 }).gte('created_starts', 'createdAt').where,
    { createdAt: { [Op.gte]: 12345 } }
  );
});
test('SmartQuery: lte', (t) => {
  t.deepEqual(
    new SmartQuery({ created_ends: 12345 }).lte('created_ends', 'createdAt').where,
    { createdAt: { [Op.lte]: 12345 } }
  );
});

test('SmartQuery: in', (t) => {
  t.deepEqual(
    new SmartQuery({ uids: '3,4', redundant: 'bar' }).in('uids', 'userId').where,
    { userId: { [Op.in]: ['3', '4'] } }
  );
  t.deepEqual(
    new SmartQuery({ status: ['pending', 'deleted'], redundant: 'bar' }).in('status').where,
    { status: { [Op.in]: ['pending', 'deleted'] } }
  );
  // test default value
  t.deepEqual(
    new SmartQuery({ redundant: 'bar' }).in('status', 'status', 'published,approved').where,
    { status: { [Op.in]: ['published', 'approved'] } }
  );
});

test('SmartQuery: notIn', (t) => {
  t.deepEqual(
    new SmartQuery({ uids: '3,4', redundant: 'bar' }).notIn('uids', 'userId').where,
    { userId: { [Op.notIn]: ['3', '4'] } }
  );
  t.deepEqual(
    new SmartQuery({ uids: [3, 4], redundant: 'bar' }).notIn('uids', 'userId').where,
    { userId: { [Op.notIn]: [3, 4] } }
  );
});

test('SmartQuery: range', (t) => {
  t.deepEqual(
    new SmartQuery({ minUid: 3, maxUid: 4 }).range('minUid', 'maxUid', 'userId').where,
    { userId: { [Op.gte]: 3, [Op.lte]: 4 } }
  );
  t.deepEqual(
    new SmartQuery({ minUid: 3 }).range('minUid', 'maxUid', 'userId').where,
    { userId: { [Op.gte]: 3 } }
  );
  t.deepEqual(
    new SmartQuery({ maxUid: 4 }).range('minUid', 'maxUid', 'userId').where,
    { userId: { [Op.lte]: 4 } }
  );
});

test('SmartQuery: dateRange', (t) => {
  t.deepEqual(
    new SmartQuery({
      createdStart: '2016-01-01',
      createdEnd: '2016-01-01'
    }).dateRange('createdStart', 'createdEnd', 'createdAt').where,
    { createdAt: { [Op.gte]: '1451577600', [Op.lte]: '1451663999' } }
  );
  t.deepEqual(
    new SmartQuery({
      createdStart: '2016-01-01'
    }).dateRange('createdStart', 'createdEnd', 'createdAt').where,
    { createdAt: { [Op.gte]: '1451577600' } }
  );
  t.deepEqual(
    new SmartQuery({
      createdEnd: '2016-01-01'
    }).dateRange('createdStart', 'createdEnd', 'createdAt').where,
    { createdAt: { [Op.lte]: '1451663999' } }
  );
  t.deepEqual(
    new SmartQuery({
      createdStart: '2016-01-01 03:05',
      createdEnd: '2016-01-01 04:05'
    }).dateRange('createdStart', 'createdEnd', 'createdAt').where,
    { createdAt: { [Op.gte]: '1451577600', [Op.lte]: '1451663999' } }
  );
  t.deepEqual(
    new SmartQuery({
      createdStart: 'xxxx',
      createdEnd: 'xxxx'
    }).dateRange('createdStart', 'createdEnd', 'createdAt').where,
    {}
  );
});
test('SmartQuery: dateTimeRange', (t) => {
  t.deepEqual(
    new SmartQuery({
      createdStart: '2016-01-01',
      createdEnd: '2016-01-01'
    }).dateTimeRange('createdStart', 'createdEnd', 'createdAt').where,
    { createdAt: { [Op.gte]: '1451577600', [Op.lte]: '1451577600' } }
  );

  t.deepEqual(
    new SmartQuery({
      createdStart: '2016-01-01 03:05',
      createdEnd: '2016-01-01 12:05:03'
    }).dateTimeRange('createdStart', 'createdEnd', 'createdAt').where,
    { createdAt: { [Op.gte]: '1451588700', [Op.lte]: '1451621103' } }
  );
  t.deepEqual(
    new SmartQuery({
      createdEnd: '2016-01-01 12:05:03'
    }).dateTimeRange('createdStart', 'createdEnd', 'createdAt').where,
    { createdAt: { [Op.lte]: '1451621103' } }
  );
  t.deepEqual(
    new SmartQuery({
      createdStart: 'xxxx',
      createdEnd: 'xxxx'
    }).dateTimeRange('createdStart', 'createdEnd', 'createdAt').where,
    {}
  );
});
test('SmartQuery: orderable', (t) => {
  t.deepEqual(
    new SmartQuery({ order: 'createdAt' }).orderable(['createdAt']).order,
    [
      ['createdAt', 'ASC']
    ]
  );
  t.deepEqual(
    new SmartQuery({ order: '-createdAt' }).orderable(['createdAt']).order,
    [
      ['createdAt', 'DESC']
    ]
  );
  t.deepEqual(
    new SmartQuery({}).orderable(['createdAt']).order,
    [
      ['createdAt', 'DESC']
    ]
  );
  t.deepEqual(
    new SmartQuery({ order: 'test' }).orderable(['createdAt'], { test: ['deletedAt', 'DESC'] }).order,
    [
      ['deletedAt', 'DESC']
    ]
  );
  t.deepEqual(
    new SmartQuery({}).orderable(['createdAt'], { test: ['deletedAt', 'DESC'] }, ['id', 'DESC']).order,
    [
      ['id', 'DESC']
    ]
  );
});
test('SmartQuery: determineParam', (t) => {
  t.is(
    new SmartQuery({ title: 'foo' }).determineParam('title'),
    true
  );
  t.is(
    new SmartQuery({ title: '  ' }).determineParam('title'),
    false
  );
  t.is(
    new SmartQuery({ title: null }).determineParam('title'),
    false
  );
  t.is(
    new SmartQuery({ foo: 'bar' }).determineParam('title'),
    false
  );
  t.is(
    new SmartQuery({ uids: [1] }).determineParam('uids'),
    true
  );
  t.is(
    new SmartQuery({ uids: [1, 2] }).determineParam('uids'),
    true
  );
  t.is(
    new SmartQuery({ uids: [] }).determineParam('uids'),
    false
  );
  t.is(
    new SmartQuery({ uids: { foo: 'bar' } }).determineParam('uids'),
    true
  );
  t.is(
    new SmartQuery({ uids: { foo: 'bar', 'a': 'c' } }).determineParam('uids'),
    true
  );
  t.is(
    new SmartQuery({ uids: {} }).determineParam('uids'),
    false
  );
});
test('SmartQuery: applyWhere', (t) => {
  const smartQuery = new SmartQuery({});
  smartQuery.applyWhere('title', '$eq', 'xxx');
  t.deepEqual(
    smartQuery.where,
    {
      title: {
        [Op.eq]: 'xxx'
      }
    }
  );
  smartQuery.applyWhere('title', '$eq', 'ooo');
  t.deepEqual(
    smartQuery.where,
    {
      title: {
        [Op.eq]: 'ooo'
      }
    }
  );
  smartQuery.applyWhere('title', '$in', 'bar');
  t.deepEqual(
    smartQuery.where,
    {
      title: {
        [Op.eq]: 'ooo',
        [Op.in]: 'bar'
      }
    }
  );
});

test('SmartQuery: getCriteria includes where and order', (t) => {
  const smartQuery = new SmartQuery({ title: 'foo' });
  smartQuery.like('title').orderable(['createdAt'], {}, ['id', 'DESC']);
  t.deepEqual(
    smartQuery.getCriteria(),
    {
      where: { title: { [Op.like]: '%foo%' } },
      order: [['id', 'DESC']]
    }
  );
});

test('SmartQuery: getCriteria returns empty without conditions', (t) => {
  const smartQuery = new SmartQuery({});
  t.deepEqual(smartQuery.getCriteria(), {});
});
