import { describe, it } from 'mocha/lib/mocha';
import { assert } from './helpers';
import path from 'path';
import EvaEngine, { DI } from '../src/engine';

describe('Engine', () => {
  it('default properties', () => {
    const projectRoot = path.normalize(`${__dirname}/_demo_project`);
    const engine = new EvaEngine({
      projectRoot,
      port: 3000
    });
    const meta = engine.getMeta();
    assert.equal(meta.projectRoot, projectRoot);
    assert.equal(meta.configPath, `${projectRoot}${path.sep}config`);
    assert.equal(meta.sourceRoot, `${projectRoot}${path.sep}src`);
    assert.equal(meta.port, 3000);
    assert.equal(engine.getDI(), DI);
  });
});
