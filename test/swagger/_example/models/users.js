/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Users', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.BIGINT,
      comment: '',
      references: {
        model: '',
        key: ''
      }
    },
    realName: {
      allowNull: true,
      type: DataTypes.STRING,
      comment: '真实姓名'
    },
    userName: {
      allowNull: true,
      type: DataTypes.STRING,
      comment: ''
    }
  }, {
    tableName: 'users',
    timestamps: false,
    freezeTableName: true
  });
};
