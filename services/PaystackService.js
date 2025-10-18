exports.createRecipient = async (user) => {
  const response = await axios.post(
    'https://api.paystack.co/transferrecipient',
    {
      type: 'nuban',
      name: `${user.firstName} ${user.lastName}`,
      account_number: user.accountNumber,
      bank_code: user.bankCode, // e.g., 058 for GTB
      currency: 'NGN',
    },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );
  return response.data.data.recipient_code;
};
//Save that recipient_code to user.recipientCode.