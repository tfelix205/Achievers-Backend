const db = require('../models');
const Contribution = db.Contribution;
const Group = db.Group;
const User = db.User;

// ✅ Make a contribution
exports.contribute = async (req, res) => {
  try {
    const { amount } = req.body;
    const { groupId } = req.params;
    const userId = req.user.id;

    // Validate group
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Check if user is a member of this group
    const member = await db.sequelize.models.GroupMembers.findOne({
      where: { UserId: userId, GroupId: groupId },
    });

    if (!member)
      return res.status(403).json({ message: 'You are not a member of this group' });

    // Check if contribution amount matches group requirement
    if (amount !== group.contributionAmount)
      return res.status(400).json({
        message: `Contribution amount must be ₦${group.contributionAmount}`,
      });

    // Record contribution
    const contribution = await Contribution.create({
      userId,
      groupId,
      amount,
      status: 'success',
    });

    // Optional: Update user wallet balance, group total, or notify admin
    res.status(201).json({
      message: 'Contribution successful',
      contribution,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all contributions by logged-in user
exports.getMyContributions = async (req, res) => {
  try {
    const contributions = await Contribution.findAll({
      where: { userId: req.user.id },
      include: { model: Group, attributes: ['name', 'contributionAmount'] },
      order: [['date', 'DESC']],
    });

    res.json(contributions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all contributions in a specific group
exports.getGroupContributions = async (req, res) => {
  try {
    const { groupId } = req.params;

    const contributions = await Contribution.findAll({
      where: { groupId },
      include: { model: User, attributes: ['id', 'name', 'email'] },
      order: [['date', 'DESC']],
    });

    res.json(contributions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
