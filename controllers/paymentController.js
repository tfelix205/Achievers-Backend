const { v4: uuidv4 } = require('uuid');
const korapayService = require('../services/korapayService');
const { User, Group, Contribution, Cycle, sequelize, Membership } = require('../models');
const { Op } = require('sequelize');



exports.initializeContribution = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.body;

    const user = await User.findByPk(userId);
    const group = await Group.findByPk(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const cycle = await Cycle.findOne({
      where: { groupId, status: 'active' }
    });

    if (!cycle) {
      return res.status(400).json({ message: 'No active cycle' });
    }

    //  Generate unique reference
    const reference = `Splita-${uuidv4()}`;
    const amount = parseFloat(group.contributionAmount);

    const paymentData = {
      amount: amount,
      customerName: user.name,
      customerEmail: user.email,
      redirectUrl: `${process.env.FRONTEND_URL}#/contribution/verify/`,
      reference: reference,
      metadata: {
        userId: userId,
        groupId: groupId,
        cycleId: cycle.id,
        type: 'contribution'
      }
    };

    const result = await korapayService.initializePayment(paymentData);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Payment initialized',
        data: {
          authorizationUrl: result.data.data.checkout_url,
          reference: reference,
          amount: amount
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment initialization failed',
        error: result.error
      });
    }

  } catch (error) {
    console.error('Initialize contribution error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

exports.verifyContribution = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    console.log(` Verifying payment for reference: ${reference} by user ${userId}`);

    //  Check if already processed
    const existingContribution = await Contribution.findOne({
      where: { paymentReference: reference },
      transaction: t
    });

    if (existingContribution) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'This payment has already been processed',
        data: {
          contributionId: existingContribution.id,
          amount: existingContribution.amount,
          status: existingContribution.status,
          date: existingContribution.createdAt
        }
      });
    }

    // Retry verification once if AA026 occurs
    let result = await korapayService.verifyPayment(reference);

    if (!result.success && result.error?.code === 'AA026') {
      console.warn(`⚠️ Charge not found (AA026), retrying verification after 2 seconds...`);
      await new Promise(r => setTimeout(r, 2000));
      result = await korapayService.verifyPayment(reference);
    }

    if (!result.success) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: result.error
      });
    }

    const payment = result.data.data;

    if (payment.status === 'success') {
      const { userId: metaUserId, groupId, cycleId } = payment.metadata;

      if (metaUserId !== userId) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: User mismatch'
        });
      }

      const cycle = await Cycle.findOne({
        where: { id: cycleId, groupId, status: 'active' },
        transaction: t
      });

      if (!cycle) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'No active cycle found for this group'
        });
      }

      const currentRoundStart = cycle.currentRoundStartDate || cycle.startDate;
      
      const existingRoundContribution = await Contribution.findOne({
        where: {
          userId: metaUserId,
          cycleId: cycleId,
          status: { [Op.in]: ['paid', 'completed'] },
          createdAt: { [Op.gte]: currentRoundStart }
        },
        transaction: t
      });

      if (existingRoundContribution) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `You already contributed ₦${existingRoundContribution.amount.toLocaleString()} for round ${cycle.currentRound}`,
          existingContribution: {
            id: existingRoundContribution.id,
            amount: existingRoundContribution.amount,
            date: existingRoundContribution.createdAt,
            status: existingRoundContribution.status
          }
        });
      }

      //  Record contribution
      const contribution = await Contribution.create({
        userId: metaUserId,
        groupId: groupId,
        cycleId: cycleId,
        amount: payment.amount,
        status: 'paid',
        contributionDate: new Date(),
        paymentReference: reference, 
        paymentMethod: 'korapay', 
        paymentMetadata: { 
          transactionId: payment.transaction_id,
          channel: payment.channel,
          paidAt: payment.paid_at
        }
      }, { transaction: t });

      await t.commit();

      console.log(` Contribution recorded for user ${userId}: ₦${payment.amount}`);

      // You can trigger payout here if needed (rotation logic)
      
      return res.status(200).json({
        success: true,
        message: 'Payment verified and contribution recorded',
        data: { contributionId: contribution.id, amount: contribution.amount }
      });

    } else if (payment.status === 'failed') {
      // Record failed payment
      await Contribution.create({
        userId: userId,
        groupId: payment.metadata.groupId,
        cycleId: payment.metadata.cycleId,
        amount: payment.amount,
        status: 'failed',
        paymentReference: reference,
        paymentMethod: 'korapay',
        paymentMetadata: { error: payment.failure_reason }
      }, { transaction: t });

      await t.commit();

      return res.status(400).json({
        success: false,
        message: 'Payment failed',
        reason: payment.failure_reason
      });

    } else {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment status unknown',
        status: payment.status
      });
    }

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Verify contribution error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};
