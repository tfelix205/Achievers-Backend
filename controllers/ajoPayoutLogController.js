const db = require('../models');
const AjoPayoutLog = db.AjoPayoutLog;
const AjoGroup = db.AjoGroup;
const User = db.User;

// ✅ Get all payouts (admin)
exports.getAllPayouts = async (req, res) => {
  try {
    const logs = await AjoPayoutLog.findAll({
      include: [AjoGroup, User],
      order: [['payoutDate', 'DESC']],
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get payouts for a specific user
exports.getUserPayouts = async (req, res) => {
  try {
    const userId = req.user.id;
    const logs = await AjoPayoutLog.findAll({
      where: { userId },
      include: [AjoGroup],
      order: [['payoutDate', 'DESC']],
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get payouts for a specific group
exports.getGroupPayouts = async (req, res) => {
  try {
    const { groupId } = req.params;
    const logs = await AjoPayoutLog.findAll({
      where: { ajoGroupId: groupId },
      include: [User],
      order: [['payoutDate', 'DESC']],
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
