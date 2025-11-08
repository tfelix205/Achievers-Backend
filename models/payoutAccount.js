module.exports = (sequelize, DataTypes) => {
    const payoutAccount = sequelize.define('payoutAccount', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        bankName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        accountNumber: {
            type: DataTypes.STRING,
            allowNull: false
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false
        },
    }, {
        tableName : 'payoutAccounts',
        timestamps: true,
    });

    return payoutAccount
};