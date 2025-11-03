const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { makeContribution, getContributionHistory } = require('../controllers/contributionController');


// contribute to a group
router.post('/contribution', authenticate, makeContribution);

// Get contribution history 
router.get('/history/:groupId', authenticate, getContributionHistory);


module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Contribution
 *   description: Endpoints related to user contributions within groups
 */

/**
 * @swagger
 * /api/contributions/contribution:
 *   post:
 *     summary: Make a contribution
 *     description: >
 *       Records a user's contribution for the active cycle of a group.  
 *       Validates membership, payment details, and ensures that duplicate or invalid contributions are prevented.  
 *       If all group members contribute successfully, the system triggers a payout rotation.
 *     tags: [Contribution]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - amount
 *             properties:
 *               id:
 *                 type: integer
 *                 description: Group ID where the contribution is being made.
 *                 example: 12
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: Amount contributed by the user.
 *                 example: 5000
 *               paymentReference:
 *                 type: string
 *                 description: Optional unique payment reference to prevent duplicates.
 *                 example: KORA1234XYZ
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method used.
 *                 enum: [manual, korapay, wallet]
 *                 example: manual
 *               paymentMetadata:
 *                 type: object
 *                 description: Optional additional metadata for payment gateways.
 *     responses:
 *       200:
 *         description: Contribution recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Contribution recorded successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     contribution:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 101
 *                         amount:
 *                           type: number
 *                           example: 5000
 *                         status:
 *                           type: string
 *                           example: paid
 *                         penaltyFee:
 *                           type: number
 *                           example: 0
 *                         paymentReference:
 *                           type: string
 *                           example: KORA1234XYZ
 *                         paymentMethod:
 *                           type: string
 *                           example: manual
 *                         contributionDate:
 *                           type: string
 *                           format: date-time
 *                           example: 2025-11-02T09:15:00.000Z
 *                     cycleProgress:
 *                       type: object
 *                       properties:
 *                         contributed:
 *                           type: integer
 *                           example: 5
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         remaining:
 *                           type: integer
 *                           example: 5
 *                         percentage:
 *                           type: string
 *                           example: "50.00%"
 *       400:
 *         description: Invalid or duplicate contribution data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You have already contributed for this round.
 *       403:
 *         description: User is not a member of the group
 *       404:
 *         description: Group not found or no active cycle
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/contributions/history/{groupId}:
 *   get:
 *     summary: Get contribution history
 *     description: >
 *       Retrieves all past contributions made by the authenticated user for a specific group,  
 *       along with a summary including total amounts, penalties, and payment method breakdown.
 *     tags: [Contribution]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         description: ID of the group whose contribution history is being retrieved.
 *         schema:
 *           type: integer
 *           example: 12
 *     responses:
 *       200:
 *         description: Contribution history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     contributions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 101
 *                           amount:
 *                             type: number
 *                             example: 5000
 *                           status:
 *                             type: string
 *                             example: paid
 *                           paymentMethod:
 *                             type: string
 *                             example: korapay
 *                           penaltyFee:
 *                             type: number
 *                             example: 0
 *                           contributionDate:
 *                             type: string
 *                             format: date-time
 *                             example: 2025-11-01T08:30:00.000Z
 *                           cycle:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 3
 *                               currentRound:
 *                                 type: integer
 *                                 example: 2
 *                               status:
 *                                 type: string
 *                                 example: active
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalContributions:
 *                           type: integer
 *                           example: 15
 *                         totalAmount:
 *                           type: number
 *                           example: 75000
 *                         totalPenalties:
 *                           type: number
 *                           example: 2000
 *                         paymentMethods:
 *                           type: object
 *                           properties:
 *                             korapay:
 *                               type: integer
 *                               example: 8
 *                             manual:
 *                               type: integer
 *                               example: 5
 *                             wallet:
 *                               type: integer
 *                               example: 2
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: No contributions found for this group
 *       500:
 *         description: Internal server error
 */

