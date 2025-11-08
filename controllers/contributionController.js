const { sequelize, Group, Cycle, Membership, Contribution, User } = require('../models');
const {Op} = require('sequelize')
const { sendMail } = require('../utils/sendgrid');
const { contributionReceivedMail } = require('../utils/contributionReceivedMail');

// Fixed makeContribution function in contributionController.js

exports.makeContribution = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { groupId } = req.body;
    const { amount, paymentReference, paymentMethod = 'manual', paymentMetadata } = req.body;

    // Validate required fields
    if (!groupId || !amount) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'Group ID and amount are required.' 
      });
    }

    // Get group
    const group = await Group.findByPk(groupId, { transaction: t });
    if (!group) {
      await t.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Group not found.' 
      });
    }

    // Get active cycle
    const cycle = await Cycle.findOne({ 
      where: { groupId, status: 'active' },
      transaction: t 
    });
    
    if (!cycle) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'No active cycle for this group.' 
      });
    }

    // Verify membership
    const membership = await Membership.findOne({
      where: { userId, groupId, status: 'active' },
      transaction: t
    });
    
    if (!membership) {
      await t.rollback();
      return res.status(403).json({ 
        success: false,
        message: 'You are not a member of this group.' 
      });
    }

    // Check if payment reference already used
    if (paymentReference) {
      const existingPayment = await Contribution.findOne({
        where: { paymentReference },
        transaction: t
      });
      
      if (existingPayment) {
        await t.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'This payment has already been processed.' 
        });
      }
    }

    // ✅ Fixed: Check if already contributed this ROUND
    const currentRoundStart = cycle.currentRoundStartDate || cycle.startDate;
    
    const existing = await Contribution.findOne({ 
      where: { 
        userId, 
        cycleId: cycle.id,
        status: { [Op.in]: ['paid', 'completed'] },
        createdAt: { [Op.gte]: currentRoundStart } // ✅ Check from round start
      },
      transaction: t 
    });
    
    if (existing) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'You have already contributed for this round.' 
      });
    }

    // Validate amount
    const expectedAmount = parseFloat(group.contributionAmount);
    const paidAmount = parseFloat(amount);

    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Contribution amount must be ₦${expectedAmount.toLocaleString()}. You sent ₦${paidAmount.toLocaleString()}`,
      });
    }

    const penalty = paidAmount < expectedAmount ? group.penaltyFee : 0;

    // Record contribution using findOrCreate for safety
    const [contribution, created] = await Contribution.findOrCreate({
      where: { 
        userId,
        cycleId: cycle.id,
        createdAt: { [Op.gte]: currentRoundStart } // ✅ Ensure unique per round
      },
      defaults: { 
        userId,
        groupId,
        cycleId: cycle.id,
        amount: paidAmount,
        status: 'paid',
        penaltyFee: penalty,
        contributionDate: new Date(),
        paymentReference: paymentReference || null,
        paymentMethod: paymentMethod, 
        paymentMetadata: paymentMetadata || null
      },
      transaction: t,
      lock: true 
    });

    if (!created) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'You have already contributed for this round'
      });
    }

    await t.commit();

    // Send contribution email
    try {
      
      const user = await User.findByPk(userId);
      if (user && user.email) {
        await sendMail({
          email: user.email,
          subject: 'Contribution Received',
          html: contributionReceivedMail(
            user.name, 
            group.groupName, 
            paidAmount, 
            new Date().toISOString().split('T')[0]
          ),
        });
      }
    } catch (emailError) {
      console.error('Email notification error:', emailError);
    }

    // ✅ Fixed: Check if all members contributed THIS ROUND
    const totalContributions = await Contribution.count({ 
      where: { 
        cycleId: cycle.id,
        status: { [Op.in]: ['paid', 'completed'] },
        createdAt: { [Op.gte]: currentRoundStart } // ✅ Count from round start
      } 
    });
    
    const activeMembers = await Membership.count({ 
      where: { groupId, status: 'active' } 
    });

    // Trigger payout rotation if all contributed
    if (totalContributions >= activeMembers) {
      try {
        const { handlePayoutAndRotate } = require('./groupController');
        await handlePayoutAndRotate(cycle.id, groupId);
      } catch (error) {
        console.error('Payout rotation error:', error);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Contribution recorded successfully.',
      data: {
        contribution: {
          id: contribution.id,
          amount: contribution.amount,
          status: contribution.status,
          penaltyFee: contribution.penaltyFee,
          paymentReference: contribution.paymentReference,
          paymentMethod: contribution.paymentMethod,
          contributionDate: contribution.contributionDate
        },
        cycleProgress: {
          contributed: totalContributions,
          total: activeMembers,
          remaining: activeMembers - totalContributions,
          percentage: ((totalContributions / activeMembers) * 100).toFixed(2) + '%'
        }
      }
    });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Make contribution error:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.getContributionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    const contributions = await Contribution.findAll({
      where: { userId, groupId },
      include: [
        {
          model: Cycle,
          as: 'cycle',
          attributes: ['id', 'currentRound', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const summary = {
      totalContributions: contributions.length,
      totalAmount: contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0),
      totalPenalties: contributions.reduce((sum, c) => sum + parseFloat(c.penaltyFee), 0),
      paymentMethods: {
        korapay: contributions.filter(c => c.paymentMethod === 'korapay').length,
        manual: contributions.filter(c => c.paymentMethod === 'manual').length,
        wallet: contributions.filter(c => c.paymentMethod === 'wallet').length
      }
    };

    res.status(200).json({
      success: true,
      data: {
        contributions,
        summary
      }
    });

  } catch (error) {
    console.error('Get contribution history error:', error);
    res.status(500).json({ 
      success: false,
      message:  error.message 
    });
  }
};