// models/ajoPayoutLog.js
module.exports = (sequelize, DataTypes) => {
  const AjoPayoutLog = sequelize.define('AjoPayoutLog', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    ajoGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    commission: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },

    paymentMethod: {
      type: DataTypes.ENUM('wallet', 'paystack'),
      defaultValue: 'wallet',
    },

    paystackTransferCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM('pending', 'success', 'failed'),
      defaultValue: 'pending',
    },

    payoutDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });

  return AjoPayoutLog;
};
