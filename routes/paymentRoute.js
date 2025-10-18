const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Initiate Paystack transaction
router.post('/initiate', auth, paymentController.initiatePayment);

// Verify transaction after payment
router.get('/verify/:reference', auth, paymentController.verifyPayment);

module.exports = router;
