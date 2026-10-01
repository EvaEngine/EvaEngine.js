import test from 'node:test';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import Entities from './../../src/entities/index.ts';

const entitiesPath = `${import.meta.dirname}/../_demo_project/entities`;

test('Custom validator', () => {
  const entities = new Entities(entitiesPath, new Sequelize('database', null as unknown as string, null as unknown as string, { dialect: 'mysql' }));
  // validateIsUnique 由 src/entities 运行时补丁到 sequelize 原型，类型未声明；
  // Node 24 已移除 util.isFunction，改用等价的 typeof 判定（期望值不变）
  assert.ok(typeof (entities.getInstance() as unknown as { validateIsUnique: unknown }).validateIsUnique === 'function');
});

test('Multi instances', () => {
  const entities1 = new Entities(entitiesPath, new Sequelize('database', null as unknown as string, null as unknown as string, { dialect: 'mysql' }));
  const entities2 = new Entities(entitiesPath, new Sequelize('database', null as unknown as string, null as unknown as string, { dialect: 'mysql' }));
  assert.ok(entities1.getInstance() instanceof Sequelize);
  assert.ok(entities2.getInstance() instanceof Sequelize);
  assert.notEqual(entities1, entities2);
  assert.equal(Object.keys(entities1.getAll()).length, 1);
});

test('Scan from file', () => {
  const entities = new Entities(entitiesPath, new Sequelize('database', null as unknown as string, null as unknown as string, { dialect: 'mysql' }));
  assert.equal(entities.getSequelize(), Sequelize);
  assert.ok(entities.getInstance() instanceof Sequelize);
  assert.equal(Object.keys(entities.getAll()).length, 1);
  assert.ok(Object.prototype.hasOwnProperty.call(entities.getAll(), 'kv'));
});

test('uniqueInsert converts booleans and builds bind parameters', () => {
  const entities = new Entities('', null);
  // query 在 mock 回调内赋值，TS 无法静态判定确定赋值，这里标注确定赋值断言
  let query!: { sql: string; options: { bind: Record<string, unknown> } };
  // mock 实例只提供 query 方法，与 Sequelize 结构不兼容，收窄以匹配 getInstance 签名
  entities.getInstance = () => ({
    query: (sql: string, options: { bind: Record<string, unknown> }) => {
      query = { sql, options };
      return Promise.resolve();
    }
  } as unknown as Sequelize);
  entities.uniqueInsert({
    tableName: 'items',
    input: { active: true, name: 'one' },
    uniqueCondition: 'SELECT id FROM items WHERE name = $name'
  });
  assert.equal(query.options.bind.active, 1);
  assert.equal(query.options.bind.name, 'one');
  assert.ok(query.sql.includes('INSERT INTO items'));
});
