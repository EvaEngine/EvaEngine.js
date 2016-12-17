import test from 'ava';
import Config from '../../src/di';
import Env from '../../src/services/env';

test('merge 3 levels files', (t) => {
  const config = new Config(new Env());
  config.setPath(`${__dirname}/../_demo_project/config`);
  t.true(Object.keys(config.get()).length > 6);
  t.is(config.get('swagger.basePath'), '/');
});
