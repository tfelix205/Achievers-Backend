module.exports = (sequelize, DataTypes) => {
    const Payout = sequelize.define('Payout', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },

        groupId: {
            type: DataTypes.UUID,
            allowNull: false
        },

        userId: {
            type: DataTypes.UUID,
            allowNull: false
        },

        cycleId: {
            type: DataTypes.UUID,
            allowNull: false
        },

        platformWalletId: {
            type: DataTypes.UUID,
            allowNull: true
        },

        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },

        commissionFee: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },

        penaltyFee: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0.00,
            allowNull: false
        },

        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed'),
            defaultValue: 'pending',
            allowNull: false
        },

        payoutDate: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    Payout.associate = (models) => {
        Payout.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group' });
        Payout.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
        Payout.belongsTo(models.PlatformWallet, { foreignKey: 'platformWalletId', as: 'platformWallet' });
        Payout.belongsTo(models.Cycle, { foreignKey: 'cycleId', as: 'cycle' });
    };

    return Payout;
};