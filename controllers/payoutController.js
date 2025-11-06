const { Group, Payout, Contribution, Membership, Cycle, User, PayoutAccount } = require('../models');
const korapayService = require('../services/korapayService');
const { v4: uuidv4 } = require('uuid');

// Manual payout creation (for admin override)
exports.createPayout = async (req, res) => {
  try {
    const { groupId, cycleId, userId } = req.body;
    const adminUserId = req.user.id;

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.adminId !== adminUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only group admins can trigger payouts'
      });
    }

    const membership = await Membership.findOne({ 
      where: { userId, groupId },
      include: [{ model: PayoutAccount, as: 'payoutAccount' }]
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found for this user in the specified group'
      });
    }

    if (!membership.payoutAccount) {
      return res.status(400).json({
        success: false,
        message: 'User has not set up a payout account'
      });
    }

    // Get contributions for this user in this cycle
    const contributions = await Contribution.findAll({ 
      where: { userId, groupId, cycleId, status: 'paid' } 
    });

    if (!contributions || contributions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No paid contributions found for this member in the specified cycle'
      });
    }

    if (membership.hasReceivedPayout) {
      return res.status(400).json({
        success: false,
        message: 'Payout has already been made to this member for the current cycle'
      });
    }

    const totalAmount = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const commissionRate = parseFloat(group.commissionRate) || 2;
    const commissionFee = (commissionRate / 100) * totalAmount;
    const totalPenalties = contributions.reduce((sum, c) => sum + parseFloat(c.penaltyFee || 0), 0);
    const finalAmount = totalAmount - commissionFee - totalPenalties;

    const payout = await Payout.create({
      groupId,
      userId,
      cycleId,
      amount: totalAmount.toFixed(2),
      commissionFee: commissionFee.toFixed(2),
      penaltyFee: totalPenalties.toFixed(2),
      status: 'pending',
      payoutDate: new Date()
    });

    // Mark membership as received
    membership.hasReceivedPayout = true;
    await membership.save();

    // Mark contributions as completed
    await Contribution.update(
      { status: 'completed' },
      { where: { userId, groupId, cycleId, status: 'paid' } }
    );

    res.status(201).json({
      success: true,
      message: 'Payout created successfully',
      data: {
        payout: {
          ...payout.dataValues,
          finalAmount: finalAmount.toFixed(2)
        },
        payoutAccount: membership.payoutAccount
      }
    });

  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error', 
      error: error.message
    });
  }
};

// Get all payouts for a group
exports.getGroupPayouts = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is admin or member
    const membership = await Membership.findOne({
      where: { userId, groupId }
    });

    if (!membership && group.adminId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const payouts = await Payout.findAll({
      where: { groupId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Cycle,
          as: 'cycle',
          attributes: ['id', 'currentRound', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const summary = {
      totalPayouts: payouts.length,
      totalAmount: payouts.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalCommissions: payouts.reduce((sum, p) => sum + parseFloat(p.commissionFee), 0),
      pending: payouts.filter(p => p.status === 'pending').length,
      completed: payouts.filter(p => p.status === 'completed').length,
      failed: payouts.filter(p => p.status === 'failed').length
    };

    res.status(200).json({
      success: true,
      data: {
        payouts,
        summary
      }
    });

  } catch (error) {
    console.error('Get group payouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get user's payout history
exports.getUserPayouts = async (req, res) => {
  try {
    const userId = req.user.id;

    const payouts = await Payout.findAll({
      where: { userId },
      include: [
        {
          model: Group,
          as: 'group',
          attributes: ['id', 'groupName', 'contributionAmount']
        },
        {
          model: Cycle,
          as: 'cycle',
          attributes: ['id', 'currentRound', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const summary = {
      totalReceived: payouts.filter(p => p.status === 'completed').length,
      totalAmount: payouts
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0),
      pending: payouts.filter(p => p.status === 'pending').length
    };

    res.status(200).json({
      success: true,
      data: {
        payouts,
        summary
      }
    });

  } catch (error) {
    console.error('Get user payouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Process payout (admin approves and triggers actual transfer)
exports.processPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const userId = req.user.id;

    const payout = await Payout.findByPk(payoutId, {
      include: [
        { 
          model: Group, 
          as: 'group' 
        },
        { 
          model: User, 
          as: 'user',
          include: [{
            model: Membership,
            as: 'memberships',
            where: { groupId: sequelize.col('Payout.groupId') },
            include: [{ model: PayoutAccount, as: 'payoutAccount' }]
          }]
        }
      ]
    });

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found'
      });
    }

    // Only admin can process
    if (payout.group.adminId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can process payouts'
      });
    }

    if (payout.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Payout is already ${payout.status}`
      });
    }

    const payoutAccount = payout.user.memberships[0]?.payoutAccount;
    if (!payoutAccount) {
      return res.status(400).json({
        success: false,
        message: 'Recipient has no payout account configured'
      });
    }

    // Calculate final amount
    const finalAmount = parseFloat(payout.amount) - 
                       parseFloat(payout.commissionFee) - 
                       parseFloat(payout.penaltyFee);

    // Initiate Korapay transfer (if configured)
    if (process.env.KORAPAY_SECRET_KEY) {
      const transferData = {
        reference: `PAYOUT-${uuidv4()}`,
        amount: finalAmount,
        narration: `Payout for ${payout.group.groupName}`,
        bankCode: payoutAccount.bankName, // You'll need bank codes mapping
        accountNumber: payoutAccount.accountNumber,
        customerName: payout.user.name,
        customerEmail: payout.user.email
      };

      const result = await korapayService.initiatePayout(transferData);

      if (result.success) {
        await payout.update({ status: 'completed' });
        
        return res.status(200).json({
          success: true,
          message: 'Payout processed successfully',
          data: { payout, transfer: result.data }
        });
      } else {
        await payout.update({ status: 'failed' });
        
        return res.status(400).json({
          success: false,
          message: 'Payout transfer failed',
          error: result.error
        });
      }
    } else {
      // Manual approval (no Korapay)
      await payout.update({ status: 'completed' });
      
      return res.status(200).json({
        success: true,
        message: 'Payout marked as completed (manual)',
        data: { payout }
      });
    }

  } catch (error) {
    console.error('Process payout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  createPayout: exports.createPayout,
  getGroupPayouts: exports.getGroupPayouts,
  getUserPayouts: exports.getUserPayouts,
  processPayout: exports.processPayout
};