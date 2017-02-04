import test from 'ava';
import MakeEntityCommand from './../../src/commands/make_entity';
import DI from '../../src/di';
import * as providers from '../../src/services/providers';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);

test('Make entity mapping', (t) => {
  t.is(MakeEntityCommand.typeMapping('boolean'), 'DataTypes.BOOLEAN');
  t.is(MakeEntityCommand.typeMapping('tinyint(1)'), 'DataTypes.BOOLEAN');
  t.is(MakeEntityCommand.typeMapping('bit(1)'), 'DataTypes.BOOLEAN');

  t.is(MakeEntityCommand.typeMapping('smallint(5)'), 'DataTypes.INTEGER(5)');

  t.is(MakeEntityCommand.typeMapping('bigint'), 'DataTypes.BIGINT');

  t.is(MakeEntityCommand.typeMapping("enum('foo')"), "DataTypes.ENUM('foo')");

  t.is(MakeEntityCommand.typeMapping('varchar'), 'DataTypes.STRING');
  t.is(MakeEntityCommand.typeMapping('varchar(255)'), 'DataTypes.STRING(255)');

  t.is(MakeEntityCommand.typeMapping('char(5)'), 'DataTypes.CHAR(5)');

  t.is(MakeEntityCommand.typeMapping('text'), 'DataTypes.TEXT');

  t.is(MakeEntityCommand.typeMapping('year'), 'DataTypes.INTEGER(4)');

  t.is(MakeEntityCommand.typeMapping('datetime'), 'DataTypes.DATE');

  t.is(MakeEntityCommand.typeMapping('date'), 'DataTypes.DATEONLY');

  t.is(MakeEntityCommand.typeMapping('time'), 'DataTypes.TIME');

  t.is(MakeEntityCommand.typeMapping('float'), 'DataTypes.FLOAT');

  t.is(MakeEntityCommand.typeMapping('decimal'), 'DataTypes.DECIMAL');

  t.is(MakeEntityCommand.typeMapping('float8'), 'DataTypes.DOUBLE');

  t.is(MakeEntityCommand.typeMapping('uuid'), 'DataTypes.UUIDV4');

  t.is(MakeEntityCommand.typeMapping('jsonb'), 'DataTypes.JSONB');

  t.is(MakeEntityCommand.typeMapping('json'), 'DataTypes.JSON');

  t.is(MakeEntityCommand.typeMapping('geometry'), 'DataTypes.GEOMETRY');
});
