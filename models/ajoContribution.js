module.exports = (sequelize, DataTypes) => {
  const AjoContribution = sequelize.define('AjoContribution', {
    id: {
       type: DataTypes.INTEGER,
        autoIncrement: true,
         primaryKey: true
         },
    amount: {
       type: DataTypes.FLOAT,
        allowNull: false
       },
    date: {
       type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
       },
  });
  return AjoContribution;
};
