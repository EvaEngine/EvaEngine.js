import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';
const env = process.env.NODE_ENV || 'development';
const config = require(path.join(__dirname, 'config.json'))[env];
const sequelize = new Sequelize(config.database, null, null, config);
const db = {};

fs
  .readdirSync(__dirname)
  .filter((file) => {
    const fileArray = file.split('.');
    return (file.indexOf('.') !== 0) &&
      (['js', 'es6'].indexOf(fileArray.pop()) !== -1) && (fileArray[0] !== 'index');
  })
  .forEach((file) => {
    const model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
