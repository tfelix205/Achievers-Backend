const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { makeContribution } = require('../controllers/contributionController');

router.post('/contribution', authenticate, makeContribution);

module.exports = router;
