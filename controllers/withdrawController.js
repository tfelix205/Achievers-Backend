const axios = require('axios');
const db = require('../models');
require('dotenv').config();

const Wallet = db.Wallet;
const Transaction = db.Transaction;

// ✅ Withdraw to Bank via Paystack
exports.withdrawToBank = async (req, res) => {
  try {
    const { amount, bankCode, accountNumber, accountName } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Invalid withdrawal amount' });

    if (!bankCode || !accountNumber || !accountName)
      return res
        .status(400)
        .json({ message: 'Bank code, account number and name required' });

    const wallet = await Wallet.findOne({ where: { userId } });

    if (wallet.balance < amount)
      return res.status(400).json({ message: 'Insufficient wallet balance' });

    // ✅ Step 1: Create transfer recipient
    const recipientResponse = await axios.post(
      `${process.env.PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const recipientCode = recipientResponse.data.data.recipient_code;

    // ✅ Step 2: Initiate transfer
    const transferResponse = await axios.post(
      `${process.env.PAYSTACK_BASE_URL}/transfer`,
      {
        source: 'balance',
        amount: amount * 100, // convert to kobo
        recipient: recipientCode,
        reason: 'Ajo Wallet Withdrawal',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const transfer = transferResponse.data.data;

    // ✅ Step 3: Record transaction and update wallet
    wallet.balance -= amount;
    await wallet.save();

    const transaction = await Transaction.create({
      walletId: wallet.id,
      type: 'withdraw',
      amount,
      reference: transfer.reference,
      status: 'pending', // will be updated via webhook
    });

    res.json({
      message: `Withdrawal of ₦${amount} initiated successfully`,
      transfer,
      transaction,
      wallet,
    });
  } catch (err) {
    console.error('Withdraw error:', err.response?.data || err.message);
    res.status(500).json({
      message: 'Withdrawal failed',
      error: err.response?.data || err.message,
    });
  }
};
