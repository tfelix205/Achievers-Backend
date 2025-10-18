const db = require('../models');
const { Op } = require('sequelize');
const { AjoGroup, AjoMember, AjoContribution, Wallet, Transaction, sequelize } = db;
const axios = require('axios');
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

// 🔁 This function will run periodically (e.g., every day)
exports.processDuePayouts = async () => {
  console.log('⏳ Checking for due Ajo payouts...');

  // Get all Ajo groups whose next payout date has arrived
  const dueGroups = await AjoGroup.findAll({
    where: { nextPayoutDate: { [Op.lte]: new Date() }, status: 'active' },
    include: [{ model: AjoMember, include: db.User }],
  });

  for (const group of dueGroups) {
    await processAjoPayout(group);
  }
};

// 🧠 Internal function to handle a single group payout
async function processAjoPayout(group) {
  console.log(`⚙️ Processing Ajo group: ${group.name}`);

  // Find next eligible member
  const nextMember = group.AjoMembers.find(
    (m) => !m.hasReceived && m.payoutOrder === group.currentCycle + 1
  );

  if (!nextMember) {
    console.log(`✅ All members have received payout for ${group.name}.`);
    group.status = 'completed';
    await group.save();
    return;
  }

  // Calculate total contribution amount
  const totalPayout = group.contributionAmount * group.memberLimit;

  // Start transaction for safety
  const t = await sequelize.transaction();

  try {
    // Deduct contributions from all members’ wallets
    for (const member of group.AjoMembers) {
      const wallet = await Wallet.findOne({ where: { userId: member.userId }, transaction: t });
      if (wallet.balance < group.contributionAmount)
        throw new Error(`User ${member.userId} has insufficient balance.`);

      wallet.balance -= group.contributionAmount;
      await wallet.save({ transaction: t });

      await AjoContribution.create({
        ajoGroupId: group.id,
        userId: member.userId,
        amount: group.contributionAmount,
      }, { transaction: t });

      await Transaction.create({
        walletId: wallet.id,
        type: 'ajo_contribution',
        amount: group.contributionAmount,
        status: 'success',
      }, { transaction: t });
    }

    // Credit payout to the next eligible member
    const winnerWallet = await Wallet.findOne({ where: { userId: nextMember.userId }, transaction: t });
    winnerWallet.balance += totalPayout;
    await winnerWallet.save({ transaction: t });

    await Transaction.create({
      walletId: winnerWallet.id,
      type: 'ajo_payout',
      amount: totalPayout,
      status: 'success',
    }, { transaction: t });

    // Update group + member state
    group.currentCycle += 1;
    group.nextPayoutDate = getNextPayoutDate(group.frequency);
    await group.save({ transaction: t });

    nextMember.hasReceived = true;
    await nextMember.save({ transaction: t });

    await t.commit();
    console.log(`💰 Payout of ₦${totalPayout} sent to user ${nextMember.userId}.`);
  } catch (err) {
    await t.rollback();
    console.error(`❌ Failed processing group ${group.name}:`, err.message);
  }
}

// 🕒 Helper to compute next payout date
function getNextPayoutDate(frequency) {
  const date = new Date();
  if (frequency === 'daily') date.setDate(date.getDate() + 1);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  return date;
}



// ✅ Helper to initiate Paystack transfer
async function initiatePaystackTransfer(amount, recipientCode, reason) {
  try {
    const response = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: Math.floor(amount * 100), // convert to kobo
        recipient: recipientCode,
        reason,
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    return response.data;
  } catch (err) {
    console.error('Paystack Transfer Error:', err.response?.data || err.message);
    throw err;
  }
}

// 🧠 Internal function to process one Ajo payout
async function processAjoPayout(group) {
  const members = await AjoMember.findAll({ where: { ajoGroupId: group.id }, include: db.User });
  const nextMember = members.find(m => !m.hasReceived && m.payoutOrder === group.currentCycle + 1);
  if (!nextMember) {
    group.status = 'completed';
    await group.save();
    return;
  }

  const total = group.contributionAmount * members.length;
  const commission = (group.commissionRate / 100) * total;
  const payoutAmount = total - commission;

  const t = await sequelize.transaction();
  try {
    // 1️⃣ Deduct contributions from all members
    for (const m of members) {
      const wallet = await Wallet.findOne({ where: { userId: m.userId }, transaction: t });
      if (wallet.balance < group.contributionAmount)
        throw new Error(`User ${m.userId} insufficient funds`);
      wallet.balance -= group.contributionAmount;
      await wallet.save({ transaction: t });

      await Transaction.create({
        walletId: wallet.id,
        type: 'ajo_contribution',
        amount: group.contributionAmount,
        status: 'success',
      }, { transaction: t });
    }

    // 2️⃣ Credit payout wallet
    const payoutWallet = await Wallet.findOne({ where: { userId: nextMember.userId }, transaction: t });
    payoutWallet.balance += payoutAmount;
    await payoutWallet.save({ transaction: t });

    // 3️⃣ Log payout transaction
    await Transaction.create({
      walletId: payoutWallet.id,
      type: 'ajo_payout',
      amount: payoutAmount,
      status: 'success',
    }, { transaction: t });

    // 4️⃣ Update group state
    group.currentCycle += 1;
    group.nextPayoutDate = getNextPayoutDate(group.frequency);
    await group.save({ transaction: t });

    nextMember.hasReceived = true;
    await nextMember.save({ transaction: t });

    // 5️⃣ Commit before external call
    await t.commit();

    console.log(`💸 Paid ₦${payoutAmount} (after ₦${commission} commission) to user ${nextMember.userId}`);

    // 6️⃣ Send actual Paystack transfer
    const recipientCode = nextMember.User.recipientCode; // saved during KYC
    if (recipientCode) {
      const transferResponse = await initiatePaystackTransfer(
        payoutAmount,
        recipientCode,
        `Ajo payout for group: ${group.name}`
      );
      console.log('✅ Paystack Transfer:', transferResponse);
    }
    await db.AjoPayoutLog.create({
  ajoGroupId: group.id,
  userId: nextMember.userId,
  amount: payoutAmount,
  commission,
  paymentMethod: recipientCode ? 'paystack' : 'wallet',
  paystackTransferCode: transferResponse?.data?.transfer_code || null,
  status: 'success',
  payoutDate: new Date(),
});


  } catch (err) {
    await t.rollback();
    console.error('❌ Payout processing failed:', err.message);
  }
}

function getNextPayoutDate(frequency) {
  const d = new Date();
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

exports.processAjoPayout = processAjoPayout;
