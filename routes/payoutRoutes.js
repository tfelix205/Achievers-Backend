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
 *     summary: Trigger a manual payout for a group member (Admin Only)
 *     tags: [Payouts]
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
 *               - userId
 *             properties:
 *               groupId:
 *                 type: string
 *                 example: "123e4567-e89b-12d3-a456-426614163890"
 *               cycleId:
 *                 type: string
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               userId:
 *                 type: string
 *                 example: "123e4567-e89b-12d3-a456-426614175643"
 *     responses:
 *       201:
 *         description: Payout created successfully
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
 *                     payoutAccount:
 *                       $ref: '#/components/schemas/PayoutAccount'
 *       400:
 *         description: Invalid request or payout already made
 *       403:
 *         description: Only admin can trigger payouts
 *       404:
 *         description: Group, membership, or contribution not found
 *       500:
 *         description: Internal server error
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

