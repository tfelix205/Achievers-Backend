

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { 
        type: DataTypes.INTEGER,
         autoIncrement: true,
          primaryKey: true
     },
    name: {
         type: DataTypes.STRING,
          allowNull: false
     },
    email: {
         type: DataTypes.STRING,
          unique: true, 
          allowNull: false,
          validate: {
               isEmail: true
          },
     },
    phone: {
         type: DataTypes.STRING
     },
    password: {
         type: DataTypes.STRING,
          allowNull: false
     },
     isVerified: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
    },
     otp: {
          type: DataTypes.STRING,
          allowNull: true
     },
     otpExpiry: {
          type: DataTypes.DATE,
          allowNull: true
     }
  });
  return User;
};
