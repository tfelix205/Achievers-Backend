const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { createPayout } = require('../controllers/payoutController');


router.post('/create', authenticate, createPayout);



module.exports = router;


/**
 * @swagger
 * tags:
 *   name: Payouts
 *   description: Manage payouts for group cycles
 */

/**
 * @swagger
 * /api/payouts/create:
 *   post:
 *     summary: Trigger a payout for a group member
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
 *                 example: "1"
 *                 description: ID of the group
 *               cycleId:
 *                 type: string
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: ID of the cycle
 *               userId:
 *                 type: string
 *                 example: "2"
 *                 description: ID of the member to receive the payout
 *     responses:
 *       201:
 *         description: Payout created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payout created successfully"
 *                 payout:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     groupId:
 *                       type: string
 *                       example: "1"
 *                     userId:
 *                       type: string
 *                       example: "2"
 *                     cycleId:
 *                       type: string
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     amount:
 *                       type: number
 *                       example: 10000
 *                     commissionFee:
 *                       type: number
 *                       example: 200
 *                     penaltyFee:
 *                       type: number
 *                       example: 50
 *                     finalAmount:
 *                       type: number
 *                       example: 9750
 *                     status:
 *                       type: string
 *                       example: "completed"
 *                     payoutDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-29T12:34:56.789Z"
 *       400:
 *         description: Payout already made or invalid operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payout has already been made to this member for the current cycle"
 *       403:
 *         description: Access denied (only admin can trigger payouts)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied: Only group admins can trigger payouts"
 *       404:
 *         description: Group, membership, or contribution not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Group not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 error:
 *                   type: string
 *                   example: "Database connection failed"
 */

