const { Group, Payout, Contribution, Membership, Cycle, User, PayoutAccount, sequelize } = require('../models'); 
const korapayService = require('../services/korapayService');
const { v4: uuidv4 } = require('uuid');

// Manual payout creation (for admin override)
exports.createPayout = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { groupId, cycleId } = req.body; // Remove userId - auto-detect from cycle
    const adminUserId = req.user.id;

    const group = await Group.findByPk(groupId, { transaction: t });
    if (!group) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.adminId !== adminUserId) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only admin can trigger payouts'
      });
    }

    // Get cycle and current recipient
    const cycle = await Cycle.findOne({
      where: { id: cycleId, groupId, status: 'active' },
      transaction: t
    });

    if (!cycle) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'No active cycle found'
      });
    }

    const userId = cycle.activeMemberId; // Auto-detect from cycle

    // Check if payout already exists
    const existingPayout = await Payout.findOne({
      where: {
        cycleId,
        userId,
        status: { [Op.in]: ['pending', 'completed'] }
      },
      transaction: t
    });

    if (existingPayout) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payout already created for this round',
        payoutId: existingPayout.id
      });
    }

    // Verify all contributions received
    const currentRoundStart = cycle.currentRoundStartDate || cycle.startDate;
    
    const contributions = await Contribution.findAll({
      where: {
        cycleId,
        status: { [Op.in]: ['paid', 'completed'] },
        createdAt: { [Op.gte]: currentRoundStart }
      },
      transaction: t
    });

    const activeMembers = await Membership.count({
      where: { groupId, status: 'active' },
      transaction: t
    });

    if (contributions.length < activeMembers) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot trigger payout. Only ${contributions.length}/${activeMembers} members have contributed`
      });
    }

    // Get recipient membership
    const membership = await Membership.findOne({
      where: { userId, groupId },
      include: [{ model: PayoutAccount, as: 'payoutAccount' }],
      transaction: t
    });

    if (!membership?.payoutAccount) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Recipient has not set up a payout account'
      });
    }

    if (membership.hasReceivedPayout) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Member has already received payout this cycle'
      });
    }

    // Calculate amounts
    const totalAmount = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const commissionRate = parseFloat(group.commissionRate) || 2;
    const commissionFee = (commissionRate / 100) * totalAmount;
    const totalPenalties = contributions.reduce((sum, c) => sum + parseFloat(c.penaltyFee || 0), 0);
    const finalAmount = totalAmount - commissionFee - totalPenalties;

    // Create payout
    const payout = await Payout.create({
      groupId,
      userId,
      cycleId,
      amount: totalAmount.toFixed(2),
      commissionFee: commissionFee.toFixed(2),
      penaltyFee: totalPenalties.toFixed(2),
      status: 'pending',
      payoutDate: new Date()
    }, { transaction: t });

    // Mark member as received
    await membership.update({ hasReceivedPayout: true }, { transaction: t });

    // Mark contributions as completed
    await Contribution.update(
      { status: 'completed' },
      { 
        where: { 
          cycleId, 
          createdAt: { [Op.gte]: currentRoundStart } 
        }, 
        transaction: t 
      }
    );

    await t.commit();

    res.status(201).json({
      success: true,
      message: 'Payout created successfully. Please process it to complete transfer.',
      data: {
        payoutId: payout.id,
        recipient: {
          name: membership.user?.name,
          userId: userId
        },
        amount: totalAmount.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
        status: payout.status,
        payoutAccount: {
          bankName: membership.payoutAccount.bankName,
          accountNumber: membership.payoutAccount.accountNumber
        }
      }
    });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Create payout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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

//  process  Payout function
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
            where: { groupId: sequelize.col('group.id') }, 
            include: [{ model: PayoutAccount, as: 'payoutAccount' }],
            required: false
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

    //Find payout account through membership
    const membership = payout.user.memberships?.find(m => m.groupId === payout.groupId);
    const payoutAccount = membership?.payoutAccount;
    
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
        reference: `Splitout-${uuidv4()}`,
        amount: finalAmount,
        narration: `Payout for ${payout.group.groupName}`,
        bankCode: payoutAccount.bankName,
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