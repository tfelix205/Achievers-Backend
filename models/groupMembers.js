module.exports = (sequelize, DataTypes) => {
  const Membership = sequelize.define('Membership', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    userId: { 
      type: DataTypes.UUID, 
      allowNull: false 
    },
    groupId: { 
      type: DataTypes.UUID, 
      allowNull: false 
    },
    role: { 
      type: DataTypes.STRING, 
      defaultValue: 'member' 
    },
    
    status: {
      type: DataTypes.ENUM('pending', 'active', 'rejected'),
      defaultValue: 'pending'
    },

  }, {
    tableName: 'memberships',
    timestamps: true,
  });

  return Membership;
};
