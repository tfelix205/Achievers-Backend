const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const contributionController = require('../controllers/contributionController');

router.post('/:groupId', auth, contributionController.contribute);
router.get('/my', auth, contributionController.getMyContributions);
router.get('/group/:groupId', auth, contributionController.getGroupContributions);

module.exports = router;
