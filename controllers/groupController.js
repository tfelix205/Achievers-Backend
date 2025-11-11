const { Group, Membership, User, Contribution, PayoutAccount, Cycle, Payout, sequelize, Sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');
const {nameToTitleCase} = require('../helper/nameConverter');
const { sendMail } = require('../utils/sendgrid');
const { groupCreatedMail } = require('../utils/groupCreatedMail');
const { joinRequestMail } = require('../utils/joinRequestMail');
const { cycleStartedMail } = require('../utils/cycleStartedMail');
const { contributionReceivedMail } = require('../utils/contributionReceivedMail');
const { cycleCompletedMail } = require('../utils/cycleCompletedMail');
const { Op } = require('sequelize');

//  Create a new group
exports.createGroup = async (req, res) => {
  const t = await Group.sequelize.transaction();
  try {
    const userId = req.user.id;
    const {
      groupName,
      contributionAmount,
      contributionFrequency,
      payoutFrequency,
      description,
      totalMembers
    } = req.body;

    // Basic validation
    if (!groupName || !contributionAmount || !contributionFrequency) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const newPenaltyFee = contributionAmount * 0.05; // 5% penalty

    // Create group
    const group = await Group.create({
      groupName: nameToTitleCase(groupName.trim()),
      contributionAmount,
      contributionFrequency: contributionFrequency.trim().toLowerCase(),
      payoutFrequency: payoutFrequency.trim().toLowerCase(),
      penaltyFee: newPenaltyFee,
      description: nameToTitleCase(description.trim()),
      totalMembers,
      adminId: userId
    }, { transaction: t });

    // Add admin as first member
    await Membership.create({
      userId,
      groupId: group.id,
      status: 'active',
      role: 'admin'
    }, { transaction: t });

    await t.commit();

        // Send an email to the admin that the group has been created
 const user = await User.findByPk(userId);
 const dateString = new Date().toISOString().split('T')[0];

 if (user && user.email) {
 await sendMail({
 email: user.email,
subject: 'Group Created Successfully',
html: groupCreatedMail(
user.name,
group.groupName,
 group.contributionAmount,
 group.totalMembers,
 dateString
 ),
});
}

    // Check payout account
    const payoutAccount = await PayoutAccount.findOne({ where: { userId } });

    if (!payoutAccount) {
      return res.status(200).json({
        message: 'Group created but payout account is required.',
        groupId: group.id,
        requiresPayout: true
      });
    }

    res.status(201).json({
      message: 'Group created successfully.',
      group
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


//  Add payout account for user
exports.addPayoutAccount = async (req, res) => {
  const transaction = await PayoutAccount.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { bankName, accountNumber, isDefault } = req.body;

    if (!bankName || !accountNumber) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'Bank name and account number are required.' 
      });
    }

    const normalizedBankName = bankName.trim();
    const normalizedAccountNumber = accountNumber.trim();

    // Check if user exists
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'User not found.' 
      });
    }

    // Check for duplicate account
    const existingAccount = await PayoutAccount.findOne({
      where: { 
        userId, 
        accountNumber: normalizedAccountNumber 
      },
      transaction
    });

    if (existingAccount) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'This account number is already registered.' 
      });
    }

    //  If this is marked as default OR user has no payout accounts, make it default
    const existingPayouts = await PayoutAccount.count({ 
      where: { userId }, 
      transaction 
    });
    
    const shouldBeDefault = isDefault || existingPayouts === 0;

    // If setting as default, reset other accounts
    if (shouldBeDefault) {
      await PayoutAccount.update(
        { isDefault: false },
        { where: { userId }, transaction }
      );
    }

    // Create payout account WITHOUT requiring membershipId
    const payout = await PayoutAccount.create(
      {
        userId,
        membershipId: null, 
        bankName: normalizedBankName,
        accountNumber: normalizedAccountNumber,
        isDefault: shouldBeDefault,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Payout account added successfully.',
      data: {
        id: payout.id,
        bankName: payout.bankName,
        accountNumber: payout.accountNumber,
        isDefault: payout.isDefault,
        createdAt: payout.createdAt
      }
    });

  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Add payout account error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};



exports.getUserPayoutAccounts = async (req, res) => {
  try {
    const userId = req.user.id;

    const payoutAccounts = await PayoutAccount.findAll({
      where: { userId },
      order: [
        ['isDefault', 'DESC'], // Default account first
        ['createdAt', 'DESC']
      ]
    });

    res.status(200).json({
      success: true,
      count: payoutAccounts.length,
      data: payoutAccounts
    });

  } catch (error) {
    console.error('Get payout accounts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};




exports.updatePayoutAccount = async (req, res) => {
  const transaction = await PayoutAccount.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { payoutAccountId } = req.params;
    const { bankName, accountNumber, isDefault } = req.body;

    const payoutAccount = await PayoutAccount.findOne({
      where: { id: payoutAccountId, userId },
      transaction
    });

    if (!payoutAccount) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Payout account not found.' 
      });
    }

    // If setting as default, reset other accounts
    if (isDefault === true) {
      await PayoutAccount.update(
        { isDefault: false },
        { where: { userId, id: { [Op.ne]: payoutAccountId } }, transaction }
      );
    }

    // Update account
    const updateData = {};
    if (bankName) updateData.bankName = bankName.trim();
    if (accountNumber) updateData.accountNumber = accountNumber.trim();
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    await payoutAccount.update(updateData, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Payout account updated successfully.',
      data: payoutAccount
    });

  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Update payout account error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};


exports.deletePayoutAccount = async (req, res) => {
  const transaction = await PayoutAccount.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { payoutAccountId } = req.params;

    const payoutAccount = await PayoutAccount.findOne({
      where: { id: payoutAccountId, userId },
      transaction
    });

    if (!payoutAccount) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Payout account not found.' 
      });
    }

    // Check if account is linked to any active memberships
    const linkedMemberships = await Membership.count({
      where: { 
        payoutAccountId: payoutAccountId,
        status: 'active'
      },
      transaction
    });

    if (linkedMemberships > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        message: `Cannot delete account. It's linked to ${linkedMemberships} active group membership(s).` 
      });
    }

    await payoutAccount.destroy({ transaction });

    // If deleted account was default, make another one default
    if (payoutAccount.isDefault) {
      const otherAccount = await PayoutAccount.findOne({
        where: { userId },
        transaction
      });

      if (otherAccount) {
        await otherAccount.update({ isDefault: true }, { transaction });
      }
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Payout account deleted successfully.'
    });

  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Delete payout account error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};




 //Attach user’s payout to a group
exports.attachPayoutToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const payout = await PayoutAccount.findOne({
      where: { userId, isDefault: true }
    });

    if (!payout) {
      return res.status(400).json({ message: 'No default payout account found.' });
    }

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    // Add or update group payout info (assume Group has payoutAccountId)
    await group.update({ payoutAccountId: payout.id });

    res.status(200).json({ message: 'Payout account linked to group successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


//  Get all user’s groups
exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    

    const userMemberships = await Membership.findAll({
      where: { userId, status: 'active' },
      attributes: ['groupId']
    });

    const groupIds = userMemberships.map(m => m.groupId);

    if (groupIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const groups = await Group.findAll({
      where: { id: { [Op.in]: groupIds } },
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'name', 'email', 'profilePicture'],
          through: { 
            attributes: ['role', 'status', 'payoutOrder', 'hasReceivedPayout', 'createdAt'],
            where: { status: 'active' }
          }
        },
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'name', 'email', 'profilePicture']
        },
        {
          model: Cycle,
          as: 'cycles',
          attributes: ['id', 'currentRound', 'totalRounds', 'status', 'activeMemberId', 'startDate', 'endDate'],
          where: { status: 'active' },
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formattedGroups = groups.map(group => {
      const activeCycle = group.cycles?.[0] || null;
      const currentUserMembership = group.members.find(m => m.id === userId);

      return {
        id: group.id,
        groupName: group.groupName,
        description: group.description,
        contributionAmount: group.contributionAmount,
        contributionFrequency: group.contributionFrequency,
        payoutFrequency: group.payoutFrequency,
        penaltyFee: group.penaltyFee,
        totalMembers: group.totalMembers,
        currentMembersCount: group.members.length,
        status: group.status,
        commissionRate: group.commissionRate,
        inviteCode: group.inviteCode,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,

        admin: group.admin ? {
          id: group.admin.id,
          name: group.admin.name,
          email: group.admin.email,
          profilePicture: group.admin.profilePicture
        } : null,
        isAdmin: group.adminId === userId,

        myRole: currentUserMembership?.Membership?.role || null,
        myPayoutOrder: currentUserMembership?.Membership?.payoutOrder || null,
        hasReceivedPayout: currentUserMembership?.Membership?.hasReceivedPayout || false,
        joinedAt: currentUserMembership?.Membership?.createdAt || null,

        members: group.members
          .map(member => ({
            id: member.id,
            name: member.name,
            email: member.email,
            profilePicture: member.profilePicture,
            role: member.Membership.role,
            payoutOrder: member.Membership.payoutOrder,
            hasReceivedPayout: member.Membership.hasReceivedPayout,
            joinedAt: member.Membership.createdAt,
            isMe: member.id === userId,
            isCurrentRecipient: activeCycle ? member.id === activeCycle.activeMemberId : false
          }))
          .sort((a, b) => {
            if (a.payoutOrder === null && b.payoutOrder === null) {
              return new Date(a.joinedAt) - new Date(b.joinedAt);
            }
            if (a.payoutOrder === null) return 1;
            if (b.payoutOrder === null) return -1;
            return a.payoutOrder - b.payoutOrder;
          }),

        activeCycle: activeCycle ? {
          id: activeCycle.id,
          currentRound: activeCycle.currentRound,
          totalRounds: activeCycle.totalRounds,
          status: activeCycle.status,
          startDate: activeCycle.startDate,
          currentRecipient: {
            id: activeCycle.activeMemberId,
            name: group.members.find(m => m.id === activeCycle.activeMemberId)?.name || 'Unknown',
          },
          progress: activeCycle.totalRounds > 0 
            ? (((activeCycle.currentRound - 1) / activeCycle.totalRounds) * 100).toFixed(2)
            : "0.00"
        } : null,

        stats: {
          isComplete: group.members.length === group.totalMembers,
          spotsRemaining: Math.max(0, group.totalMembers - group.members.length),
          hasActiveCycle: !!activeCycle
        }
      };
    });

    res.status(200).json({ success: true, count: formattedGroups.length, data: formattedGroups });

  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};




//  Generate invite link (Admin only)
exports.generateInviteLink = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

   
    if (group.adminId !== userId) {
      return res.status(403).json({ message: 'Only the admin can generate invite links.' });
    }

    const inviteCode = uuidv4().split('-')[0].toUpperCase();
    const inviteLink = `${process.env.FRONTEND_URL}/#/join_group/${id}/${inviteCode}`;

    
    await group.update({ inviteCode });

    res.status(200).json({ inviteLink });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




//  Request to join group via invite link
exports.joinGroup = async (req, res) => {
  const transaction = await Group.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params; // group id
    const { invite } = req.params; // invite code

    const group = await Group.findByPk(id, { transaction });
    if (!group) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Group not found.'
      });
    }

    const validUser = await User.findByPk(userId, { transaction });
    if (!validUser) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'User not found. Please proceed to login.'
      });
    }

    // Verify invite code
    if (group.inviteCode !== invite) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invite link.'
      });
    }

    // Check if already a member
    const existing = await Membership.findOne({
      where: { userId, groupId: id },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'You have already requested to join or are a member of this group.'
      });
    }

    // Create pending membership (no payout required yet)
    const membership = await Membership.create({
      userId,
      groupId: id,
      role: 'member',
      status: 'pending'
    }, { transaction });

    await transaction.commit();

    // Send email to admin (notify of join request)
    try {
      const admin = await User.findByPk(group.adminId);
      const { sendMail } = require('../utils/sendgrid');
      const { joinRequestMail } = require('../utils/joinRequestMail');
      const dateString = new Date().toISOString().split('T')[0];

      if (admin && admin.email) {
        await sendMail({
          email: admin.email,
          subject: 'Request to Join Your Group',
          html: joinRequestMail(
            admin.name,
            validUser.name,
            group.groupName,
            dateString
          ),
        });
      }
    } catch (emailError) {
      console.error('Email notification error:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Join request sent successfully. Waiting for admin approval.',
      data: { membershipId: membership.id }
    });

  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Join group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


 
 // Get all pending join requests for a group
exports.getAllPendingRequest = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { groupId } = req.params; 

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found.' });


    if (group.adminId !== userId) {
      return res.status(403).json({ message: 'Only the admin can view pending requests.' });
    }

    const pendingRequests = await Membership.findAll({
      where: { groupId, status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone'],
        },
        {
          model: PayoutAccount,
          as: 'payoutAccount',
          attributes: ['id', 'bankName', 'accountNumber', 'isDefault'],
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (pendingRequests.length === 0) {
      return res.status(200).json({ message: 'No pending requests found.', requests: [] });
    }

    res.status(200).json({
      message: 'Pending requests retrieved successfully.',
      group: {
        id: group.id,
        name: group.groupName,
      },
      requests: pendingRequests,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



//  Approve or reject join request
exports.manageJoinRequest = async (req, res) => {
  const transaction = await Group.sequelize.transaction();

  try {
    const userId = req.user.id; 
    const { groupId, memberId } = req.params;
    const { action } = req.body; 

    const group = await Group.findByPk(groupId, { transaction });
    if (!group) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Group not found.'
      });
    }

    if (group.adminId !== userId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only the admin can manage join requests.'
      });
    }

    const membership = await Membership.findOne({
      where: { groupId, userId: memberId, status: 'pending' },
      transaction
    });

    if (!membership) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pending request not found.'
      });
    }

    if (action === 'approve') {
      // Check if the user now has a payout account
      const payout = await PayoutAccount.findOne({
        where: { userId: memberId, isDefault: true },
        transaction
      });

      if (!payout) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Cannot approve request. User must have a payout account set up.'
        });
      }

      // Check if group is full
      const activeMembersCount = await Membership.count({
        where: { groupId, status: 'active' },
        transaction
      });

      if (activeMembersCount >= group.totalMembers) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Cannot approve member. Group is already full.'
        });
      }

      // Link payout account and activate membership
      await membership.update(
        { status: 'active', payoutAccountId: payout.id },
        { transaction }
      );

      await payout.update({ membershipId: membership.id }, { transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: 'Member approved successfully.',
        data: {
          membershipId: membership.id,
          userId: memberId,
          payoutAccountId: payout.id,
          status: 'active'
        }
      });

    } else if (action === 'reject') {
      await membership.destroy({ transaction });
      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: 'Join request rejected successfully.'
      });

    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject".'
      });
    }

  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('Manage join request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// get all approved members
exports.getAllApprovedMembers = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { groupId } = req.params; 

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found.' });


    if (group.adminId !== userId) {
      return res.status(403).json({ message: 'Only the admin can view approved members requests.' });
    }

    const ApprovedMembers = await Membership.findAll({
      where: { groupId, status: 'active' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone'],
        },
        {
          model: PayoutAccount,
          as: 'payoutAccount',
          attributes: ['id', 'bankName', 'accountNumber', 'isDefault'],
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (ApprovedMembers.length === 0) {
      return res.status(200).json({ message: 'No Approved Members yet.', requests: [] });
    }

    res.status(200).json({
      message: 'Approved members retrieved successfully.',
      group: {
        id: group.id,
        name: group.groupName,
      },
      Approved: ApprovedMembers,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




//  Get group details
exports.getGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findByPk(id, {
      include: [
        { association: 'admin', attributes: ['id', 'name', 'email'] },
        { association: 'members', attributes: ['id', 'name', 'email'], through: { attributes: [] } },
        { association: 'contributions' }
      ]
    });

    if (!group) return res.status(404).json({ message: 'Group not found.' });

    res.status(200).json({ group });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


//  Get group financial summary
exports.getGroupSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findByPk(id, {
      include: [
        { association: 'contributions' },
        { association: 'members' }
      ]
    });

    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const totalMembers = group.members.length;
    const totalContributions = group.contributions.reduce((sum, c) => sum + c.amount, 0);

    const goalPerMember = group.contributionAmount || 10000;
    const totalGoal = group.totalMembers * goalPerMember;
    const progress = totalGoal > 0 ? ((totalContributions / totalGoal) * 100).toFixed(2) : 0;

    res.status(200).json({
      groupId: id,
      totalMembers,
      totalContributions,
      totalGoal,
      progress: `${progress}%`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};   


// admin to start a new cycle
exports.startCycle = async (req, res) => {
  const { id } = req.params; 
  const userId = req.user.id;
  
  const t = await Group.sequelize.transaction();

  try {
    const group = await Group.findByPk(id, { transaction: t });

    if (!group) {
      await t.rollback();
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.adminId !== userId) {
      await t.rollback();
      return res.status(403).json({ message: 'Only admin can start a cycle.' });
    }

    const existingCycle = await Cycle.findOne({
      where: { groupId: id, status: 'active' },
      transaction: t,
    });

    if (existingCycle) {
      await t.rollback();
      return res.status(400).json({ message: 'A cycle is already active for this group.' });
    }

    const activeMembersCount = await Membership.count({
      where: { groupId: id, status: 'active'},
      transaction: t,
    });

    if (activeMembersCount < group.totalMembers) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Only ${activeMembersCount} of ${group.totalMembers} members approved. Cannot start cycle.` 
      });
    }

    // Get members ordered by payoutOrder
    const members = await Membership.findAll({
  where: { groupId: id, status: 'active' },
  include: [{
    model: User,
    as: 'user',
    attributes: ['id', 'name', 'email']
  }],
  order: [
    // Option 2: Use raw SQL with proper escaping
    [sequelize.literal('CASE WHEN "Membership"."payoutOrder" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
    [sequelize.col('payoutOrder'), 'ASC'],
    ['createdAt', 'ASC']
  ],
  transaction: t
});
    if (!members || members.length === 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'No active members found in group. Cannot start cycle.' 
      });
    }

    // Assign payout order if not set
    let needsOrderAssignment = members.some(m => m.payoutOrder === null);
    if (needsOrderAssignment) {
      for (let i = 0; i < members.length; i++) {
        await members[i].update({ payoutOrder: i + 1 }, { transaction: t });
      }
    }

    const firstMember = members[0];
    const cycleStartDate = new Date();

    const cycle = await Cycle.create({
      groupId: id,
      currentRound: 1,
      activeMemberId: firstMember.userId,
      status: 'active',
      startDate: cycleStartDate,
      totalRounds: group.totalMembers,
      currentRoundStartDate: cycleStartDate, 
    }, { transaction: t });

    // Reset hasReceivedPayout
    await Membership.update(
      { hasReceivedPayout: false },
      { where: { groupId: id, status: 'active' }, transaction: t }
    );

    await group.update({ status: 'active' }, { transaction: t });

    await t.commit();

    // Send notifications 
    const { sendMail } = require('../utils/sendgrid');
    try {
      for (const member of members) {
        await sendMail({
          email: member.user.email,
          subject: 'New Ajo Cycle Started!',
          html: cycleStartedMail(
            member.user.name, 
            group.groupName, 
            group.contributionAmount
          ),
        });
      }
      console.log(`Emails sent to ${members.length} members`);
    } catch (emailError) {
      console.error('Email notification error:', emailError.message);
    }

    return res.status(200).json({
      message: 'Cycle started successfully.',
      data: {
        cycle: {
          id: cycle.id,
          groupId: cycle.groupId,
          currentRound: cycle.currentRound,
          totalRounds: cycle.totalRounds,
          activeMemberId: cycle.activeMemberId,
          activeMemberName: firstMember.user.name,
          status: cycle.status,
          startDate: cycle.startDate,
          currentRoundStartDate: cycle.currentRoundStartDate,
        },
        payoutSchedule: members.map(m => ({
          position: m.payoutOrder,
          name: m.user.name,
          userId: m.userId
        }))
      }
    });

  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error('Start cycle error:', error);
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};



// Get payout order for a group
exports.getPayoutOrder = async (req, res) => {
  try {
    const { id } = req.params; // groupId
    const userId = req.user.id;

    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Check if user is member or admin
    const membership = await Membership.findOne({
      where: { userId, groupId: id, status: 'active' }
    });

    if (!membership && group.adminId !== userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Get all active members with their payout order
    const members = await Membership.findAll({
      where: { groupId: id, status: 'active' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      order: [['payoutOrder', 'ASC'], ['createdAt', 'ASC']]
    });

    // Check if there's an active cycle
    const cycle = await Cycle.findOne({
      where: { groupId: id, status: 'active' }
    });

    const payoutSchedule = members.map((member, index) => ({
      position: member.payoutOrder || index + 1,
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      hasReceivedPayout: member.hasReceivedPayout,
      isCurrentRecipient: cycle ? cycle.activeMemberId === member.userId : false,
      joinedAt: member.createdAt
    }));

    return res.status(200).json({
      message: 'Payout order retrieved successfully.',
      data: {
        groupId: id,
        groupName: group.groupName,
        totalMembers: members.length,
        currentCycle: cycle ? {
          id: cycle.id,
          currentRound: cycle.currentRound,
          activeMemberId: cycle.activeMemberId,
          status: cycle.status
        } : null,
        payoutSchedule
      }
    });

  } catch (error) {
    console.error('Get payout order error:', error);
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Set/Update payout order (Admin only)
exports.setPayoutOrder = async (req, res) => {
  const t = await Group.sequelize.transaction();
  
  try {
    const { id } = req.params; // groupId
    const userId = req.user.id;
    const { payoutOrder } = req.body; // Array of { userId, position }

    const group = await Group.findByPk(id, { transaction: t });
    if (!group) {
      await t.rollback();
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Only admin can set payout order
    if (group.adminId !== userId) {
      await t.rollback();
      return res.status(403).json({ message: 'Only admin can set payout order.' });
    }

    // Check if cycle has already started
    const activeCycle = await Cycle.findOne({
      where: { groupId: id, status: 'active' },
      transaction: t
    });

    if (activeCycle) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'Cannot change payout order after cycle has started.' 
      });
    }

    // Validate payoutOrder array
    if (!Array.isArray(payoutOrder)) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'payoutOrder must be an array of { userId, position }' 
      });
    }

    // Get all active members
    const members = await Membership.findAll({
      where: { groupId: id, status: 'active' },
      transaction: t
    });

    if (payoutOrder.length !== members.length) {
      await t.rollback();
      return res.status(400).json({ 
        message: `All ${members.length} members must be included in payout order.` 
      });
    }

    // Update payout order for each member
    for (const order of payoutOrder) {
      await Membership.update(
        { payoutOrder: order.position },
        { 
          where: { userId: order.userId, groupId: id },
          transaction: t 
        }
      );
    }

    await t.commit();

    // Get updated order
    const updatedMembers = await Membership.findAll({
      where: { groupId: id, status: 'active' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      order: [['payoutOrder', 'ASC']]
    });

    return res.status(200).json({
      message: 'Payout order updated successfully.',
      data: updatedMembers.map(m => ({
        userId: m.userId,
        name: m.user.name,
        position: m.payoutOrder
      }))
    });

  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error('Set payout order error:', error);
    return res.status(500).json({ 
      message: `${error.message}`, 
      error:  'Server error'
    });
  }
};

// Randomize payout order (Admin only)
exports.randomizePayoutOrder = async (req, res) => {
  const t = await Group.sequelize.transaction();
  
  try {
    const { id } = req.params; // groupId
    const userId = req.user.id;

    const group = await Group.findByPk(id, { transaction: t });
    if (!group) {
      await t.rollback();
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.adminId !== userId) {
      await t.rollback();
      return res.status(403).json({ message: 'Only admin can randomize payout order.' });
    }

    // Check if cycle has started
    const activeCycle = await Cycle.findOne({
      where: { groupId: id, status: 'active' },
      transaction: t
    });

    if (activeCycle) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'Cannot randomize payout order after cycle has started.' 
      });
    }

    // Get all active members
    const members = await Membership.findAll({
      where: { groupId: id, status: 'active' },
      transaction: t
    });

    // Shuffle array (Fisher-Yates algorithm)
    const shuffled = [...members].sort(() => Math.random() - 0.5);

    // Update with random order
    for (let i = 0; i < shuffled.length; i++) {
      await Membership.update(
        { payoutOrder: i + 1 },
        { 
          where: { id: shuffled[i].id },
          transaction: t 
        }
      );
    }

    await t.commit();

    // Get updated order
    const updatedMembers = await Membership.findAll({
      where: { groupId: id, status: 'active' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      order: [['payoutOrder', 'ASC']]
    });

    return res.status(200).json({
      message: 'Payout order randomized successfully.',
      data: updatedMembers.map(m => ({
        userId: m.userId,
        name: m.user.name,
        position: m.payoutOrder
      }))
    });

  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error('Randomize payout order error:', error);
    return res.status(500).json({ 
      message: `Randomize payout order failed because: ${error.message}` , 
      error:  'Server error'
    });
  }
};




exports.getCurrentPayoutInfo = async (req, res) => {
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

    // Verify admin or member
    const membership = await Membership.findOne({
      where: { userId, groupId, status: 'active' }
    });

    if (!membership && group.adminId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Get active cycle
    const cycle = await Cycle.findOne({
      where: { groupId, status: 'active' },
      include: [
        {
          model: User,
          as: 'activeMember',
          attributes: ['id', 'name', 'email', 'profilePicture']
        }
      ]
    });

    if (!cycle) {
      return res.status(200).json({
        success: true,
        data: {
          hasActiveCycle: false,
          message: 'No active cycle. Start a cycle first.'
        }
      });
    }

    // Get current round contributions
    const currentRoundStart = cycle.currentRoundStartDate || cycle.startDate;
    
    const contributions = await Contribution.findAll({
      where: {
        cycleId: cycle.id,
        status: { [Op.in]: ['paid', 'completed'] },
        createdAt: { [Op.gte]: currentRoundStart }
      }
    });

    const activeMembers = await Membership.count({
      where: { groupId, status: 'active' }
    });

    const totalAmount = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const commissionRate = parseFloat(group.commissionRate || 2);
    const commissionFee = (commissionRate / 100) * totalAmount;
    const totalPenalties = contributions.reduce((sum, c) => sum + parseFloat(c.penaltyFee || 0), 0);
    const finalAmount = totalAmount - commissionFee;

    // Get next recipient
    const allMembers = await Membership.findAll({
      where: { groupId, status: 'active' },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
      order: [['payoutOrder', 'ASC']]
    });

    const currentIndex = allMembers.findIndex(m => m.userId === cycle.activeMemberId);
    const nextMember = allMembers[currentIndex + 1] || null;

    // Check if payout already exists
    const existingPayout = await Payout.findOne({
      where: {
        cycleId: cycle.id,
        userId: cycle.activeMemberId,
        status: { [Op.in]: ['pending', 'completed'] }
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        hasActiveCycle: true,
        cycleId: cycle.id,
        currentRound: cycle.currentRound,
        totalRounds: cycle.totalRounds,
        
        currentRecipient: {
          userId: cycle.activeMemberId,
          name: cycle.activeMember?.name || 'Unknown',
          email: cycle.activeMember?.email,
          profilePicture: cycle.activeMember?.profilePicture
        },

        nextRecipient: nextMember ? {
          userId: nextMember.userId,
          name: nextMember.user.name,
          position: nextMember.payoutOrder
        } : null,

        pot: {
          totalCollected: totalAmount.toFixed(2),
          commissionFee: commissionFee.toFixed(2),
          penaltyFee: totalPenalties.toFixed(2),
          finalPayout: finalAmount.toFixed(2)
        },

        contributions: {
          received: contributions.length,
          total: activeMembers,
          remaining: activeMembers - contributions.length,
          percentage: ((contributions.length / activeMembers) * 100).toFixed(2) + '%'
        },

        canTriggerPayout: contributions.length === activeMembers && !existingPayout,
        existingPayoutId: existingPayout?.id || null,
        
        message: contributions.length === activeMembers 
          ? (existingPayout ? 'Payout already created' : 'Ready for payout')
          : `Waiting for ${activeMembers - contributions.length} more contribution(s)`
      }
    });

  } catch (error) {
    console.error('Get current payout info error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};





exports.handlePayoutAndRotate = async (cycleId, groupId) => {
  const { sendMail } = require('../utils/sendgrid');
  const { Op } = require('sequelize');

  try {
    const cycle = await Cycle.findByPk(cycleId, { include: [{ association: 'group' }] });
    const group = await Group.findByPk(groupId);

    if (!cycle || !group) throw new Error('Cycle or Group not found for payout rotation.');

    // Get all active members
    const members = await Membership.findAll({
      where: { groupId: group.id, status: 'active' },
      include: [{ model: User, as: 'user' }],
      order: [['payoutOrder', 'ASC']]
    });

    // Ensure all members have contributed this round
    const contributions = await Contribution.findAll({
      where: { cycleId, roundNumber: cycle.currentRound, status: 'paid' }
    });

    if (contributions.length < members.length) {
      console.log(` Waiting for all members to contribute: ${contributions.length}/${members.length}`);
      return { success: false, message: 'Not all members have contributed for this round yet.' };
    }

    // Calculate totals
    const totalAmount = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const commissionFee = (totalAmount * parseFloat(group.commissionRate || 2)) / 100;
    const totalPenalties = contributions.reduce((sum, c) => sum + parseFloat(c.penaltyFee || 0), 0);
    const finalAmount = totalAmount - commissionFee;

    // Create payout record
    const payout = await Payout.create({
      userId: cycle.activeMemberId,
      groupId: group.id,
      cycleId: cycle.id,
      amount: totalAmount.toFixed(2),
      commissionFee: commissionFee.toFixed(2),
      penaltyFee: totalPenalties.toFixed(2),
      status: 'completed',
      payoutDate: new Date(),
    });

    // Mark current member as received
    await Membership.update(
      { hasReceivedPayout: true },
      { where: { userId: cycle.activeMemberId, groupId: group.id } }
    );

    const currentIndex = members.findIndex(m => m.userId === cycle.activeMemberId);
    const nextMember = members[currentIndex + 1];

    if (nextMember) {
      // Move to next round
      await cycle.update({
        currentRound: cycle.currentRound + 1,
        activeMemberId: nextMember.userId,
        currentRoundStartDate: new Date()
      });

      // Mark contributions as completed for history
      await Contribution.update(
        { status: 'completed' },
        { where: { cycleId: cycle.id, roundNumber: cycle.currentRound } }
      );

      // Notify all members
      try {
        for (const member of members) {
          await sendMail({
            email: member.user.email,
            subject: `Round ${cycle.currentRound - 1} Completed - ${group.groupName}`,
            html: `
              <p>Hi ${member.user.name},</p>
              <p>Round ${cycle.currentRound - 1} of <b>${group.groupName}</b> has been completed.</p>
              <p>The payout has been made to <b>${members[currentIndex].user.name}</b>.</p>
            `
          });
        }
      } catch (emailError) {
        console.error('Round notification email error:', emailError.message);
      }

    } else {
      //  Cycle complete
      await cycle.update({ status: 'completed', endDate: new Date() });
      await group.update({ status: 'completed' });

      try {
        for (const member of members) {
          await sendMail({
            email: member.user.email,
            subject: `Cycle Completed! - ${group.groupName}`,
            html: `
              <p>Hi ${member.user.name},</p>
              <p> The cycle for <b>${group.groupName}</b> has successfully completed!</p>
              <p>All ${members.length} members have received their payouts.</p>
              <p>Total payout: <b>$${(finalAmount * members.length).toFixed(2)}</b></p>
            `
          });
        }
      } catch (emailError) {
        console.error('Completion email error:', emailError.message);
      }
    }

    return { success: true, payout };

  } catch (error) {
    console.error('Payout and rotate error:', error);
    throw error;
  }
};


// Add delete group function
exports.deleteGroup = async (req, res) => {
  const t = await Group.sequelize.transaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const group = await Group.findByPk(id, { transaction: t });
    
    if (!group) {
      await t.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Group not found.' 
      });
    }

    // Only admin can delete
    if (group.adminId !== userId) {
      await t.rollback();
      return res.status(403).json({ 
        success: false,
        message: 'Only the group admin can delete this group.' 
      });
    }

    // Check if there's an active cycle
    const activeCycle = await Cycle.findOne({
      where: { groupId: id, status: 'active' },
      transaction: t
    });

    if (activeCycle) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'Cannot delete group with an active cycle. Please end the cycle first.',
        suggestion: 'Use the end-cycle endpoint first.'
      });
    }

    // Check for pending payouts
    const pendingPayouts = await Payout.count({
      where: { 
        groupId: id, 
        status: 'pending' 
      },
      transaction: t
    });

    if (pendingPayouts > 0) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: `Cannot delete group with ${pendingPayouts} pending payout(s). Please complete all payouts first.`
      });
    }

    // Get group stats before deletion
    const members = await Membership.findAll({
      where: { groupId: id },
      include: [{ model: User, as: 'user', attributes: ['email', 'name'] }],
      transaction: t
    });

    const totalContributions = await Contribution.count({
      where: { groupId: id },
      transaction: t
    });

    // Delete in order (respecting foreign keys)
    // 1. Delete contributions
    await Contribution.destroy({ 
      where: { groupId: id }, 
      transaction: t 
    });

    // 2. Delete payouts
    await Payout.destroy({ 
      where: { groupId: id }, 
      transaction: t 
    });

    // 3. Delete cycles
    await Cycle.destroy({ 
      where: { groupId: id }, 
      transaction: t 
    });

    // 4. Delete memberships
    await Membership.destroy({ 
      where: { groupId: id }, 
      transaction: t 
    });

    // 5. Finally delete the group
    await group.destroy({ transaction: t });

    await t.commit();

    // Send notification emails to all members
    try {
      const { sendMail } = require('../utils/sendgrid');
      for (const member of members) {
        if (member.user && member.user.email) {
          await sendMail({
            email: member.user.email,
            subject: 'Group Deleted - ' + group.groupName,
            html: `
              <p>Hi ${member.user.name},</p>
              <p>The group <b>${group.groupName}</b> has been deleted by the admin.</p>
              ${totalContributions > 0 ? `<p>Total contributions made: <b>${totalContributions}</b></p>` : ''}
              <p>Thank you for being part of this group.</p>
            `
          });
        }
      }
    } catch (emailError) {
      console.error('Delete notification email error:', emailError);
    }

    return res.status(200).json({
      success: true,
      message: 'Group deleted successfully.',
      data: {
        groupName: group.groupName,
        membersNotified: members.length,
        contributionsDeleted: totalContributions
      }
    });

  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error('Delete group error:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message, 
      error:  'server error'
    });
  }
};



// admin to end cycle
exports.endCycle = async (req, res) => {
  const { id } = req.params; // groupId
  const userId = req.user.id;
  const { forceEnd } = req.body; // Optional flag to force end
  
  const t = await Group.sequelize.transaction();

  try {
    const group = await Group.findByPk(id, { transaction: t });
    
    if (!group) {
      await t.rollback();
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.adminId !== userId) {
      await t.rollback();
      return res.status(403).json({ message: 'Only admin can end cycle.' });
    }

    const cycle = await Cycle.findOne({ 
      where: { groupId: id, status: 'active' },
      transaction: t 
    });

    if (!cycle) {
      await t.rollback();
      return res.status(400).json({ message: 'No active cycle found.' });
    }

    // Get statistics
    const totalContributions = await Contribution.count({
      where: { cycleId: cycle.id },
      transaction: t
    });

    const totalPayouts = await Payout.count({
      where: { cycleId: cycle.id },
      transaction: t
    });

    const activeMembersCount = await Membership.count({
      where: { groupId: id, status: 'active' },
      transaction: t
    });

    //  Check if cycle is complete before ending
    if (!forceEnd && cycle.currentRound < activeMembersCount) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'Cycle is not yet complete. Not all members have received payouts.',
        warning: {
          currentRound: cycle.currentRound,
          totalMembers: activeMembersCount,
          remainingRounds: activeMembersCount - cycle.currentRound,
          suggestion: 'Set forceEnd: true in request body to end cycle anyway.'
        }
      });
    }

    // Check for pending contributions
    const pendingContributions = await Contribution.count({
      where: { 
        cycleId: cycle.id, 
        status: 'pending' 
      },
      transaction: t
    });

    if (!forceEnd && pendingContributions > 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: `There are ${pendingContributions} pending contributions.`,
        warning: {
          pendingContributions,
          suggestion: 'you can set {forceEnd: true} in request body to end cycle anyway.'
        }
      });
    }

    // Update cycle and group status
    await cycle.update({ 
      status: 'completed', 
      endDate: new Date() 
    }, { transaction: t });

    await group.update({ 
      status: 'completed' 
    }, { transaction: t });

    // Commit transaction
    await t.commit();

    // Send notifications
    const { sendMail } = require('../utils/sendgrid');
    try {
      const members = await Membership.findAll({
        where: { groupId: id, status: 'active' },
        include: [{ model: User, as: 'user' }]
      });

      for (const member of members) {
        await sendMail({
          email: member.user.email,
          subject: 'Cycle Ended - ' + group.groupName,
          html: `
            <p>Hi ${member.user.name},</p>
            <p>The cycle for <b>${group.groupName}</b> has been ended by the admin.</p>
            <p><strong>Cycle Summary:</strong></p>
            <ul>
              <li>Rounds Completed: <b>${cycle.currentRound} of ${activeMembersCount}</b></li>
              <li>Total Contributions: <b>${totalContributions}</b></li>
              <li>Total Payouts: <b>${totalPayouts}</b></li>
              <li>Duration: ${Math.ceil((new Date(cycle.endDate) - new Date(cycle.startDate)) / (1000 * 60 * 60 * 24))} days</li>
            </ul>
            <p>Started: <b>${new Date(cycle.startDate).toLocaleDateString()}</b></p>
            <p>Ended: <b>${new Date(cycle.endDate).toLocaleDateString()}</b></p>
            <p>Thank you for participating in this cycle!</p>
          `,
        });
      }
      console.log(`Cycle end notifications sent to ${members.length} members`);
    } catch (emailError) {
      console.error('Email notification error:', emailError.message);
    }

    return res.status(200).json({ 
      message: 'Cycle ended successfully.',
      data: {
        cycle: {
          id: cycle.id,
          groupId: cycle.groupId,
          status: cycle.status,
          currentRound: cycle.currentRound,
          totalRounds: activeMembersCount,
          startDate: cycle.startDate,
          endDate: cycle.endDate,
          duration: Math.ceil((new Date(cycle.endDate) - new Date(cycle.startDate)) / (1000 * 60 * 60 * 24)) + ' days'
        },
        statistics: {
          totalContributions,
          totalPayouts,
          activeMembersCount,
          pendingContributions,
          completionRate: ((cycle.currentRound / activeMembersCount) * 100).toFixed(2) + '%'
        },
        emailsSent: true
      }
    });

  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error('End cycle error:', error);
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};





















// member to make a contribution
// exports.makeContribution = async (req, res) => {
//   const t = await sequelize.transaction();
  
//   try {
//     const userId = req.user.id;
//     const { id } = req.params;
//     const { amount } = req.body;

//     const group = await Group.findByPk(id);
//     if (!group) {
//       await t.rollback();
//       return res.status(404).json({ message: 'Group not found.' });
//     }

//     const cycle = await Cycle.findOne({ where: { groupId: id, status: 'active' } });
//     if (!cycle) {
//       await t.rollback();
//       return res.status(400).json({ message: 'No active cycle for this group.' });
//     }

//     // Verify member
//     const membership = await Membership.findOne({
//       where: { userId, groupId: id, status: 'active' },
//     });
//     if (!membership) {
//       await t.rollback();
//       return res.status(403).json({ message: 'You are not a member of this group.' });
//     }

//     // Check contribution
//     const existing = await Contribution.findOne({ where: { userId, cycleId: cycle.id } });
//     if (existing) {
//       await t.rollback();
//       return res.status(400).json({ message: 'Already contributed this round.' });
//     }

//     // Penalty / Validation
//     const expectedAmount = parseFloat(group.contributionAmount);
//     const paidAmount = parseFloat(amount);

//     if (Math.abs(paidAmount - expectedAmount) > 0.01) {
//       await t.rollback();
//       return res.status(400).json({
//         message: `Contribution amount must be ${expectedAmount}. You sent ${paidAmount}`,
//       });
//     }

//     const penalty = paidAmount < expectedAmount ? group.penaltyFee : 0;

//     // Record contribution
//     const contribution = await Contribution.create(
//       {
//         userId,
//         groupId: id,
//         cycleId: cycle.id,
//         amount,
//         status: 'paid',
//         penaltyFee: penalty,
//         contributionDate: new Date(),
//       },
//       { transaction: t }
//     );

//      // Send an email to the user when contribution is received
//     const user = await User.findByPk(userId);
//     const dateString = new Date().toISOString().split('T')[0];

//     if (user && user.email) {
//       await sendMail({
//         email: user.email,
//         subject: 'Contribution Received',
//         html: contributionReceivedMail(user.name, group.groupName, amount, dateString),
//       });
//     }

//     // Check if all members have contributed
//     const allContributions = await Contribution.count({ where: { cycleId: cycle.id } });
//     const activeMembers = await Membership.count({ where: { groupId: id, status: 'active' } });

//     if (allContributions === activeMembers && cycle.status === 'active') {
//       try {
//         await handlePayoutAndRotate(cycle.id, group.id);
//       } catch (error) {
//         console.error('Payout rotation error:', error);
//       }
//     }

//     await t.commit();

//     return res.status(200).json({
//       message: 'Contribution successful.',
//       contribution,
//       penaltyApplied: penalty > 0,
//     });

//   } catch (error) {
//     await t.rollback();
//     console.error(error);
//     return res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// handle payout and cycle rotation


// exports.createGroup = async (req, res) => {




// // POST /api/groups
//   const t = await Group.sequelize.transaction();
//   try {
//     const userId = req.user.id;

//     // create group
//     const group = await Group.create({
//       name: req.body.name,
//       contributionAmount: req.body.contributionAmount,
//       contributionFrequency: req.body.contributionFrequency,
//       payoutFrequency: req.body.payoutFrequency,
//       penaltyFee: req.body.penaltyFee,
//       description: req.body.description,
//       totalMembers: req.body.totalMembers,
//       adminId: userId
//     }, { transaction: t });
      

//     // admin automatically becomes first member
//     await Membership.create({
//       userId,
//       groupId: group.id,
//       role: 'admin'
//     }, { transaction: t });

//     await t.commit();

//     // check if admin has payout account
//     const hasPayout = await PayoutAccount.findOne({ where: { userId } });

//     if (!hasPayout) {
//       return res.status(200).json({
//         message: 'Group created but payout account is required',
//         groupId: group.id,
//         requiresPayout: true
//       });
//     }

//     res.status(201).json({
//       message: 'Group created successfully',
//       group
//     });

//   } catch (error) {
//      if (t && !t.finished) await t.rollback();
//     console.error(error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// exports.addPayoutAccount = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const user = await User.findByPk(userId);

//     user.payoutAccounts.push({
//       bankName: req.body.bankName,
//       accountNumber: req.body.accountNumber,
//       isDefault: req.body.isDefault || false
//     });

//     await user.save();

//     res.status(200).json({
//       message: "Payout account added successfully",
//       payoutAccounts: user.payoutAccounts
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// };


// exports.attachPayoutToGroup = async (req, res) => {
//   const { groupId } = req.params;
//   const userId = req.user.id;

//   const user = await User.findById(userId);
//   const payout = user.payoutAccounts.find(p => p.isDefault);

//   if (!payout) return res.status(400).json({ message: "No default payout account" });

//   await Group.findByIdAndUpdate(groupId, {
//     $push: { payoutAccounts: { userId, ...payout } }
//   });

//   res.status(200).json({ message: "Payout added to group" });
// };



// // GET /api/groups
// exports.getUserGroups = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const groups = await Group.findAll({
//       include: [
//         {
//           association: 'members',
//           where: { id: userId },
//           through: { attributes: [] } // exclude join table fields
//         },
//         { association: 'admin', attributes: ['id', 'name', 'email'] }
//       ]
//     });

//     res.status(200).json({ groups });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// // Generate an invite link
// // GET /api/groups/:id/invite
// exports.generateInviteLink = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const group = await Group.findByPk(id);
//     if (!group) return res.status(404).json({ message: 'Group not found' });

//     // Generate a unique token (could be encoded in JWT too)
//     const inviteCode = uuidv4();
//     // In real life, store in redis or invite table with expiry

//     const inviteLink = `${process.env.FRONTEND_URL}/join-group/${id}?invite=${inviteCode}`;

//     res.status(200).json({ inviteLink });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// // Join group using invite link
// // POST /api/groups/:id/join
// exports.joinGroup = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { id } = req.params;

//     // ensure group exists
//     const group = await Group.findByPk(id);
//     if (!group) return res.status(404).json({ message: 'Group not found' });

//     // check if already a member
//     const exists = await Membership.findOne({ where: { userId, groupId: id } });
//     if (exists) return res.status(400).json({ message: 'Already a member' });

//     await Membership.create({ userId, groupId: id, role: 'member' });

//     res.status(200).json({ message: 'Joined group successfully', groupId: id });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };



// // GET /api/groups/:id
// exports.getGroupDetails = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const group = await Group.findByPk(id, {
//       include: [
//         { association: 'admin', attributes: ['id', 'name', 'email'] },
//         { association: 'members', attributes: ['id', 'name', 'email'], through: { attributes: [] } },
//         { association: 'contributions' }
//       ]
//     });

//     if (!group) return res.status(404).json({ message: 'Group not found' });

//     res.status(200).json({ group });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// // GET /api/groups/:id/summary
// exports.getGroupSummary = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // get group + contributions
//     const group = await Group.findByPk(id, {
//       include: [{ association: 'contributions' }, { association: 'members' }]
//     });
//     if (!group) return res.status(404).json({ message: 'Group not found' });

//     const totalMembers = group.members.length;
//     const totalContributions = group.contributions.reduce((sum, c) => sum + c.amount, 0);

//     // Example: fixed cycle goal — can be dynamic later
//     const goalPerMember = 10000; // N10,000 each
//     const totalGoal = totalMembers * goalPerMember;
//     const progress = totalGoal ? ((totalContributions / totalGoal) * 100).toFixed(2) : 0;

//     res.status(200).json({
//       groupId: id,
//       totalMembers,
//       totalContributions,
//       totalGoal,
//       progress: `${progress}%`
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };