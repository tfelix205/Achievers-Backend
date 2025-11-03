const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Initialize Korapay payment
router.post('/initialize-contribution', authenticate, paymentController.initializeContribution);

// Verify Korapay payment
router.get('/verify-contribution', authenticate, paymentController.verifyContribution);

module.exports = router;