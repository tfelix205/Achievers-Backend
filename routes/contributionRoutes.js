const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { makeContribution } = require('../controllers/contributionController');

router.post('/contribution', authenticate, makeContribution);

module.exports = router;


/**
 * @swagger
 * tags:
 *   name: Contributions
 *   description: Manage contributions for group cycles
 */

/**
 * @swagger
 * /contribution:
 *   post:
 *     summary: Make a contribution to a group cycle
 *     tags: [Contributions]
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
 *               - amount
 *             properties:
 *               groupId:
 *                 type: string
 *                 example: "1"
 *                 description: ID of the group
 *               cycleId:
 *                 type: string
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: ID of the contribution cycle
 *               amount:
 *                 type: number
 *                 example: 10000
 *                 description: Contribution amount (must match group's set amount)
 *     responses:
 *       201:
 *         description: Contribution made successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contribution made successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     groupId:
 *                       type: string
 *                       example: "1"
 *                     memberId:
 *                       type: string
 *                       example: "2"
 *                     amount:
 *                       type: number
 *                       example: 10000
 *                     cycleId:
 *                       type: string
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     paymentDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-29T12:34:56.789Z"
 *                     status:
 *                       type: string
 *                       example: "paid"
 *       400:
 *         description: Contribution amount mismatch or already paid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Contribution amount must be exactly 10000"
 *       403:
 *         description: User is not a member of the group
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "You are not a member of this group"
 *       404:
 *         description: Group not found
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
