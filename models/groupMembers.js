module.exports = (sequelize, DataTypes) => {
  const GroupMembers = sequelize.define('GroupMembers', {
    role: {
       type: DataTypes.STRING,
        defaultValue: 'member' },
    payoutOrder: {
       type: DataTypes.INTEGER,
        defaultValue: 1 },
  });
  return GroupMembers;
};
