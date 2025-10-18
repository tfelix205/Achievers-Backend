module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define('Wallet', {
    id: {
         type: DataTypes.INTEGER,
          autoIncrement: true,
           primaryKey: true
         },
    balance: {
         type: DataTypes.FLOAT,
          defaultValue: 0.0
         },
  });
  return Wallet;
};
