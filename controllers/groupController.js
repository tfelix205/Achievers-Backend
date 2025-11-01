const { where } = require('sequelize');
const { Group, Membership, User, Contribution, PayoutAccount, Cycle, payout } = require('../models');
const { v4: uuidv4 } = require('uuid');

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
      groupName: groupName.trim().toLowerCase(),
      contributionAmount,
      contributionFrequency: contributionFrequency.trim().toLowerCase(),
      payoutFrequency: payoutFrequency.trim().toLowerCase(),
      penaltyFee: newPenaltyFee,
      description: description.trim(),
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

    const groups = await Group.findAll({
  include: [
    {
      model: User,
      as: 'members',
      attributes: ['id', 'name', 'email'], // ✅ safe fields only
      through: { attributes: [] },
      where: { id: userId }
    },
    {
      model: User,
      as: 'admin',
      attributes: ['id', 'name', 'email']
    }
  ]
});

    res.status(200).json({ groups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
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

    const inviteCode = uuidv4();
    const inviteLink = `${process.env.FRONTEND_URL}/join-group/${id}?invite=${inviteCode}`;

    
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
    const { id } = req.params;
    const { invite } = req.query;

    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

  
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

    res.status(200).json({
      message: 'Join request sent successfully. Waiting for admin approval.'
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
    const totalGoal = totalMembers * goalPerMember;
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

  try {
    const group = await Group.findByPk(id, {
      include: [
        {
          association: 'members',
          attributes: ['id', 'name', 'email'], 
          through: {
            attributes: [], 
            where: { status: 'active' }, 
          },
        },
      ],
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (group.adminId !== userId) {
      return res.status(403).json({ message: 'Only admin can start a cycle.' });
    }

    const existingCycle = await Cycle.findOne({
      where: { groupId: id, status: 'active' },
    });

    if (existingCycle) {
      return res.status(400).json({ message: 'A cycle is already active for this group.' });
    }

    const activeMembersCount = await Membership.count({
      where: { groupId: id, status: 'active'}
    });

    if (activeMembersCount  < group.totalMembers) {
      console.log(activeMembersCount, group.totalMembers);
      
      return res.status(400).json({ message: `Only ${activeMemberCount} of ${group.totalMembers} members approved. Cannot start cycle.` });
    }

    // Select first member as first payout recipient
    const firstMember = group.members[0];

    const cycle = await Cycle.create({
      groupId: id,
      currentRound: 1,
      activeMemberId: firstMember.id,
      status: 'active',
      startDate: new Date(),
    });

    // Send notification to all group members
    const { sendMail } = require('../utils/sendgrid');
    for (const member of group.members) {
      await sendMail({
        to: member.email,
        subject: 'New Cycle Started!',
        html: `
          <p>Hi ${member.name},</p>
          <p>The Ajo cycle for <b>${group.groupName}</b> has started.</p>
          <p>Please make your first contribution of <b>${group.contributionAmount}</b> as soon as possible.</p>
        `,
      });
    }

    await group.update({ status: 'active' });

    return res.status(200).json({
      message: 'Cycle started successfully.',
      cycle,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error: error.message });
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
 const cycle = await cycle.findByPk(cycleId, { include: [{association: 'group'}]});

 const group = await group.findByPk(groupId);

  if (!cycle || !group) {
    throw new Error('Cycle or Group not found for payout rotation.');
  }

  // Calculate total amount contributed
  const contributions = await Contribution.findAll({ where: { cycleId} });
  const totalAmount = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  
  // Deduct commission fee (which is  2%)  abi ?
  const commissionFee = (totalAmount * parseFloat(group.commissionRate || 2)) / 100;
  const finalAmount = totalAmount - commissionFee;

  // Pay current member 
  await payout.create({
    userId: cycle.activeMemberId,
    groupId: group.id,
    cycleId: cycle.id,
    amount: `initial payout: ${totalAmount}, commission: ${commissionFee}, total payout: ${finalAmount}`,
    penaltyFee: 0,
    status: 'completed',
    payoutDate: new Date(),
  });

  // Move to next member
  const members = await Membership.findAll({ where: { groupId: group.id, status: 'active' }, include: [{model: User, as: 'User'}],
    order: [['createdAt', 'ASC']]
  });

  const currentIndex = members.findIndex(m => m.userId === cycle.activeMemberId);
  const nextMember = members[currentIndex + 1];

  if (nextMember) {
    // Rotate to next member , if there is one
    await cycle.update({
      currentRound: cycle.currentRound + 1,
      activeMemberId: nextMember.userId,
    });

    // Clear contributions for next round
    await Contribution.destroy({ where: { cycleId: cycle.id } });
    
     for (const member of members) {
      await sendMail({
        to: member.user.email,
        subject: `Round ${cycle.currentRound} Started`,
        html: `
          <p>Hi ${member.user.name},</p>
          <p>Round ${cycle.currentRound} has started.</p>
          <p>Next recipient: <b>${nextMember.user.name}</b></p>
          <p>Please contribute <b>${group.contributionAmount}</b>.</p>
        `
      });
    }

  } else {
    //  if No next member then we can share the grace and end cycle
    // await endCycle(cycle.id);
    await cycle.update({ 
      status: 'completed',
      endDate: new Date()
    });
    await group.update({ status: 'completed'});
    const { sendMail } = require('../utils/sendgrid');
    for (const member of members) {
      await sendMail({
        to: member.user.email,
        subject: 'Cycle Completed!',
        html: `
          <p>Hi ${member.user.name},</p>
          <p>The cycle for <b>${group.groupName}</b> has completed!</p>
          <p>All members have received their payout.</p>
        `
      });
    }

  }
};

// admin to end cycle
exports.endCycle = async (req, res) => {
  const { id } = req.params; // groupId
  const userId = req.user.id;

  try {
    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (group.adminId !== userId)
      return res.status(403).json({ message: 'Only admin can end cycle.' });

    const cycle = await Cycle.findOne({ where: { groupId: id, status: 'active' } });
    if (!cycle) return res.status(400).json({ message: 'No active cycle found.' });

    await cycle.update({ status: 'completed', endDate: new Date() });
    await group.update({ status: 'completed' });

    res.status(200).json({ message: 'Cycle ended successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
