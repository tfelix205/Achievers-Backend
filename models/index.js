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
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error(' Unable to connect to the database:', error);
  }
})();

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Models

db.User = require('./user')(sequelize, DataTypes);


// Relationships





module.exports = db;