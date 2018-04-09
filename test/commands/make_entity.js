import test from 'ava';
import { MakeEntity } from './../../src/commands/make_entity';
import DI from '../../src/di';
import * as providers from '../../src/services/providers';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);

test('Make entity mapping', (t) => {
  t.is(MakeEntity.typeMapping('boolean'), 'DataTypes.BOOLEAN');
  t.is(MakeEntity.typeMapping('tinyint(1)'), 'DataTypes.BOOLEAN');
  t.is(MakeEntity.typeMapping('bit(1)'), 'DataTypes.BOOLEAN');

  t.is(MakeEntity.typeMapping('smallint(5)'), 'DataTypes.INTEGER(5)');

  t.is(MakeEntity.typeMapping('bigint'), 'DataTypes.BIGINT');

  t.is(MakeEntity.typeMapping("enum('foo')"), "DataTypes.ENUM('foo')");

  t.is(MakeEntity.typeMapping('varchar'), 'DataTypes.STRING');
  t.is(MakeEntity.typeMapping('varchar(255)'), 'DataTypes.STRING(255)');

  t.is(MakeEntity.typeMapping('char(5)'), 'DataTypes.CHAR(5)');

  t.is(MakeEntity.typeMapping('text'), 'DataTypes.TEXT');

  t.is(MakeEntity.typeMapping('year'), 'DataTypes.INTEGER(4)');

  t.is(MakeEntity.typeMapping('datetime'), 'DataTypes.DATE');

  t.is(MakeEntity.typeMapping('date'), 'DataTypes.DATEONLY');

  t.is(MakeEntity.typeMapping('time'), 'DataTypes.TIME');

  t.is(MakeEntity.typeMapping('float'), 'DataTypes.FLOAT');

  t.is(MakeEntity.typeMapping('decimal'), 'DataTypes.DECIMAL');
  t.is(MakeEntity.typeMapping('decimal(1,2)'), 'DataTypes.DECIMAL(1, 2)');

  t.is(MakeEntity.typeMapping('float8'), 'DataTypes.DOUBLE');

  t.is(MakeEntity.typeMapping('uuid'), 'DataTypes.UUIDV4');

  t.is(MakeEntity.typeMapping('jsonb'), 'DataTypes.JSONB');

  t.is(MakeEntity.typeMapping('json'), 'DataTypes.JSON');

  t.is(MakeEntity.typeMapping('geometry'), 'DataTypes.GEOMETRY');
});
