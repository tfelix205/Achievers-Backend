const { Sequelize, DataTypes } = require('sequelize');
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
        require: true,              // 🔒 Force SSL
        rejectUnauthorized: false,  // ✅ Allow self-signed certs (Render uses these)
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
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error(' Unable to connect to the database:', error);
  }
})();

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Models
db.Transaction = require('./transaction')(sequelize, DataTypes);
db.GroupMembers = require('./groupMembers')(sequelize, DataTypes);
db.User = require('./user')(sequelize, DataTypes);
db.Group = require('./group')(sequelize, DataTypes);
db.Contribution = require('./contribution')(sequelize, DataTypes);
db.Payout = require('./payout')(sequelize, DataTypes);
db.Wallet = require('./wallet')(sequelize, DataTypes);

// Relationships
db.User.hasMany(db.Contribution);
db.Contribution.belongsTo(db.User);

db.Group.hasMany(db.Contribution);
db.Contribution.belongsTo(db.Group);

db.Group.belongsToMany(db.User, { through: 'GroupMembers' });
db.User.belongsToMany(db.Group, { through: 'GroupMembers' });

db.Group.belongsToMany(db.User, { through: db.GroupMembers });
db.User.belongsToMany(db.Group, { through: db.GroupMembers });


// db.User.hasOne(db.Wallet);
// db.Wallet.belongsTo(db.User);

db.Payout.belongsTo(db.User);
db.Payout.belongsTo(db.Group);
db.Group.hasMany(db.Payout);
db.User.hasMany(db.Payout);


db.User.hasOne(db.Wallet, { onDelete: 'CASCADE' });
db.Wallet.belongsTo(db.User);

db.Wallet.hasMany(db.Transaction, { onDelete: 'CASCADE' });
db.Transaction.belongsTo(db.Wallet);

db.AjoGroup = require('./ajoGroup')(sequelize, DataTypes);
db.AjoMember = require('./ajoMember')(sequelize, DataTypes);
db.AjoContribution = require('./ajoContribution')(sequelize, DataTypes);

// AjoGroup ↔ Members
db.AjoGroup.hasMany(db.AjoMember, { onDelete: 'CASCADE' });
db.AjoMember.belongsTo(db.AjoGroup);

// AjoGroup ↔ Contributions
db.AjoGroup.hasMany(db.AjoContribution, { onDelete: 'CASCADE' });
db.AjoContribution.belongsTo(db.AjoGroup);

// User ↔ AjoMember (many-to-many relationship via AjoMember)
db.User.hasMany(db.AjoMember, { onDelete: 'CASCADE' });
db.AjoMember.belongsTo(db.User);

// User ↔ AjoContribution
db.User.hasMany(db.AjoContribution, { onDelete: 'CASCADE' });
db.AjoContribution.belongsTo(db.User);

db.AjoPayoutLog = require('./ajoPayoutLog')(sequelize, DataTypes);

db.AjoGroup.hasMany(db.AjoPayoutLog, {
  foreignKey: 'ajoGroupId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
db.AjoPayoutLog.belongsTo(db.AjoGroup, {
  foreignKey: 'ajoGroupId'
});

db.User.hasMany(db.AjoPayoutLog, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
db.AjoPayoutLog.belongsTo(db.User, {
  foreignKey: 'userId'
});





module.exports = db;
