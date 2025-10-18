const crypto = require('crypto');
const db = require('../models');
const Wallet = db.Wallet;
const Transaction = db.Transaction;

exports.paystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // ✅ Step 1: Verify signature
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.warn('Invalid Paystack signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    // ✅ Step 2: Check event type
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const amount = event.data.amount / 100; // convert from kobo

      console.log('🔔 Paystack webhook received for:', reference);

      // ✅ Step 3: Find matching transaction
      const transaction = await Transaction.findOne({ where: { reference } });
      if (!transaction) {
        console.warn('Transaction not found for reference:', reference);
        return res.status(404).json({ message: 'Transaction not found' });
      }

      // ✅ Step 4: Only update if still pending
      if (transaction.status !== 'success') {
        const wallet = await Wallet.findByPk(transaction.walletId);
        wallet.balance += amount;
        await wallet.save();

        transaction.status = 'success';
        await transaction.save();

        console.log(`✅ Wallet funded successfully for reference: ${reference}`);
      }
    }

    res.sendStatus(200); // Always respond 200 so Paystack stops retries

    if (event.event === 'transfer.success') {
  const reference = event.data.reference;
  const transaction = await Transaction.findOne({ where: { reference } });

  if (transaction && transaction.status !== 'success') {
    transaction.status = 'success';
    await transaction.save();
    console.log(`✅ Withdrawal confirmed: ${reference}`);
  }
}

if (event.event === 'transfer.failed') {
  const reference = event.data.reference;
  const transaction = await Transaction.findOne({ where: { reference } });

  if (transaction && transaction.status !== 'failed') {
    transaction.status = 'failed';
    await transaction.save();

    // refund wallet
    const wallet = await db.Wallet.findByPk(transaction.walletId);
    wallet.balance += transaction.amount;
    await wallet.save();

    console.log(`❌ Withdrawal failed — refunded wallet: ${reference}`);
  }
}

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
