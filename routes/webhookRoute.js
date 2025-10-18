const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Paystack will POST here
router.post('/paystack', express.json({ verify: (req, res, buf) => (req.rawBody = buf) }), webhookController.paystackWebhook);

module.exports = router;
