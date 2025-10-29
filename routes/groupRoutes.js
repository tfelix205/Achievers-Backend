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
// router.post('/:groupId/attach-payout', authenticate, attachPayoutToGroup);
router.post('/:groupId/join-request/:memberId', authenticate, manageJoinRequest);
router.post('/:id/start-cycle', authenticate, startCycle);
router.post('/:id/contribute', authenticate, makeContribution);
router.post('/:id/end-cycle', authenticate, endCycle);






module.exports = router;






/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Group and cycle management
 */

/**
 * @swagger
 * /groups/create:
 *   post:
 *     summary: Create a new Ajo group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupName
 *               - contributionAmount
 *               - contributionFrequency
 *             properties:
 *               groupName:
 *                 type: string
 *                 example: "Team Alpha"
 *               contributionAmount:
 *                 type: number
 *                 example: 5000
 *               contributionFrequency:
 *                 type: string
 *                 example: "weekly"
 *               payoutFrequency:
 *                 type: string
 *                 example: "monthly"
 *               penaltyFee:
 *                 type: number
 *                 example: 200
 *               description:
 *                 type: string
 *                 example: "Weekly savings group for our tech team."
 *               totalMembers:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       201:
 *         description: Group created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /groups/all:
 *   get:
 *     summary: Get all groups the user belongs to
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's groups
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     summary: Get detailed information about a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group details
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /groups/{id}/invite:
 *   get:
 *     summary: Generate an invite link for a group (Admin only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Invite link generated successfully
 *       403:
 *         description: Only admin can generate invite links
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /groups/{id}/join:
 *   post:
 *     summary: Request to join a group using invite link
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group ID
 *       - in: query
 *         name: invite
 *         required: true
 *         schema:
 *           type: string
 *         description: Invite code
 *     responses:
 *       200:
 *         description: Join request sent successfully
 *       400:
 *         description: Invalid invite or missing payout account
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /groups/{groupId}/join-request/{memberId}:
 *   post:
 *     summary: Approve or reject a join request (Admin only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 example: approve
 *     responses:
 *       200:
 *         description: Join request handled successfully
 *       403:
 *         description: Only admin can manage requests
 *       404:
 *         description: Group or membership not found
 */

/**
 * @swagger
 * /groups/{id}/summary:
 *   get:
 *     summary: Get financial summary of a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group financial summary
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /groups/payout-account:
 *   post:
 *     summary: Add payout account for a user
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bankName
 *               - accountNumber
 *             properties:
 *               bankName:
 *                 type: string
 *                 example: "Access Bank"
 *               accountNumber:
 *                 type: string
 *                 example: "0123456789"
 *               isDefault:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Payout account added successfully
 *       400:
 *         description: Validation error
 */

/**
 * @swagger
 * /groups/{id}/start-cycle:
 *   post:
 *     summary: Admin starts a new contribution cycle
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cycle started successfully
 *       400:
 *         description: Cycle already active or not enough members
 *       403:
 *         description: Only admin can start cycle
 */

/**
 * @swagger
 * /groups/{id}/contribute:
 *   post:
 *     summary: Make a contribution in the active cycle
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Contribution successful
 *       400:
 *         description: Already contributed or invalid amount
 *       403:
 *         description: Not a member
 *       404:
 *         description: Group or cycle not found
 */

/**
 * @swagger
 * /groups/{id}/end-cycle:
 *   post:
 *     summary: Admin ends the active contribution cycle
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cycle ended successfully
 *       403:
 *         description: Only admin can end cycle
 *       404:
 *         description: Group or cycle not found
 */

