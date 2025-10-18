const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const auth = require('../middleware/auth');

router.post('/', auth, groupController.createGroup);
router.get('/', auth, groupController.getUserGroups);
router.get('/:id', auth, groupController.getGroupById);
router.post('/:id/join', auth, groupController.joinGroup);
router.get('/:id/members', auth, groupController.getGroupMembers);

module.exports = router;
