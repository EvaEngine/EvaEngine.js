import test from 'ava';
import Sequelize from 'sequelize';
import util from 'util';
import Entities from './../../src/entities/index.js';

test('Custom validator', (t) => {
  const entities = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize('database', null, null, { dialect: 'mysql' }));
  t.true(util.isFunction(entities.getInstance().validateIsUnique));
});

test('Multi instances', (t) => {
  const entities1 = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize('database', null, null, { dialect: 'mysql' }));
  const entities2 = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize('database', null, null, { dialect: 'mysql' }));
  t.true(entities1.getInstance() instanceof Sequelize);
  t.true(entities2.getInstance() instanceof Sequelize);
  t.false(entities1 === entities2);
  t.is(Object.keys(entities1.getAll()).length, 1);
});

test('Scan from file', (t) => {
  const entities = new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize('database', null, null, { dialect: 'mysql' }));
  t.is(entities.getSequelize(), Sequelize);
  t.true(entities.getInstance() instanceof Sequelize);
  t.is(Object.keys(entities.getAll()).length, 1);
  t.true(entities.getAll().hasOwnProperty('kv'));
});

test('uniqueInsert converts booleans and builds bind parameters', (t) => {
  const entities = new Entities('', null);
  let query;
  entities.getInstance = () => ({
    query: (sql, options) => {
      query = { sql, options };
      return Promise.resolve();
    }
  });
  entities.uniqueInsert({
    tableName: 'items',
    input: { active: true, name: 'one' },
    uniqueCondition: 'SELECT id FROM items WHERE name = $name'
  });
  t.is(query.options.bind.active, 1);
  t.is(query.options.bind.name, 'one');
  t.true(query.sql.includes('INSERT INTO items'));
});
