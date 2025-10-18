const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const withdrawController = require('../controllers/withdrawController');

router.post('/', auth, withdrawController.withdrawToBank);

module.exports = router;
