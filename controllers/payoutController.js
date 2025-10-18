const db = require('../models');
const Payout = db.Payout;
const Group = db.Group;
const User = db.User;

// ✅ Trigger next payout (admin only)
exports.triggerPayout = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // 1️⃣ Find group
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // 2️⃣ Check if requester is group admin
    const member = await db.sequelize.models.GroupMembers.findOne({
      where: { GroupId: groupId, UserId: userId },
    });
    if (!member || member.role !== 'admin')
      return res.status(403).json({ message: 'Only group admins can trigger payouts' });

    // 3️⃣ Find next eligible member (lowest unpaid payoutOrder)
    const members = await db.sequelize.models.GroupMembers.findAll({
      where: { GroupId: groupId },
      order: [['payoutOrder', 'ASC']],
    });

    const paidMembers = await Payout.findAll({
      where: { groupId },
      attributes: ['userId'],
    });

    const paidIds = paidMembers.map(p => p.userId);
    const nextMember = members.find(m => !paidIds.includes(m.UserId));

    if (!nextMember)
      return res.status(400).json({ message: 'All members have already received payout' });

    // 4️⃣ Calculate payout amount (total contributions for the cycle)
    const total = group.contributionAmount * members.length;

    // 5️⃣ Record payout
    const payout = await Payout.create({
      groupId,
      userId: nextMember.UserId,
      amount: total,
      status: 'paid',
    });

    res.json({
      message: `Payout of ₦${total} successfully triggered for member ID ${nextMember.UserId}`,
      payout,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all payouts for a specific group
exports.getGroupPayouts = async (req, res) => {
  try {
    const { groupId } = req.params;

    const payouts = await Payout.findAll({
      where: { groupId },
      include: { model: User, attributes: ['id', 'name', 'email'] },
      order: [['payoutDate', 'DESC']],
    });

    res.json(payouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all payouts for logged-in user
exports.getMyPayouts = async (req, res) => {
  try {
    const payouts = await Payout.findAll({
      where: { userId: req.user.id },
      include: { model: Group, attributes: ['id', 'name'] },
      order: [['payoutDate', 'DESC']],
    });

    res.json(payouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
