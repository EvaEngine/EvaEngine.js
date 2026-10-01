import DI from '../src/di.ts';
import * as providers from '../src/services/providers.ts';
import util from 'util';

if (!(util as { isFunction?: (v: unknown) => boolean }).isFunction) {
	(util as { isFunction?: (v: unknown) => boolean }).isFunction = value => typeof value === 'function';
}

// if (process.version.replace(/v|\./g, '') < 600) {
//   global.Reflect = require('harmony-reflect'); //eslint-disable-line global-require
// }
DI.registerMockedProviders(Object.values(providers), `${process.cwd()}/test/_demo_project/config`);
