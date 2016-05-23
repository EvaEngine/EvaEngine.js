var fs = require('fs');
var exportPath = './src';

try {
  fs.accessSync(__dirname + '/lib/index.js', fs.R_OK);
  exportPath = './lib';
} catch (e) {
  //do nothing
}

exports = module.exports = require(exportPath);
