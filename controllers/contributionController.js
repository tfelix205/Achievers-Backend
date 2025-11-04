const { sequelize, Group, Cycle, Membership, Contribution } = require('../models');

exports.makeContribution = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { id } = req.params; 
    const { amount, paymentReference, paymentMethod = 'manual' } = req.body;

    // Get group
    const group = await Group.findByPk(id, { transaction: t });
    if (!group) {
      await t.rollback();
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Get active cycle
    const cycle = await Cycle.findOne({ 
      where: { groupId: id, status: 'active' },
      transaction: t 
    });
    
    if (!cycle) {
      await t.rollback();
      return res.status(400).json({ message: 'No active cycle for this group.' });
    }

    // Verify membership
    const membership = await Membership.findOne({
      where: { userId, groupId: id, status: 'active' },
      transaction: t
    });
    
    if (!membership) {
      await t.rollback();
      return res.status(403).json({ message: 'You are not a member of this group.' });
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
          message: 'This payment has already been processed.' 
        });
      }
    }

    // Check if already contributed this round
    const roundStartTime = new Date();
    roundStartTime.setHours(0, 0, 0, 0); 

    const existing = await Contribution.findOne({ 
      where: { 
        userId, 
        cycleId: cycle.id,
        status: ['paid', 'completed'],
        createdAt: {
          [require('sequelize').Op.gte]: roundStartTime
        }
      },
      transaction: t 
    });
    
    if (existing) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'You have already contributed for this round.' 
      });
    }

    // Validate amount
    const expectedAmount = parseFloat(group.contributionAmount);
    const paidAmount = parseFloat(amount);

    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      await t.rollback();
      return res.status(400).json({
        message: `Contribution amount must be ₦${expectedAmount.toLocaleString()}. You sent ₦${paidAmount.toLocaleString()}`,
      });
    }

    const penalty = paidAmount < expectedAmount ? group.penaltyFee : 0;

    //  Record contribution with payment details
    const contribution = await Contribution.create({
      userId,
      groupId: id,
      cycleId: cycle.id,
      amount: paidAmount,
      status: 'paid',
      penaltyFee: penalty,
      contributionDate: new Date(),
      paymentReference: paymentReference || null,
      paymentMethod: paymentMethod, 
      paymentMetadata: req.body.paymentMetadata || null
    }, { transaction: t });

    await t.commit();

    // Check if all members have contributed
    const totalContributions = await Contribution.count({ 
      where: { 
        cycleId: cycle.id,
        status: ['paid', 'completed'],
        createdAt: {
          [require('sequelize').Op.gte]: roundStartTime
        }
      } 
    });
    
    const activeMembers = await Membership.count({ 
      where: { groupId: id, status: 'active' } 
    });

    // Trigger payout rotation if all contributed
    if (totalContributions >= activeMembers) {
      try {
        const { handlePayoutAndRotate } = require('./groupController');
        await handlePayoutAndRotate(cycle.id, group.id);
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
      message: 'Server error', 
      error: error.message 
    });
  }
};

//  get contribution history
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
      message: 'Server error', 
      error: error.message 
    });
  }
};