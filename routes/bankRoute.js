const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');

// No auth needed (you can add auth if you want)
router.get('/', bankController.getBanks);

module.exports = router;
