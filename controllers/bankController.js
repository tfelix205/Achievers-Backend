const axios = require('axios');
require('dotenv').config();

// ✅ Get all supported banks from Paystack
exports.getBanks = async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.paystack.co/bank?currency=NGN',
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const banks = response.data.data.map((bank) => ({
      name: bank.name,
      code: bank.code,
      slug: bank.slug,
      type: bank.type,
    }));

    res.json({ count: banks.length, banks });
  } catch (err) {
    console.error('Bank list fetch error:', err.response?.data || err.message);
    res.status(500).json({
      message: 'Failed to fetch bank list',
      error: err.response?.data || err.message,
    });
  }
};
