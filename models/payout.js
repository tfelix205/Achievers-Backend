module.exports = (sequelize, DataTypes) => {
  const Payout = sequelize.define('Payout', {
    id: {
         type: DataTypes.INTEGER,
          autoIncrement: true,
           primaryKey: true
         },
    amount: {
         type: DataTypes.FLOAT,
          allowNull: false
         },
    status: {
         type: DataTypes.STRING,
          defaultValue: 'pending'
         },
    payoutDate: {
         type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
         },
  });
  return Payout;
};
