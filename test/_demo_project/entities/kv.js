/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('kv', {
    k: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    v: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'kv'
  });
};
