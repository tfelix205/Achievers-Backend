const express = require('express');
const cors = require('cors');
require('dotenv').config();
const cron = require('node-cron');
const {sequelize} = require('./models');
const setupSwagger = require('./swagger/swagger')
const PORT = process.env.PORT || 5000;

//init
const app = express();
app.use(cors());
app.use(express.json());
setupSwagger(app)


// Import routes
const userRoutes = require('./routes/userRoute');
const groupRoutes = require('./routes/groupRoutes');


//access routes
app.get('/', (req, res) => res.send('Welcome to the Ajo API'));
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);



sequelize.sync().then(() => {
  console.log('Models synced successfully.');
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT} `,`and https://splita.onrender.com` )
  );
});
