module.exports = (sequelize, DataTypes) => {
  const AjoGroup = sequelize.define('AjoGroup', {
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
    frequency: {
         type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
          allowNull: false
         },
    memberLimit: {
         type: DataTypes.INTEGER,
          allowNull: false
         },
    totalCycle: {
         type: DataTypes.INTEGER,
          allowNull: false
         },
    currentCycle: {
         type: DataTypes.INTEGER,
          defaultValue: 0
         },
    status: {
         type: DataTypes.ENUM('pending', 'active', 'completed'),
          defaultValue: 'pending' },
    nextPayoutDate: {
  type: DataTypes.DATE,
  allowNull: false,
},
commissionRate: {
  type: DataTypes.FLOAT,
  defaultValue: 2.0, // 2% per cycle
},


  });
  return AjoGroup;
};
