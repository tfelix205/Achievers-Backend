const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const Wallet = db.Wallet;
const Transaction = db.Transaction;

// ✅ Get wallet balance
exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({
      where: { userId: req.user.id },
      include: { model: Transaction, limit: 5, order: [['date', 'DESC']] },
    });

    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    res.json(wallet);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Fund wallet (manual mock version)
exports.fundWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Invalid amount' });

    const wallet = await Wallet.findOne({ where: { userId } });

    wallet.balance += amount;
    await wallet.save();

    const transaction = await Transaction.create({
      walletId: wallet.id,
      type: 'fund',
      amount,
      reference: `TXN-${uuidv4()}`,
    });

    res.status(201).json({
      message: `Wallet funded with ₦${amount}`,
      wallet,
      transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Withdraw funds
exports.withdraw = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Invalid amount' });

    const wallet = await Wallet.findOne({ where: { userId } });

    if (wallet.balance < amount)
      return res.status(400).json({ message: 'Insufficient balance' });

    wallet.balance -= amount;
    await wallet.save();

    const transaction = await Transaction.create({
      walletId: wallet.id,
      type: 'withdraw',
      amount,
      reference: `TXN-${uuidv4()}`,
    });

    res.json({
      message: `₦${amount} withdrawn successfully`,
      wallet,
      transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Transaction history
exports.getTransactions = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ where: { userId: req.user.id } });

    const transactions = await Transaction.findAll({
      where: { walletId: wallet.id },
      order: [['date', 'DESC']],
    });

    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
