const db = require('../models');
const Group = db.Group;
const User = db.User;

// ✅ Create Group
exports.createGroup = async (req, res) => {
  try {
    const { name, contributionAmount, cycle } = req.body;

    if (!name || !contributionAmount)
      return res.status(400).json({ message: 'Group name and contribution amount required' });

    // Create group
    const group = await Group.create({
      name,
      contributionAmount,
      cycle: cycle || 'monthly',
      status: 'active',
    });

    // Add the creator as admin
    await db.sequelize.models.GroupMembers.create({
      UserId: req.user.id,
      GroupId: group.id,
      role: 'admin',
      payoutOrder: 1,
    });

    res.status(201).json({ message: 'Group created successfully', group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all groups user belongs to
exports.getUserGroups = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: {
        model: Group,
        through: { attributes: ['role', 'payoutOrder'] },
      },
    });

    res.json(user.Groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get single group by ID
exports.getGroupById = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, {
      include: {
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: ['role', 'payoutOrder'] },
      },
    });

    if (!group) return res.status(404).json({ message: 'Group not found' });

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Join a group
exports.joinGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Check if already joined
    const existing = await db.sequelize.models.GroupMembers.findOne({
      where: { UserId: userId, GroupId: groupId },
    });

    if (existing)
      return res.status(400).json({ message: 'You are already a member of this group' });

    const memberCount = await db.sequelize.models.GroupMembers.count({
      where: { GroupId: groupId },
    });

    await db.sequelize.models.GroupMembers.create({
      UserId: userId,
      GroupId: groupId,
      role: 'member',
      payoutOrder: memberCount + 1,
    });

    res.json({ message: 'Joined group successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all members of a group
exports.getGroupMembers = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, {
      include: {
        model: User,
        attributes: ['id', 'name', 'email'],
        through: { attributes: ['role', 'payoutOrder'] },
      },
    });

    if (!group) return res.status(404).json({ message: 'Group not found' });

    res.json(group.Users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
