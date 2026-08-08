import test from 'node:test';
import assert from 'node:assert/strict';
import Sequelize from 'sequelize';
import util from 'util';
import Entities from './../../src/entities/index.js';

const entitiesPath = `${import.meta.dirname}/../_demo_project/entities`;

test('Custom validator', () => {
  const entities = new Entities(entitiesPath, new Sequelize('database', null, null, { dialect: 'mysql' }));
  assert.ok(util.isFunction(entities.getInstance().validateIsUnique));
});

test('Multi instances', () => {
  const entities1 = new Entities(entitiesPath, new Sequelize('database', null, null, { dialect: 'mysql' }));
  const entities2 = new Entities(entitiesPath, new Sequelize('database', null, null, { dialect: 'mysql' }));
  assert.ok(entities1.getInstance() instanceof Sequelize);
  assert.ok(entities2.getInstance() instanceof Sequelize);
  assert.notEqual(entities1, entities2);
  assert.equal(Object.keys(entities1.getAll()).length, 1);
});

test('Scan from file', () => {
  const entities = new Entities(entitiesPath, new Sequelize('database', null, null, { dialect: 'mysql' }));
  assert.equal(entities.getSequelize(), Sequelize);
  assert.ok(entities.getInstance() instanceof Sequelize);
  assert.equal(Object.keys(entities.getAll()).length, 1);
  assert.ok(Object.prototype.hasOwnProperty.call(entities.getAll(), 'kv'));
});

test('uniqueInsert converts booleans and builds bind parameters', () => {
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
  assert.equal(query.options.bind.active, 1);
  assert.equal(query.options.bind.name, 'one');
  assert.ok(query.sql.includes('INSERT INTO items'));
});
