import test from 'ava';
import Config from '../../src/services/config.js';
import Env from '../../src/services/env.js';

test('merge 3 levels files', (t) => {
  const config = new Config(new Env());
  config.setPath(`${import.meta.dirname}/../_demo_project/config`);
  t.true(Object.keys(config.get()).length > 6);
  t.is(config.get('swagger.basePath'), '/');
});

test('config instances do not share loaded values', (t) => {
  const first = new Config(new Env()).setPath(`${import.meta.dirname}/../_demo_project/config`);
  const second = new Config(new Env()).setPath(`${import.meta.dirname}/../_demo_project/config`);
  first.get().app.name = 'first';
  t.not(second.get().app.name, 'first');
});
