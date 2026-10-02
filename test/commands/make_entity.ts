import test from 'node:test';
import assert from 'node:assert/strict';
import { MakeEntity, MakeDbView } from './../../src/commands/make_entity.ts';
import DI from '../../src/di.ts';
import * as providers from '../../src/services/providers.ts';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);

test('Make entity mapping', () => {
  assert.equal(MakeEntity.typeMapping('boolean'), 'DataTypes.BOOLEAN');
  assert.equal(MakeEntity.typeMapping('tinyint(1)'), 'DataTypes.BOOLEAN');
  assert.equal(MakeEntity.typeMapping('bit(1)'), 'DataTypes.BOOLEAN');

  assert.equal(MakeEntity.typeMapping('smallint(5)'), 'DataTypes.INTEGER(5)');

  assert.equal(MakeEntity.typeMapping('bigint'), 'DataTypes.BIGINT');

  assert.equal(MakeEntity.typeMapping("enum('foo')"), "DataTypes.ENUM('foo')");

  assert.equal(MakeEntity.typeMapping('varchar'), 'DataTypes.STRING');
  assert.equal(MakeEntity.typeMapping('varchar(255)'), 'DataTypes.STRING(255)');

  assert.equal(MakeEntity.typeMapping('char(5)'), 'DataTypes.CHAR(5)');

  assert.equal(MakeEntity.typeMapping('text'), 'DataTypes.TEXT');

  assert.equal(MakeEntity.typeMapping('year'), 'DataTypes.INTEGER(4)');

  assert.equal(MakeEntity.typeMapping('datetime'), 'DataTypes.DATE');

  assert.equal(MakeEntity.typeMapping('date'), 'DataTypes.DATEONLY');

  assert.equal(MakeEntity.typeMapping('time'), 'DataTypes.TIME');

  assert.equal(MakeEntity.typeMapping('float'), 'DataTypes.FLOAT');

  assert.equal(MakeEntity.typeMapping('decimal'), 'DataTypes.DECIMAL');
  assert.equal(MakeEntity.typeMapping('decimal(1,2)'), 'DataTypes.DECIMAL(1, 2)');

  assert.equal(MakeEntity.typeMapping('float8'), 'DataTypes.DOUBLE');

  assert.equal(MakeEntity.typeMapping('uuid'), 'DataTypes.UUIDV4');

  assert.equal(MakeEntity.typeMapping('jsonb'), 'DataTypes.JSONB');

  assert.equal(MakeEntity.typeMapping('json'), 'DataTypes.JSON');

  assert.equal(MakeEntity.typeMapping('geometry'), 'DataTypes.GEOMETRY');
});

test('Make entity generates timestamp SQL expressions', () => {
  // 原测试即传空 argv；$0 仅在真实 CLI 路径使用，空对象运行时合法，仅类型层面收窄为构造入参
  const command = new MakeDbView({} as ConstructorParameters<typeof MakeDbView>[0]);
  const sql = command.getSql('users', [{ fieldName: 'createdAt' }, { fieldName: 'name' }]);
  assert.ok(sql.includes('FROM_UNIXTIME'));
  assert.ok(sql.includes('`name` AS `name`'));
});
