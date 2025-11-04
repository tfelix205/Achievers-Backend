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
    payoutAccountId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'payout_accounts',
            key: 'id'
        }
    },
    payoutOrder: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    hasReceivedPayout: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }


  }, {
    tableName: 'memberships',
    timestamps: true,
  });

  return Membership;
};
