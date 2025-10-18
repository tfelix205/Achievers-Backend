const db = require('../models');
const AjoGroup = db.AjoGroup;
const AjoMember = db.AjoMember;
const AjoContribution = db.AjoContribution;
const Wallet = db.Wallet;
const Transaction = db.Transaction;
const { processDuePayouts } = require('../services/ajoPayoutService');



// ✅ Create Ajo Group
exports.createAjoGroup = async (req, res) => {
  try {
    const { name, contributionAmount, frequency, memberLimit, totalCycle } = req.body;
    const userId = req.user.id;

    const group = await AjoGroup.create({
      name,
      contributionAmount,
      frequency,
      memberLimit,
      totalCycle,
      status: 'pending',
    });

    // Add creator as admin
    await AjoMember.create({
      userId,
      ajoGroupId: group.id,
      role: 'admin',
      payoutOrder: 1,
    });

    res.status(201).json({ message: 'Ajo group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create group', error: err.message });
  }
};

// ✅ Join Ajo Group
exports.joinAjoGroup = async (req, res) => {
  try {
    const ajoGroupId = req.params.id;
    const userId = req.user.id;

    const group = await AjoGroup.findByPk(ajoGroupId, { include: db.AjoMember });

    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.AjoMembers.length >= group.memberLimit)
      return res.status(400).json({ message: 'Group is full' });

    const alreadyMember = await AjoMember.findOne({ where: { ajoGroupId, userId } });
    if (alreadyMember)
      return res.status(400).json({ message: 'Already a member of this group' });

    await AjoMember.create({ userId, ajoGroupId });

    res.json({ message: 'Joined Ajo group successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Join failed', error: err.message });
  }
};

// ✅ Contribute to group
exports.contribute = async (req, res) => {
  try {
    const ajoGroupId = req.params.id;
    const userId = req.user.id;

    const group = await AjoGroup.findByPk(ajoGroupId);
    const wallet = await Wallet.findOne({ where: { userId } });

    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (wallet.balance < group.contributionAmount)
      return res.status(400).json({ message: 'Insufficient wallet balance' });

    wallet.balance -= group.contributionAmount;
    await wallet.save();

    await AjoContribution.create({
      ajoGroupId,
      userId,
      amount: group.contributionAmount,
    });

    await Transaction.create({
      walletId: wallet.id,
      type: 'contribution',
      amount: group.contributionAmount,
      status: 'success',
    });

    res.json({ message: 'Contribution successful', wallet });
  } catch (err) {
    res.status(500).json({ message: 'Contribution failed', error: err.message });
  }
};

// ✅ Get user's Ajo groups
exports.myAjoGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const memberships = await AjoMember.findAll({
      where: { userId },
      include: AjoGroup,
    });

    res.json(memberships.map((m) => m.AjoGroup));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user groups', error: err.message });
  }
};

// ✅ Get all groups
exports.getAllGroups = async (req, res) => {
  try {
    const groups = await AjoGroup.findAll({ include: AjoMember });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch groups', error: err.message });
  }
};

// ✅ Get one group details
exports.getGroupDetails = async (req, res) => {
  try {
    const group = await AjoGroup.findByPk(req.params.id, {
      include: [{ model: AjoMember, include: db.User }, AjoContribution],
    });

    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get group details', error: err.message });
  }
};




exports.runPayoutsManually = async (req, res) => {
  try {
    await processDuePayouts();
    res.json({ message: 'Payout processing completed.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
