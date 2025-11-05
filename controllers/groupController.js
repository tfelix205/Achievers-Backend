const { Group, Membership, User, Contribution, PayoutAccount, Cycle, Payout, sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');
const {nameToTitleCase} = require('../helper/nameConverter');
const { sendMail } = require('../utils/sendgrid');
const { groupCreatedMail } = require('../utils/groupCreatedMail');
const { joinRequestMail } = require('../utils/joinRequestMail');
const { cycleStartedMail } = require('../utils/cycleStartedMail');
const { contributionReceivedMail } = require('../utils/contributionReceivedMail');
const { cycleCompletedMail } = require('../utils/cycleCompletedMail');

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
  try {
    const userId = req.user.id;
    const { bankName, accountNumber, isDefault } = req.body;

    if (!bankName || !accountNumber) {
      return res.status(400).json({ message: 'Bank name and account number are required.' });
    }

    // If isDefault = true, reset others
    if (isDefault) {
      await PayoutAccount.update(
        { isDefault: false },
        { where: { userId } }
      );
    }

    const payout = await PayoutAccount.create({
      userId,
      bankName: bankName.trim().toLowerCase(),
      accountNumber: accountNumber.trim(),
      isDefault: !!isDefault
    });

    res.status(200).json({
      message: 'Payout account added successfully.',
      payout
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
    const { Op } = require('sequelize');

    // First, get all group IDs where user is a member
    const userMemberships = await Membership.findAll({
      where: { userId, status: 'active' },
      attributes: ['groupId']
    });

    const groupIds = userMemberships.map(m => m.groupId);

    if (groupIds.length === 0) {
      return res.status(200).json({ 
        success: true,
        count: 0,
        groups: [] 
      });
    }

    // Then get all groups with full details
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

    // Format response
    const formattedGroups = groups.map(group => {
      const activeCycle = group.cycles && group.cycles.length > 0 ? group.cycles[0] : null;
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
        
        // Admin info
        admin: {
          id: group.admin.id,
          name: group.admin.name,
          email: group.admin.email,
          profilePicture: group.admin.profilePicture
        },
        isAdmin: group.adminId === userId,
        
        // Current user's role in this group
        myRole: currentUserMembership ? currentUserMembership.Membership.role : null,
        myPayoutOrder: currentUserMembership ? currentUserMembership.Membership.payoutOrder : null,
        hasReceivedPayout: currentUserMembership ? currentUserMembership.Membership.hasReceivedPayout : false,
        joinedAt: currentUserMembership ? currentUserMembership.Membership.createdAt : null,
        
        // All members (sorted by payout order)
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
            // Sort by payout order (nulls last), then by joined date
            if (a.payoutOrder === null && b.payoutOrder === null) {
              return new Date(a.joinedAt) - new Date(b.joinedAt);
            }
            if (a.payoutOrder === null) return 1;
            if (b.payoutOrder === null) return -1;
            return a.payoutOrder - b.payoutOrder;
          }),
        
        // Active cycle details
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
            ? ((activeCycle.currentRound / activeCycle.totalRounds) * 100).toFixed(2) 
            : 0
        } : null,
        
        // Quick stats
        stats: {
          isComplete: group.members.length === group.totalMembers,
          spotsRemaining: Math.max(0, group.totalMembers - group.members.length),
          hasActiveCycle: !!activeCycle
        }
      };
    });

    res.status(200).json({ 
      success: true,
      count: formattedGroups.length,
      data: formattedGroups 
    });

  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
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
    const inviteLink = `${process.env.FRONTEND_URL}/join_group/${id}/${inviteCode}`;

    
    await group.update({ inviteCode });

    res.status(200).json({ inviteLink });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




//  Request to join group via invite link
exports.joinGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; // get the group id from the params(link)
    const { invite } = req.params;//get the invite code from the params

    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const validUser = await User.findByPk(userId);
    if ( !validUser ) {
      return res.status(404).json({ message: 'User not found. please proceed to login' });
    }

  
    if (group.inviteCode !== invite) {
      return res.status(400).json({ message: 'Invalid or expired invite link.' });
    }

  
    const existing = await Membership.findOne({ where: { userId, groupId: id } });
    if (existing) return res.status(400).json({ message: 'You are already a member of this group.' });

 
    const payout = await PayoutAccount.findOne({ where: { userId, isDefault: true } });
    if (!payout) {
      return res.status(400).json({
        message: 'You must set up a payout account before joining a group.',
        requiresPayout: true
      });
    }

   
    await Membership.create({
      userId,
      groupId: id,
      role: 'member',
      status: 'pending',
      payoutAccountId: payout.id 
    });

    // Send an email to the group admin to notify them of the join request
 const admin = await User.findByPk(group.adminId);
const user = await User.findByPk(userId);
   const dateString = new Date().toISOString().split('T')[0];

   if (admin && admin.email && user) {
     await sendMail({
       email: admin.email,
       subject: 'Request to Join Your Group',
       html: joinRequestMail(
         admin.name,
         user.name,
         group.groupName,
         dateString
       ),
     });
   }
        const groupInfo = {
          groupName: group.groupName,
          admin: await User.findByPk(group.adminId, { attributes: ['id', 'name', 'email'] }),
          contributionAmount: group.contributionAmount,
          totalMembers: group.totalMembers,
          availableSpots: group.totalMembers - (await Membership.count({ where: { groupId: id, status: 'active' } })) ,

        }
    res.status(200).json({
      message: 'Join request sent successfully. Waiting for admin approval.',
      group: groupInfo

    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


//  Approve or reject join request
exports.manageJoinRequest = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { groupId, memberId } = req.params;
    const { action } = req.body; 

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    
    if (group.adminId !== userId) {
      return res.status(403).json({ message: 'Only admin can manage join requests.' });
    }

    const membership = await Membership.findOne({
      where: { groupId, userId: memberId, status: 'pending' }
    });
    if (!membership) return res.status(404).json({ message: 'Pending request not found.' });

    if (action === 'approve') {
      await membership.update({ status: 'active' });
    } else if (action === 'reject') {
      await membership.destroy();
    }

    res.status(200).json({ message: `Request ${action}ed successfully.` });
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

    // Get members ordered by payoutOrder (or createdAt if not set)
    const members = await Membership.findAll({
      where: { groupId: id, status: 'active' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      order: [
        ['payoutOrder', 'ASC NULLS LAST'], 
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

    // If payoutOrder not set, assign it now
    let needsOrderAssignment = members.some(m => m.payoutOrder === null);
    if (needsOrderAssignment) {
      for (let i = 0; i < members.length; i++) {
        await members[i].update({ payoutOrder: i + 1 }, { transaction: t });
      }
    }

    // First member in order gets paid first
    const firstMember = members[0];

    const cycle = await Cycle.create({
      groupId: id,
      currentRound: 1,
      activeMemberId: firstMember.userId,
      status: 'active',
      startDate: new Date(),
      totalRounds: group.totalMembers,
    }, { transaction: t });

    // Reset hasReceivedPayout for all members
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
          html: cycleStartedMail(member.name, group.groupName, group.contributionAmount),
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
      message: 'Server error', 
      error: error.message 
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
      message: 'Server error', 
      error: error.message 
    });
  }
};



// member to make a contribution
exports.makeContribution = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { amount } = req.body;

    const group = await Group.findByPk(id);
    if (!group) {
      await t.rollback();
      return res.status(404).json({ message: 'Group not found.' });
    }

    const cycle = await Cycle.findOne({ where: { groupId: id, status: 'active' } });
    if (!cycle) {
      await t.rollback();
      return res.status(400).json({ message: 'No active cycle for this group.' });
    }

    // Verify member
    const membership = await Membership.findOne({
      where: { userId, groupId: id, status: 'active' },
    });
    if (!membership) {
      await t.rollback();
      return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    // Check contribution
    const existing = await Contribution.findOne({ where: { userId, cycleId: cycle.id } });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: 'Already contributed this round.' });
    }

    // Penalty / Validation
    const expectedAmount = parseFloat(group.contributionAmount);
    const paidAmount = parseFloat(amount);

    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      await t.rollback();
      return res.status(400).json({
        message: `Contribution amount must be ${expectedAmount}. You sent ${paidAmount}`,
      });
    }

    const penalty = paidAmount < expectedAmount ? group.penaltyFee : 0;

    // Record contribution
    const contribution = await Contribution.create(
      {
        userId,
        groupId: id,
        cycleId: cycle.id,
        amount,
        status: 'paid',
        penaltyFee: penalty,
        contributionDate: new Date(),
      },
      { transaction: t }
    );

     // Send an email to the user when contribution is received
    const user = await User.findByPk(userId);
    const dateString = new Date().toISOString().split('T')[0];

    if (user && user.email) {
      await sendMail({
        email: user.email,
        subject: 'Contribution Received',
        html: contributionReceivedMail(user.name, group.groupName, amount, dateString),
      });
    }

    // Check if all members have contributed
    const allContributions = await Contribution.count({ where: { cycleId: cycle.id } });
    const activeMembers = await Membership.count({ where: { groupId: id, status: 'active' } });

    if (allContributions === activeMembers && cycle.status === 'active') {
      try {
        await handlePayoutAndRotate(cycle.id, group.id);
      } catch (error) {
        console.error('Payout rotation error:', error);
      }
    }

    await t.commit();

    return res.status(200).json({
      message: 'Contribution successful.',
      contribution,
      penaltyApplied: penalty > 0,
    });

  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// handle payout and cycle rotation
exports.handlePayoutAndRotate = async (cycleId, groupId) => {
  const { sendMail } = require('../utils/sendgrid');
  
  try {
    const cycle = await Cycle.findByPk(cycleId, { 
      include: [{ association: 'group' }] 
    });
    
    const group = await Group.findByPk(groupId);

    if (!cycle || !group) {
      throw new Error('Cycle or Group not found for payout rotation.');
    }

    // Get contributions for this round only (last 24 hours)
    const contributions = await Contribution.findAll({ 
      where: { 
        cycleId,
        createdAt: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      } 
    });
    
    const totalAmount = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const commissionFee = (totalAmount * parseFloat(group.commissionRate || 2)) / 100;
    const totalPenalties = contributions.reduce((sum, c) => sum + parseFloat(c.penaltyFee || 0), 0);
    const finalAmount = totalAmount - commissionFee;

    // Create payout record
    await Payout.create({
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

    // Get members ordered by payoutOrder
    const members = await Membership.findAll({ 
      where: { groupId: group.id, status: 'active' }, 
      include: [{ model: User, as: 'user' }],
      order: [['payoutOrder', 'ASC']]
    });

    const currentIndex = members.findIndex(m => m.userId === cycle.activeMemberId);
    const nextMember = members[currentIndex + 1];

    if (nextMember) {
      // Move to next round
      await cycle.update({
        currentRound: cycle.currentRound + 1,
        activeMemberId: nextMember.userId,
      });

      //  Mark contributions as completed (don't delete for history)
      await Contribution.update(
        { status: 'completed' },
        { where: { cycleId: cycle.id, status: 'paid' } }
      );
      
      // Send round completion emails
      try {
        for (const member of members) {
          await sendMail({
            email: member.user.email,
            subject: `Round ${cycle.currentRound} Started - ${group.groupName}`,
            html: cycleCompletedMail(
           member.User.name,
           group.groupName,
           group.contributionAmount,
           dateString
         )
          });
        }
      } catch (emailError) {
        console.error('Round notification email error:', emailError.message);
      }

    } else {
      // Cycle complete
      await cycle.update({ 
        status: 'completed',
        endDate: new Date()
      });
      await group.update({ status: 'completed' });
      
      try {
        for (const member of members) {
          await sendMail({
            email: member.user.email,
            subject: `Cycle Completed! - ${group.groupName}`,
            html: `
              <p>Hi ${member.user.name},</p>
              <p> Congratulations! The cycle for <b>${group.groupName}</b> has completed successfully!</p>
              <p>All ${members.length} members have received their payouts.</p>
              <p>Thank you for participating!</p>
            `
          });
        }
      } catch (emailError) {
        console.error('Completion email error:', emailError.message);
      }
    }
  } catch (error) {
    console.error('Payout and rotate error:', error);
    throw error;
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
























// // POST /api/groups
// exports.createGroup = async (req, res) => {
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