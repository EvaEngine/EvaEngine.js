import test from 'ava';
import Entities from './../../src/entities';
import Sequelize from 'sequelize';
import util from 'util';

test('Custom validator', (t) => {
  const entities = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize());
  t.true(util.isFunction(entities.getInstance().validateIsUnique));
});
test('Scan from file', (t) => {
  const entities = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize());
  t.is(entities.getSequelize(), Sequelize);
  t.true(entities.getInstance() instanceof Sequelize);
  t.is(Object.keys(entities.getAll()).length, 1);
  t.true(entities.getAll().hasOwnProperty('kv'));
});
