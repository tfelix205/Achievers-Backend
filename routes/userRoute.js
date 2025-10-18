const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// Public routes
router.post('/register', userController.register);
router.post('/verify-otp', userController.verifyEmail);
router.post('/login', userController.login);

// Protected routes
router.get('/profile', auth, userController.profile);

module.exports = router;
