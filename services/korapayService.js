const axios = require('axios');

class KorapayService {
  constructor() {
    this.baseURL = process.env.KORAPAY_BASE_URL || 'https://api.korapay.com/merchant/api/v1';
    this.secretKey = process.env.KORAPAY_SECRET_KEY;
    this.publicKey = process.env.KORAPAY_PUBLIC_KEY;
    this.maxRetries = 3; // Number of retry attempts for transient errors
  }

  // Helper to handle retries
  async _retryRequest(requestFn, attempt = 1) {
    try {
      return await requestFn();
    } catch (error) {
      if ((error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND') && attempt < this.maxRetries) {
        console.warn(`DNS/network error (attempt ${attempt}/${this.maxRetries}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // exponential backoff
        return this._retryRequest(requestFn, attempt + 1);
      }
      throw error;
    }
  }

  async initializePayment(data) {
    try {
      const response = await this._retryRequest(() =>
        axios.post(
          `${this.baseURL}/charges/initialize`,
          {
            amount: data.amount,
            currency: 'NGN',
            customer: {
              name: data.customerName,
              email: data.customerEmail
            },
            merchant_bears_cost: true,
            redirect_url: data.redirectUrl,
            reference: data.reference,
            metadata: data.metadata
          },
          {
            headers: {
              'Authorization': `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      return { success: true, data: response.data };

    } catch (error) {
      console.error('Korapay initialization error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async verifyPayment(reference) {
    try {
      const response = await this._retryRequest(() =>
        axios.get(
          `${this.baseURL}/charges/${reference}`,
          {
            headers: { 'Authorization': `Bearer ${this.secretKey}` }
          }
        )
      );

      return { success: true, data: response.data };

    } catch (error) {
      console.error('Korapay verification error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async initiatePayout(data) {
    try {
      const response = await this._retryRequest(() =>
        axios.post(
          `${this.baseURL}/transactions/disburse`,
          {
            reference: data.reference,
            destination: {
              type: 'bank_account',
              amount: data.amount,
              currency: 'NGN',
              narration: data.narration,
              bank_account: {
                bank: data.bankCode,
                account: data.accountNumber
              },
              customer: {
                name: data.customerName,
                email: data.customerEmail
              }
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      return { success: true, data: response.data };

    } catch (error) {
      console.error('Korapay payout error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }
}

module.exports = new KorapayService();
