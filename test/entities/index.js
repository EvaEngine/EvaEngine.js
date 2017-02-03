import test from 'ava';
import Sequelize from 'sequelize';
import util from 'util';
import Entities from './../../src/entities';

test('Custom validator', (t) => {
  const entities = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize());
  t.true(util.isFunction(entities.getInstance().validateIsUnique));
});

test('Multi instances', (t) => {
  const entities1 = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize());
  const entities2 = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize());
  t.true(entities1.getInstance() instanceof Sequelize);
  t.true(entities2.getInstance() instanceof Sequelize);
  t.false(entities1 === entities2);
  t.is(Object.keys(entities1.getAll()).length, 1);
});

test('Scan from file', (t) => {
  const entities = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize());
  t.is(entities.getSequelize(), Sequelize);
  t.true(entities.getInstance() instanceof Sequelize);
  t.is(Object.keys(entities.getAll()).length, 1);
  t.true(entities.getAll().hasOwnProperty('kv'));
});
