import test from 'ava';
import { OrderScaffold, FilterScaffold } from '../../src/utils/api_scaffold';

test('Order Scaffold Works normal', (t) => {
  const orderScaffold = new OrderScaffold();
  orderScaffold.setFields(['startDate']);
  t.deepEqual({
    start_date: ['startDate', 'ASC'],
    '-start_date': ['startDate', 'DESC']
  }, orderScaffold.getAvailableOrders());
  t.deepEqual(orderScaffold.getOrderByQuery('-start_date'), [['startDate', 'DESC']]);
  t.deepEqual(orderScaffold.getOrderByQuery('unknown order'), []);
});

test('Order Scaffold Works with default order', (t) => {
  const orderScaffold = new OrderScaffold();
  orderScaffold.setFields(['id', 'startDate'], 'id');
  t.deepEqual(orderScaffold.getOrderByQuery(null), [['id', 'DESC']]);
  t.deepEqual(orderScaffold.getOrderByQuery('unknown order'), [['id', 'DESC']]);
});

test('Order Scaffold Works with camel case', (t) => {
  const orderScaffold = new OrderScaffold('camel');
  orderScaffold.setFields(['start_date']);
  t.deepEqual(orderScaffold.getAvailableOrders(), {
    startDate: ['start_date', 'ASC'],
    '-startDate': ['start_date', 'DESC']
  });
  t.deepEqual(orderScaffold.getOrderByQuery('-startDate'), [['start_date', 'DESC']]);
});

test('Order Scaffold Works with multi order', (t) => {
  const orderScaffold = new OrderScaffold();
  orderScaffold.setFields(['id', 'startDate']);
  t.deepEqual(
    orderScaffold.getOrderByQuery('-id,start_date'),
    [['id', 'DESC'], ['startDate', 'ASC']]
  );
});

test('Filter Scaffold support string equal', (t) => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('createdAt');
  const schema = filterScaffold.getFilterSchema();
  t.true(Object.keys(schema).includes('createdAt'));
  const conditions = filterScaffold.getConditions({
    created_at: 'foo'
  });
  t.deepEqual({
    createdAt: 'foo'
  }, conditions);
});

test('Filter Scaffold support number', (t) => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('totalAmount', 'number');
  const schema = filterScaffold.getFilterSchema();
  t.true(Object.keys(schema).includes('totalAmount'));
  t.deepEqual({
    totalAmount: 123
  }, filterScaffold.getConditions({
    total_amount: 123
  }));
  t.deepEqual({
    totalAmount: {
      $gte: 100,
      $lte: 200
    }
  }, filterScaffold.getConditions({
    total_amount_$gte: 100,
    total_amount_$lte: 200
  }));

  t.throws(() => filterScaffold.getConditions({
    total_amount_$gte: 100,
    total_amount: 200
  }, /conflict/));
});

test('Filter Scaffold replace default operators', (t) => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('totalAmount', 'number', { operators: [] });
  const schema = filterScaffold.getFilterSchema();
  t.true(schema.totalAmount.operators.length === 0);
  t.deepEqual({}, filterScaffold.getConditions({
    total_amount_$gte: 100
  }));
  t.deepEqual({
    totalAmount: 100
  }, filterScaffold.getConditions({
    total_amount: 100
  }));
});

test('Filter Scaffold skip without value', (t) => {
  const filterScaffold = new FilterScaffold();
  filterScaffold.addFilterSchema('totalAmount', 'number');
  t.deepEqual({
    totalAmount: {
      $gte: 100
    }
  }, filterScaffold.getConditions({
    total_amount_$gte: 100,
    total_amount_$lte: null
  }));
});
