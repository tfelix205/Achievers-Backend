const axios = require('axios');
const db = require('../models');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const Wallet = db.Wallet;
const Transaction = db.Transaction;

// ✅ Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Invalid amount' });

    const reference = `PSK-${uuidv4()}`;

    // Send request to Paystack
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: amount * 100, // Paystack expects kobo
        reference,
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save pending transaction
    const wallet = await Wallet.findOne({ where: { userId: user.id } });
    await Transaction.create({
      walletId: wallet.id,
      type: 'fund',
      amount,
      reference,
      status: 'pending',
    });

    res.json({
      authorization_url: response.data.data.authorization_url,
      reference,
    });
  } catch (err) {
    console.error('Paystack init error:', err.response?.data || err.message);
    res.status(500).json({
      message: 'Payment initialization failed',
      error: err.response?.data || err.message,
    });
  }
};

// ✅ Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data.data;

    if (data.status !== 'success')
      return res.status(400).json({ message: 'Payment not successful yet' });

    // Update wallet and transaction
    const transaction = await Transaction.findOne({ where: { reference } });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (transaction.status === 'success')
      return res.json({ message: 'Already verified', transaction });

    const wallet = await Wallet.findByPk(transaction.walletId);
    wallet.balance += transaction.amount;
    await wallet.save();

    transaction.status = 'success';
    await transaction.save();

    res.json({
      message: 'Payment verified and wallet funded',
      wallet,
      transaction,
    });
  } catch (err) {
    console.error('Paystack verify error:', err.response?.data || err.message);
    res.status(500).json({
      message: 'Payment verification failed',
      error: err.response?.data || err.message,
    });
  }
};
