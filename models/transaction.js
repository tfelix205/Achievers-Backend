module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: 
    { type: DataTypes.INTEGER,
       autoIncrement: true,
        primaryKey: true },
    type: { 
      type: DataTypes.ENUM('fund', 'withdraw', 'contribution', 'payout'), 
      allowNull: false 
    },
    amount: {
       type: DataTypes.FLOAT,
        allowNull: false },
    status: {
       type: DataTypes.STRING,
        defaultValue: 'success' },
    reference: {
       type: DataTypes.STRING,
        unique: true },
    date: {
       type: DataTypes.DATE,
        defaultValue: DataTypes.NOW },
  });
  return Transaction;
};
