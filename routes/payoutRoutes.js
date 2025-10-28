const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { createPayout } = require('../controllers/payoutController');


router.post('/payout', authenticate, createPayout);



module.exports = router;
