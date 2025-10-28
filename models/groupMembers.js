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
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING,
            defaultValue: 'member',
        },
        membershipStatus: {
            type: DataTypes.ENUM('pending', 'active', 'rejected'),
            defaultValue: 'pending',
        },
        paymentStatus: {
            type: DataTypes.ENUM('paid', 'unpaid'),
            defaultValue: 'unpaid',
        },
        hasReceived: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },

      },  {
            tableName: 'group_members',
            timestamps: true,
        });

    return Membership
};