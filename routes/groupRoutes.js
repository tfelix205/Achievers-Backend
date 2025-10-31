const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {groupRegisterValidator} = require('../middleware/validator')
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


router.post('/create', authenticate, groupRegisterValidator, createGroup);
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
 *   description: Group management, membership, and contribution operations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Group:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         groupName:
 *           type: string
 *         description:
 *           type: string
 *         contributionAmount:
 *           type: number
 *         contributionFrequency:
 *           type: string
 *           example: "weekly"
 *         payoutFrequency:
 *           type: string
 *           example: "monthly"
 *         totalMembers:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [pending, active, completed]
 *         adminId:
 *           type: string
 *           format: uuid
 *     PayoutAccount:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         bankName:
 *           type: string
 *         accountNumber:
 *           type: string
 *         isDefault:
 *           type: boolean
 *     Contribution:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         groupId:
 *           type: string
 *         amount:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending, paid]
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/groups/create:
 *   post:
 *     summary: Create a new group
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
 *               contributionAmount:
 *                 type: number
 *               contributionFrequency:
 *                 type: string
 *                 example: weekly
 *               payoutFrequency:
 *                 type: string
 *                 example: monthly
 *               totalMembers:
 *                 type: integer
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/groups/all:
 *   get:
 *     summary: Get all groups for the authenticated user
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
 * /api/groups/{id}:
 *   get:
 *     summary: Get details of a specific group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Group ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/groups/{id}/invite:
 *   get:
 *     summary: Generate an invite link for the group (Admin only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Group ID
 *         required: true
 *         schema:
 *           type: string
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
 * /api/groups/{id}/join:
 *   post:
 *     summary: Request to join a group using an invite link
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Group ID
 *         required: true
 *         schema:
 *           type: string
 *       - name: invite
 *         in: query
 *         description: Invite code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Join request sent
 *       400:
 *         description: Invalid or expired invite link
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /api/groups/payout-account:
 *   post:
 *     summary: Add a new payout account for the user
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
 *               accountNumber:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Payout account added successfully
 *       400:
 *         description: Missing bank details
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/groups/{groupId}/join-request/{memberId}:
 *   post:
 *     summary: Approve or reject a group join request (Admin only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: memberId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *     responses:
 *       200:
 *         description: Join request handled successfully
 *       403:
 *         description: Only admin can manage join requests
 *       404:
 *         description: Group or request not found
 */

/**
 * @swagger
 * /api/groups/{id}/summary:
 *   get:
 *     summary: Get group financial summary
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Group ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group summary retrieved successfully
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /api/groups/{id}/start-cycle:
 *   post:
 *     summary: Start a new contribution cycle (Admin only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cycle started successfully
 *       400:
 *         description: A cycle is already active or not enough members
 *       403:
 *         description: Only admin can start a cycle
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /api/groups/{id}/contribute:
 *   post:
 *     summary: Make a contribution in the active cycle
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Contribution successful
 *       400:
 *         description: Already contributed or invalid amount
 *       403:
 *         description: User not a member
 *       404:
 *         description: Group not found
 */

/**
 * @swagger
 * /api/groups/{id}/end-cycle:
 *   post:
 *     summary: End an active cycle (Admin only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cycle ended successfully
 *       400:
 *         description: No active cycle found
 *       403:
 *         description: Only admin can end cycle
 *       404:
 *         description: Group not found
 */





