module.exports = (sequelize, DataTypes) => {
  const AjoMember = sequelize.define('AjoMember', {
    id: {
       type: DataTypes.INTEGER,
        autoIncrement: true,
         primaryKey: true },
    role: {
       type: DataTypes.ENUM('admin', 'member'),
        defaultValue: 'member'
       },
    payoutOrder: {
       type: DataTypes.INTEGER,
        allowNull: true }, // who gets first payout
    hasReceived: {
       type: DataTypes.BOOLEAN,
        defaultValue: false },
  });
  return AjoMember;
};
