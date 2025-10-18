module.exports = (sequelize, DataTypes) => {
  const Contribution = sequelize.define('Contribution', {
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
          defaultValue: 'success'
         },
    date: {
         type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
         },
  });
  return Contribution;
};
