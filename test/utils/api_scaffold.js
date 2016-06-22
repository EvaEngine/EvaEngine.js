import { describe, it } from 'mocha/lib/mocha';
import { assert } from './../helpers';
import { OrderScaffold, FilterScaffold } from '../../src/utils/api_scaffold';

describe('Order Scaffold', () => {
  describe('Snake to Camel', () => {
    it('Works normal', () => {
      const orderScaffold = new OrderScaffold();
      orderScaffold.setFields(['startDate']);
      assert.deepEqual({
        start_date: 'startDate ASC',
        '-start_date': 'startDate DESC'
      }, orderScaffold.getAvailableOrders());
      assert.equal(' startDate DESC', orderScaffold.getOrderByQuery('-start_date'));
      assert.equal('', orderScaffold.getOrderByQuery('unknown order'));
    });

    it('Works with default order', () => {
      const orderScaffold = new OrderScaffold();
      orderScaffold.setFields(['id', 'startDate'], 'id');
      assert.equal(' id DESC', orderScaffold.getOrderByQuery('unknown order'));
    });

    it('Works with camel case', () => {
      const orderScaffold = new OrderScaffold('camel');
      orderScaffold.setFields(['start_date']);
      assert.deepEqual({
        startDate: 'start_date ASC',
        '-startDate': 'start_date DESC'
      }, orderScaffold.getAvailableOrders());
      assert.equal(' start_date DESC', orderScaffold.getOrderByQuery('-startDate'));
    });

    it('Works with multi order', () => {
      const orderScaffold = new OrderScaffold();
      orderScaffold.setFields(['id', 'startDate']);
      assert.equal(' id DESC, startDate ASC', orderScaffold.getOrderByQuery('-id,start_date'));
    });
  });
});

describe('Filter Scaffold', () => {
  it('support string equal', () => {
    const filterScaffold = new FilterScaffold();
    filterScaffold.addFilterSchema('createdAt');
    const schema = filterScaffold.getFilterSchema();
    assert.include(Object.keys(schema), 'createdAt');
    const conditions = filterScaffold.getConditions({
      created_at: 'foo'
    });
    assert.deepEqual({
      createdAt: 'foo'
    }, conditions);
  });

  it('support number', () => {
    const filterScaffold = new FilterScaffold();
    filterScaffold.addFilterSchema('totalAmount', 'number');
    const schema = filterScaffold.getFilterSchema();
    assert.include(Object.keys(schema), 'totalAmount');
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

    assert.throw(() => filterScaffold.getConditions({
      total_amount_$gte: 100,
      total_amount: 200
    }, /conflict/));
  });

  it('replace default operators', () => {
    const filterScaffold = new FilterScaffold();
    filterScaffold.addFilterSchema('totalAmount', 'number', { operators: [] });
    const schema = filterScaffold.getFilterSchema();
    assert.lengthOf(schema.totalAmount.operators, 0);
    assert.deepEqual({}, filterScaffold.getConditions({
      total_amount_$gte: 100
    }));
    assert.deepEqual({
      totalAmount: 100
    }, filterScaffold.getConditions({
      total_amount: 100
    }));
  });

  it('skip without value', () => {
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
});
