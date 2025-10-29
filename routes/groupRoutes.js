const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { 
  createGroup,
  addPayoutAccount,
  attachPayoutToGroup,
  getUserGroups,
  generateInviteLink,
  joinGroup,
  manageJoinRequest,
  getGroupDetails,
  getGroupSummary,
  startCycle,
  makeContribution,
  endCycle
} = require('../controllers/groupController');


router.post('/create', authenticate, createGroup);
router.get('/all', authenticate, getUserGroups);
router.get('/:id', authenticate, getGroupDetails);
router.get('/:id/invite', authenticate, generateInviteLink);
router.post('/:id/join', authenticate, joinGroup);
router.get('/:id/summary', authenticate, getGroupSummary);


router.post('/payout-account', authenticate, addPayoutAccount);
router.post('/:groupId/attach-payout', authenticate, attachPayoutToGroup);
router.post('/:groupId/join-request/:memberId', authenticate, manageJoinRequest);
router.post('/:id/start-cycle', authenticate, startCycle);
router.post('/:id/contribute', authenticate, makeContribution);
router.post('/:id/end-cycle', authenticate, endCycle);






module.exports = router;
