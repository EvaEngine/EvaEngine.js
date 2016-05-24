import { describe, it } from 'mocha/lib/mocha';
import { assert, expect } from '../helpers';
import Config from '../../src/services/config';
import Env from '../../src/services/env';

describe('Config Service', () => {
  it('merge 3 levels files', () => {
    const config = new Config(new Env());
    config.setPath(`${__dirname}/../_demo_project/config`);
    assert.isAbove(Object.keys(config.get()).length, 6);
    assert.equal(config.get('swagger.basePath'), '/');
  });
});
