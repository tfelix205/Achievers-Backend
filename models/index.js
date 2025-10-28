const Sequelize = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT  || "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,              //  Force SSL
        rejectUnauthorized: false,  //  Allow self-signed certs (Render uses these)
      },
    },
  },
  
);

// const sequelize = new Sequelize('ajo_db', 'root', 'Backend8989', {
//   host: 'localhost',
//    dialect: 'mysql',
//    logging:false 
//  });

 (async () => {
  try {
    await sequelize.authenticate();
    console.log(' Database connection has been established successfully.');
  } catch (error) {
    console.error(' Unable to connect to the database:', error);
  }
})();



// Models

User = require('./user')(sequelize, Sequelize.DataTypes);
const Group = require('./group')(sequelize, Sequelize.DataTypes);
const Membership = require('./groupMembers')(sequelize, Sequelize.DataTypes);
const PayoutAccount = require('./payoutAccount')(sequelize, Sequelize.DataTypes);
const Contribution = require('./contribution')(sequelize, Sequelize.DataTypes);
const Cycle = require('./cycle')(sequelize, Sequelize.DataTypes);
const Payout = require('./payout')(sequelize, Sequelize.DataTypes);



//  Defining all the  associations here, please don't do it in individual model files

// User ↔ Group (many-to-many through Membership)
User.belongsToMany(Group, { through: Membership, foreignKey: 'userId', as: 'groups' });
Group.belongsToMany(User, { through: Membership, foreignKey: 'groupId', as: 'members' });

// Group → Admin (1-to-1 with User)
Group.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });

// User → PayoutAccounts
User.hasMany(PayoutAccount, { foreignKey: 'userId', as: 'payoutAccounts' });
PayoutAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Contributions
User.hasMany(Contribution, { foreignKey: 'userId', as: 'contributions' });
Contribution.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Group.hasMany(Contribution, { foreignKey: 'groupId', as: 'contributions' });
Contribution.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

// Cycle
Group.hasMany(Cycle, { foreignKey: 'groupId', as: 'cycles' });
Cycle.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

Cycle.belongsTo(User, { foreignKey: 'activeMemberId', as: 'activeMember' });
Cycle.hasMany(Contribution, { foreignKey: 'cycleId', as: 'contributions' });

// Payout
User.hasMany(Payout, { foreignKey: 'userId', as: 'payouts' });
Group.hasMany(Payout, { foreignKey: 'groupId', as: 'payouts' });
Cycle.hasMany(Payout, { foreignKey: 'cycleId', as: 'payouts' });

Payout.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Payout.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
Payout.belongsTo(Cycle, { foreignKey: 'cycleId', as: 'cycle' });

// Exporting  all models so they can be accessed in controllers and jobs
module.exports = {
  sequelize,
  Sequelize,
  User,
  Group,
  Membership,
  PayoutAccount,
  Contribution,
  Cycle,
  Payout,
};
