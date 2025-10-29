module.exports = (sequelize, DataTypes) => {
    const Cycle = sequelize.define("cycle", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        groupId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        activeMemberId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        currentRound: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        totalRounds: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        totalCollected: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        status: {
            type: DataTypes.ENUM('pending', 'active', 'completed'),
            defaultValue: 'pending',
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        tableName: 'cycles',
        timestamps: true,
    });

    return Cycle
};