const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const walletController = require('../controllers/walletController');

router.get('/', auth, walletController.getWallet);
router.post('/fund', auth, walletController.fundWallet);
router.post('/withdraw', auth, walletController.withdraw);
router.get('/transactions', auth, walletController.getTransactions);

module.exports = router;
