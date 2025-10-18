const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const payoutLogController = require('../controllers/ajoPayoutLogController');

// Admin or user routes
router.get('/', auth, payoutLogController.getAllPayouts);
router.get('/my', auth, payoutLogController.getUserPayouts);
router.get('/group/:groupId', auth, payoutLogController.getGroupPayouts);

module.exports = router;
