import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderScaffold, FilterScaffold } from '../../src/utils/api_scaffold.js';

test('Order Scaffold Works normal', () => {
  const orderScaffold = new OrderScaffold();
  orderScaffold.setFields(['startDate']);
  assert.deepEqual({
    start_date: ['startDate', 'ASC'],
    '-start_date': ['startDate', 'DESC']
  }, orderScaffold.getAvailableOrders());
  assert.deepEqual(orderScaffold.getOrderByQuery('-start_date'), [['startDate', 'DESC']]);
  assert.deepEqual(orderScaffold.getOrderByQuery('unknown order'), []);
});

test('Order Scaffold Works with default order', () => {
  const orderScaffold = new OrderScaffold();
  orderScaffold.setFields(['id', 'startDate'], 'id');
  assert.deepEqual(orderScaffold.getOrderByQuery(null), [['id', 'DESC']]);
  assert.deepEqual(orderScaffold.getOrderByQuery('unknown order'), [['id', 'DESC']]);
});

test('Order Scaffold Works with camel case', () => {
  const orderScaffold = new OrderScaffold('camel');
  orderScaffold.setFields(['start_date']);
  assert.deepEqual(orderScaffold.getAvailableOrders(), {
    startDate: ['start_date', 'ASC'],
    '-startDate': ['start_date', 'DESC']
  });
  assert.deepEqual(orderScaffold.getOrderByQuery('-startDate'), [['start_date', 'DESC']]);
});

test('Order Scaffold Works with multi order', () => {
  const orderScaffold = new OrderScaffold();
  orderScaffold.setFields(['id', 'startDate']);
  assert.deepEqual(
    orderScaffold.getOrderByQuery('-id,start_date'),
    [['id', 'DESC'], ['startDate', 'ASC']]
  );
});

test('Filter Scaffold support string equal', () => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('createdAt');
  const schema = filterScaffold.getFilterSchema();
  assert.ok(Object.keys(schema).includes('createdAt'));
  const conditions = filterScaffold.getConditions({
    created_at: 'foo'
  });
  assert.deepEqual({
    createdAt: 'foo'
  }, conditions);
});

test('Filter Scaffold support number', () => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('totalAmount', 'number');
  const schema = filterScaffold.getFilterSchema();
  assert.ok(Object.keys(schema).includes('totalAmount'));
  assert.deepEqual({
    totalAmount: 123
  }, filterScaffold.getConditions({
    total_amount: 123
  }));
  assert.deepEqual({
    totalAmount: {
      $gte: 100,
      $lte: 200
    }
  }, filterScaffold.getConditions({
    total_amount_$gte: 100,
    total_amount_$lte: 200
  }));

  assert.throws(() => filterScaffold.getConditions({
    total_amount_$gte: 100,
    total_amount: 200
  }), (e) => {
    assert.match(e.message, /conflict/);
    return true;
  });
});

test('Filter Scaffold replace default operators', () => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('totalAmount', 'number', { operators: [] });
  const schema = filterScaffold.getFilterSchema();
  assert.equal(schema.totalAmount.operators.length, 0);
  assert.deepEqual({}, filterScaffold.getConditions({
    total_amount_$gte: 100
  }));
  assert.deepEqual({
    totalAmount: 100
  }, filterScaffold.getConditions({
    total_amount: 100
  }));
});

test('Filter Scaffold skip without value', () => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('totalAmount', 'number');
  assert.deepEqual({
    totalAmount: {
      $gte: 100
    }
  }, filterScaffold.getConditions({
    total_amount_$gte: 100,
    total_amount_$lte: null
  }));
});
