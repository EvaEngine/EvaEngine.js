import test from 'ava';
import path from 'path';
import EvaEngine, { DI } from '../src/engine';

test('default properties', (t) => {
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    port: 3000
  });
  const meta = engine.getMeta();
  t.is(meta.projectRoot, projectRoot);
  t.is(meta.configPath, `${projectRoot}${path.sep}config`);
  t.is(meta.sourceRoot, `${projectRoot}${path.sep}src`);
  t.is(meta.port, 3000);
  t.is(engine.getDI(), DI);
});
