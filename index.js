var fs = require('fs');
try {
  fs.accessSync(__dirname + '/lib/index.js', fs.R_OK);
  /**
   * @type {engineCore}
   */
  exports = module.exports = require('./lib');
  if (!global._babelPolyfill) {
    require('babel-polyfill');
  }
} catch (e) {
  /**
   * @type {engineCore}
   */
  exports = module.exports = require('./src');
}


