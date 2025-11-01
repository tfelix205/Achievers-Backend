module.exports = (sequelize, DataTypes) => {
  const Contribution = sequelize.define('Contribution', {
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
    amount: { 
      type: DataTypes.FLOAT, 
      allowNull: false 
    },
    status: { 
      type: DataTypes.ENUM('pending', 'completed'), 
      defaultValue: 'pending' 
    },
    contributionDate: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    },
    cycleId: {
      type: DataTypes.UUID, // must match Cycle.cycleId  or however chisom named it
      allowNull: false,
    },
    penaltyFee: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    }
  }, {
    tableName: 'contributions',
    timestamps: true,
  });

  return Contribution;
};




























// module.exports = (sequelize, DataTypes) => {
//     const Contribution = sequelize.define('Contribution', {
//         id: {
//             allowNull: false,
//             primaryKey: true,
//             type: DataTypes.UUID,
//             defaultValue: DataTypes.UUIDV4
//         },

//         groupId: {
//             type: DataTypes.UUID,
//             allowNull: false,
//             references: {
//                 model: 'Groups',
//                 key: 'id'
//             },
//             onDelete: 'CASCADE'
//         },

//         memberId: {
//             type: DataTypes.UUID,
//             allowNull: false,
//             references: {
//                 model: 'GroupMembers',
//                 key: 'id'
//             },
//             onDelete: 'CASCADE'
//         },

//         amount: {
//             type: DataTypes.DECIMAL(15, 2),
//             allowNull: false
//         },

//         cycleId: {
//             type: DataTypes.UUID,
//             allowNull: false
//         },

//         isLate: {
//             type: DataTypes.BOOLEAN,
//             defaultValue: false
//         },

//         paymentDate: {
//             type: DataTypes.DATE,
//             allowNull: true
//         },

//         status: {
//             type: DataTypes.ENUM('pending', 'paid', 'overdue'),
//             defaultValue: 'pending'
//         },
//     })

//     Contribution.associate = (models) => {
//         Contribution.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group', onDelete: 'CASCADE' });
//         Contribution.belongsTo(models.Cycle, { foreignKey: 'cycleId', as: 'cycle', onDelete: 'CASCADE' });
//         Contribution.belongsTo(models.Membership, { foreignKey: 'memberId', as: 'member', onDelete: 'CASCADE' });
//     }

//     return Contribution;
// }