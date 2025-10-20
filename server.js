const express = require('express');
const cors = require('cors');
require('dotenv').config();
const cron = require('node-cron');
const db = require('./models');
const { processDuePayouts } = require('./services/ajoPayoutService');
const setupSwagger = require('./swagger/swagger')

const app = express();
app.use(cors());
app.use(express.json());
setupSwagger(app)


// Import routes
const userRoutes = require('./routes/userRoute');
const groupRoutes = require('./routes/groupRoute');
const contributionRoutes = require('./routes/contributionRoute');
const payoutRoutes = require('./routes/payoutRoute');
const webhookRoutes = require('./routes/webhookRoute');
const withdrawRoutes = require('./routes/withdrawRoute');
const bankRoutes = require('./routes/bankRoute');
const ajoRoutes = require('./routes/ajoRoute');
const payoutLogRoutes = require('./routes/ajoPayoutLogRoute');



app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/payments/webhook', webhookRoutes);
app.use('/api/payments/withdraw', withdrawRoutes);
app.use('/api/payments/banks', bankRoutes);
app.use('/api/ajo', ajoRoutes);
app.use('/api/ajo/payouts', payoutLogRoutes);





// Run every midnight
cron.schedule('0 0 * * *', async () => {
  console.log('🕒 Running daily Ajo payout scheduler...');
  await processDuePayouts();
});




app.get('/', (req, res) => res.send('Welcome to the Ajo API'));

const PORT = process.env.PORT || 5000;

db.sequelize.sync().then(() => {
  console.log('Models synced successfully.');
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT} `,`and https://splita.onrender.com` )
  );
});
