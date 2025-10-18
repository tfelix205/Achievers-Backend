const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const payoutController = require('../controllers/payoutController');

// Admin triggers payout
router.post('/:groupId/trigger', auth, payoutController.triggerPayout);

// View payouts
router.get('/group/:groupId', auth, payoutController.getGroupPayouts);
router.get('/my', auth, payoutController.getMyPayouts);

module.exports = router;
