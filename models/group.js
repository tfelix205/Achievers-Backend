module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define('Group', {
    id: {
         type: DataTypes.INTEGER,
          autoIncrement: true,
           primaryKey: true
         },
    name: {
         type: DataTypes.STRING,
          allowNull: false
         },
    contributionAmount: {
         type: DataTypes.FLOAT,
          allowNull: false
         },
    cycle: {
         type: DataTypes.STRING,
          defaultValue: 'monthly'
         },
    status: {
         type: DataTypes.STRING,
          defaultValue: 'active'
         },
  });
  return Group;
};
