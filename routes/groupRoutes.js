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
  endCycle,
  getPayoutOrder,
  setPayoutOrder,
  randomizePayoutOrder
} = require('../controllers/groupController');


router.post('/create', authenticate, groupRegisterValidator, createGroup);
router.get('/all', authenticate, getUserGroups);
router.get('/:id', authenticate, getGroupDetails);
router.get('/:id/invite', authenticate, generateInviteLink);
router.post('/:id/:invite', authenticate, joinGroup);
router.get('/:id/summary', authenticate, getGroupSummary);


router.post('/payout-account', authenticate, addPayoutAccount);
// router.post('/:groupId/attach-payout', authenticate, attachPayoutToGroup);
router.post('/:groupId/join-request/:memberId', authenticate, manageJoinRequest);
router.get('/:id/payout-order', authenticate, getPayoutOrder);
router.put('/:id/payout-order', authenticate, setPayoutOrder);
router.post('/:id/randomize-payout-order', authenticate, randomizePayoutOrder);
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
 *   post:
 *     summary: Generate an invite link for a group
 *     description: Only the group admin can generate an invite link. The link allows other users to request to join the group.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the group.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully generated invite link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inviteLink:
 *                   type: string
 *                   example: https://yourfrontend.com/join_group/1234/ABCD12
 *       403:
 *         description: Only the group admin can generate invite links.
 *       404:
 *         description: Group not found.
 *       500:
 *         description: Server error.
 */



/**
 * @swagger
 * /api/groups/join/{id}/{invite}:
 *   post:
 *     summary: Join a group using an invite link
 *     description: Allows an authenticated user to request to join a group using a valid invite code.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the group.
 *         schema:
 *           type: string
 *       - in: path
 *         name: invite
 *         required: true
 *         description: The unique invite code associated with the group.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Join request sent successfully. Waiting for admin approval.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Join request sent successfully. Waiting for admin approval.
 *                 group:
 *                   type: object
 *                   properties:
 *                     groupName:
 *                       type: string
 *                       example: Achievers Group
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                     contributionAmount:
 *                       type: number
 *                       example: 10000
 *                     totalMembers:
 *                       type: integer
 *                       example: 10
 *                     availableSpots:
 *                       type: integer
 *                       example: 3
 *       400:
 *         description: Invalid or expired invite link, or missing payout account.
 *       404:
 *         description: Group or user not found.
 *       500:
 *         description: Server error.
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
 * /api/groups/{id}/payout-order:
 *   get:
 *     summary: Get payout order for a group
 *     description: >
 *       Retrieves the payout order for all active members in a group.  
 *       Accessible by group members or the admin.  
 *       Returns the payout schedule, including each member's position, payout status, and whether they're the current recipient.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The unique ID of the group.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payout order retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payout order retrieved successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     groupId:
 *                       type: string
 *                     groupName:
 *                       type: string
 *                     totalMembers:
 *                       type: integer
 *                     currentCycle:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         currentRound:
 *                           type: integer
 *                         activeMemberId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: active
 *                     payoutSchedule:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           position:
 *                             type: integer
 *                           userId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           hasReceivedPayout:
 *                             type: boolean
 *                           isCurrentRecipient:
 *                             type: boolean
 *                           joinedAt:
 *                             type: string
 *                             format: date-time
 *       403:
 *         description: Access denied – user is not a member or admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied."
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/groups/{id}/payout-order:
 *   put:
 *     summary: Set or update payout order for a group (Admin only)
 *     description: >
 *       Allows the group admin to define or modify the payout order for all active members.  
 *       This operation can only be done **before a cycle has started**.  
 *       All active members must be included in the request body.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The unique ID of the group.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payoutOrder:
 *                 type: array
 *                 description: Array of user payout positions.
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     position:
 *                       type: integer
 *                 example:
 *                   - userId: "a1b2c3d4"
 *                     position: 1
 *                   - userId: "b2c3d4e5"
 *                     position: 2
 *     responses:
 *       200:
 *         description: Payout order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payout order updated successfully."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       position:
 *                         type: integer
 *       400:
 *         description: Invalid request (e.g. missing members, invalid array, or cycle started)
 *       403:
 *         description: Only admin can set payout order
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/groups/{id}/randomize-payout-order:
 *   post:
 *     summary: Randomize payout order for a group (Admin only)
 *     description: >
 *       Randomly assigns payout order positions to all active members in a group using a shuffle algorithm.  
 *       Can only be used **before** the cycle starts.  
 *       Admin-only action.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The unique ID of the group.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payout order randomized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payout order randomized successfully."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       position:
 *                         type: integer
 *       400:
 *         description: Cannot randomize after cycle has started
 *       403:
 *         description: Only admin can randomize payout order
 *       404:
 *         description: Group not found
 *       500:
 *         description: Server error
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
 *     summary: End an active cycle for a group (Admin only)
 *     description: >
 *       Allows the group admin to end an active savings or contribution cycle.
 *       If the cycle is incomplete (not all rounds or contributions are finished),
 *       the admin can use the `forceEnd` flag to override the checks and close the cycle anyway.
 *       <br><br>
 *       Sends email notifications to all active group members upon successful completion.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The unique ID of the group whose cycle is being ended.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               forceEnd:
 *                 type: boolean
 *                 default: false
 *                 description: >
 *                   Set to `true` to forcefully end the cycle even if some contributions or payout rounds are pending.
 *     responses:
 *       200:
 *         description: Cycle ended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cycle ended successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     cycle:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         groupId:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: completed
 *                         currentRound:
 *                           type: integer
 *                         totalRounds:
 *                           type: integer
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                         duration:
 *                           type: string
 *                           example: "14 days"
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalContributions:
 *                           type: integer
 *                         totalPayouts:
 *                           type: integer
 *                         activeMembersCount:
 *                           type: integer
 *                         pendingContributions:
 *                           type: integer
 *                         completionRate:
 *                           type: string
 *                           example: "85.71%"
 *                     emailsSent:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Bad request (e.g. no active cycle, pending contributions, or incomplete rounds)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 warning:
 *                   type: object
 *                   properties:
 *                     currentRound:
 *                       type: integer
 *                     totalMembers:
 *                       type: integer
 *                     remainingRounds:
 *                       type: integer
 *                     suggestion:
 *                       type: string
 *       403:
 *         description: Forbidden – only the group admin can end the cycle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Only admin can end cycle."
 *       404:
 *         description: Group not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Group not found."
 *       500:
 *         description: Server error during cycle termination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error"
 *                 error:
 *                   type: string
 */
