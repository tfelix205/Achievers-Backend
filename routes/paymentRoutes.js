const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Initialize Korapay payment
router.post('/initialize-contribution', authenticate, paymentController.initializeContribution);

// Verify Korapay payment
router.get('/verify-contribution/:reference', authenticate, paymentController.verifyContribution);

module.exports = router;





/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: Endpoints for managing contributions via Korapay
 */

/**
 * @swagger
 * /api/payments/initialize-contribution:
 *   post:
 *     summary: Initialize a contribution payment
 *     description: Generates a unique payment reference and returns a Korapay authorization URL for the user to complete payment.
 *     tags: [Payment]
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
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: ID of the group the user wants to contribute to
 *     responses:
 *       200:
 *         description: Payment initialized successfully
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
 *                     authorizationUrl:
 *                       type: string
 *                       description: Korapay checkout URL
 *                     reference:
 *                       type: string
 *                       description: Unique payment reference
 *                     amount:
 *                       type: number
 *                       description: Contribution amount
 *       400:
 *         description: Payment initialization failed or invalid request
 *       404:
 *         description: Group not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/payments/verify-contribution/{reference}:
 *   get:
 *     summary: Verify a contribution payment
 *     description: Verifies the status of a Korapay payment reference and records the contribution if successful.
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: params
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference generated during initialization
 *     responses:
 *       200:
 *         description: Payment verified and contribution recorded successfully
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
 *                     contribution:
 *                       type: object
 *                       description: Contribution record
 *                     cycleProgress:
 *                       type: object
 *                       properties:
 *                         contributed:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         remaining:
 *                           type: integer
 *       400:
 *         description: Payment verification failed or payment failed
 *       403:
 *         description: Unauthorized, user mismatch
 *       500:
 *         description: Internal server error
 */
