module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define('Group', {
    id: {
         type: DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey: true
    },
    groupName: {
         type: DataTypes.STRING,
         allowNull: false
    },
    contributionAmount: {
         type: DataTypes.FLOAT,
         allowNull: false
    },

    contributionFrequency: {
         type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
          allowNull: false
    },
    payoutFrequency: {
         type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
          allowNull: false
    },
    penaltyFee: {
         type: DataTypes.FLOAT,
         defaultValue: 5.0
    },
    description: {
         type: DataTypes.TEXT
    },
    
    totalMembers: {
         type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 2,
            max: 12
          }
    },
        
    nextPayoutDate: {
         type: DataTypes.DATE,
         allowNull: true
    },
    commissionRate: {
         type: DataTypes.FLOAT,
         defaultValue: 2.0,
    },
    adminId: {
         type: DataTypes.UUID,
         allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'completed', 'archived'),
      defaultValue: 'pending',
      allowNull: false,
    },
    inviteCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
  }, {
    tableName: 'groups',
    timestamps: true,
  });

  return Group;
};
