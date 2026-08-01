import DI from '../src/di.js';
import * as providers from '../src/services/providers.js';
import util from 'util';

if (!util.isFunction) {
	util.isFunction = value => typeof value === 'function';
}

// if (process.version.replace(/v|\./g, '') < 600) {
//   global.Reflect = require('harmony-reflect'); //eslint-disable-line global-require
// }
DI.registerMockedProviders(Object.values(providers), `${process.cwd()}/test/_demo_project/config`);
