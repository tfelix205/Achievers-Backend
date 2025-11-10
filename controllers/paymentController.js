const { v4: uuidv4 } = require('uuid');
const korapayService = require('../services/korapayService');
const { User, Group, Contribution, Cycle, sequelize } = require('../models');

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
    const { reference } = req.query;
    const userId = req.user.id;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    // Check if already processed
    const existingContribution = await Contribution.findOne({
      where: { paymentReference: reference },
      transaction: t
    });

    if (existingContribution) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'This payment has already been processed',
        data: existingContribution
      });
    }

    // Verify with Korapay
    const result = await korapayService.verifyPayment(reference);

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

      // Security: Verify user matches
      if (metaUserId !== userId) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: User mismatch'
        });
      }

      // Create contribution with payment reference
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

      // Check if all members contributed
      const { Op } = require('sequelize');
      const roundStartTime = new Date();
      roundStartTime.setHours(0, 0, 0, 0);

      const totalContributions = await Contribution.count({ 
        where: { 
          cycleId: cycleId,
          status: ['paid', 'completed'],
          createdAt: { [Op.gte]: roundStartTime }
        } 
      });
      
      const { Membership } = require('../models');
      const activeMembers = await Membership.count({ 
        where: { groupId: groupId, status: 'active' } 
      });

      // Trigger payout if all contributed
      if (totalContributions >= activeMembers) {
        try {
          const { handlePayoutAndRotate } = require('./groupController');
          await handlePayoutAndRotate(cycleId, groupId);
        } catch (error) {
          console.error('Payout rotation error:', error);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified and contribution recorded',
        data: {
          contribution,
          cycleProgress: {
            contributed: totalContributions,
            total: activeMembers,
            remaining: activeMembers - totalContributions
          }
        }
      });

    } else if (payment.status === 'failed') {
      //  Record failed payment
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