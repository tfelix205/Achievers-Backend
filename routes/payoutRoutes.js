const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { createPayout, getGroupPayouts, getUserPayouts, processPayout } = require('../controllers/payoutController');

// create manual payout if the admin wants to override automatic payout
router.post('/create', authenticate, createPayout);

// get all payouts for a group
router.get('/goup/:groupId', authenticate, getGroupPayouts);

//get user payouts history
router.get('/my-payouts', authenticate, getUserPayouts);

// process/approve payout (admin)
router.post('/process/:payoutId', authenticate, processPayout);

module.exports = router;


/**
 * @swagger
 * tags:
 *   name: Payouts
 *   description: Manage group member payouts, including manual admin payouts, payout history, and processing.
 */

/**
 * @swagger
 * /api/payouts/create:
 *   post:
 *     summary: Create a new payout for the current active cycle
 *     description: >
 *       Allows the group admin to trigger a payout for the current active member once all contributions are complete.  
 *       This endpoint automatically determines the payout recipient based on the active cycle and validates that all members have contributed.  
 *       Only the **group admin** can perform this action.
 *     tags:
 *       - Payouts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupId
 *               - cycleId
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: The unique ID of the group.
 *                 example: "grp_12345"
 *               cycleId:
 *                 type: string
 *                 description: The active cycle ID.
 *                 example: "cyc_56789"
 *     responses:
 *       201:
 *         description: Payout created successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Payout created successfully. Please process it to complete transfer."
 *               data:
 *                 payoutId: "pyt_abc123"
 *                 recipient:
 *                   name: "Jane Doe"
 *                   userId: "usr_987"
 *                 amount: "5000.00"
 *                 finalAmount: "4800.00"
 *                 status: "pending"
 *                 payoutAccount:
 *                   bankName: "First National Bank"
 *                   accountNumber: "****5678"
 *       400:
 *         description: Bad request — missing data or invalid conditions (e.g., incomplete contributions, existing payout, or missing payout account).
 *         content:
 *           application/json:
 *             examples:
 *               missingPayoutAccount:
 *                 summary: Missing payout account
 *                 value:
 *                   success: false
 *                   message: "Recipient has not set up a payout account"
 *               incompleteContributions:
 *                 summary: Not all members contributed
 *                 value:
 *                   success: false
 *                   message: "Cannot trigger payout. Only 4/5 members have contributed"
 *       403:
 *         description: Forbidden — user is not the group admin.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Only admin can trigger payouts"
 *       404:
 *         description: Group or cycle not found.
 *         content:
 *           application/json:
 *             examples:
 *               groupNotFound:
 *                 summary: Group not found
 *                 value:
 *                   success: false
 *                   message: "Group not found"
 *               cycleNotFound:
 *                 summary: Cycle not found
 *                 value:
 *                   success: false
 *                   message: "No active cycle found"
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Server error"
 *               error: "Error message here"
 */


/**
 * @swagger
 * /api/payouts/goup/{groupId}:
 *   get:
 *     summary: Get all payouts for a specific group
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the group to fetch payouts for
 *     responses:
 *       200:
 *         description: Successfully retrieved payouts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payouts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payout'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalPayouts:
 *                           type: number
 *                         totalAmount:
 *                           type: number
 *                         totalCommissions:
 *                           type: number
 *                         pending:
 *                           type: number
 *                         completed:
 *                           type: number
 *                         failed:
 *                           type: number
 *       403:
 *         description: User not authorized to view payouts
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/payouts/my-payouts:
 *   get:
 *     summary: Get payout history for the logged-in user
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user payouts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payouts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payout'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalReceived:
 *                           type: number
 *                         totalAmount:
 *                           type: number
 *                         pending:
 *                           type: number
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/payouts/process/{payoutId}:
 *   post:
 *     summary: Approve and process a payout (Admin Only)
 *     tags: [Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the payout to process
 *     responses:
 *       200:
 *         description: Payout processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     payout:
 *                       $ref: '#/components/schemas/Payout'
 *                     transfer:
 *                       type: object
 *                       description: Transfer data returned by Korapay
 *       400:
 *         description: Invalid payout state or transfer failure
 *       403:
 *         description: Only admin can approve payouts
 *       404:
 *         description: Payout not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Payout:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "payout-uuid"
 *         groupId:
 *           type: string
 *           example: "group-uuid"
 *         userId:
 *           type: string
 *           example: "user-uuid"
 *         cycleId:
 *           type: string
 *           example: "cycle-uuid"
 *         amount:
 *           type: number
 *           example: 10000
 *         commissionFee:
 *           type: number
 *           example: 200
 *         penaltyFee:
 *           type: number
 *           example: 50
 *         status:
 *           type: string
 *           enum: [pending, completed, failed]
 *           example: "pending"
 *         payoutDate:
 *           type: string
 *           format: date-time
 *           example: "2025-10-29T12:34:56.789Z"
 *
 *     PayoutAccount:
 *       type: object
 *       properties:
 *         bankName:
 *           type: string
 *           example: "Access Bank"
 *         accountNumber:
 *           type: string
 *           example: "0123456789"
 *         accountName:
 *           type: string
 *           example: "John Doe"
 */

