import test from 'node:test';
import assert from 'node:assert/strict';
import Config from '../../src/services/config.js';
import Env from '../../src/services/env.js';

const configPath = `${import.meta.dirname}/../_demo_project/config`;

test('merge 3 levels files', () => {
  const config = new Config(new Env());
  config.setPath(configPath);
  assert.ok(Object.keys(config.get()).length > 6);
  assert.equal(config.get('swagger.basePath'), '/');
});

test('config instances do not share loaded values', () => {
  const first = new Config(new Env()).setPath(configPath);
  const second = new Config(new Env()).setPath(configPath);
  first.get().app.name = 'first';
  assert.notEqual(second.get().app.name, 'first');
});

test('reload keeps merged files clean', () => {
  const config = new Config(new Env()).setPath(configPath);
  config.get();
  const mergedFilesCount = config.getMergedFiles().length;
  assert.ok(mergedFilesCount >= 2);
  config.reload();
  config.get();
  assert.equal(config.getMergedFiles().length, mergedFilesCount);
});
