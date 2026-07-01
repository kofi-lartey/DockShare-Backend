import axios from 'axios';

const PAYSTACK_API_URL = 'https://api.paystack.co';

const headers = {
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

export const paystackService = {
  initializeTransaction: async ({ email, amount, planType, userId }) => {
    const response = await axios.post(
      `${PAYSTACK_API_URL}/transaction/initialize`,
      {
        email,
        amount: amount * 100,
        metadata: {
          userId: userId.toString(),
          plan: planType,
        },
        callback_url: `${process.env.FRONTEND_URL}/dashboard`,
      },
      { headers }
    );
    return response.data;
  },

  verifyTransaction: async (reference) => {
    const response = await axios.get(
      `${PAYSTACK_API_URL}/transaction/verify/${reference}`,
      { headers }
    );
    return response.data;
  },

  getTransaction: async (reference) => {
    const response = await axios.get(
      `${PAYSTACK_API_URL}/transaction/${reference}`,
      { headers }
    );
    return response.data.data;
  },

  verifyWebhook: (signature) => {
    return signature === process.env.PAYSTACK_WEBHOOK_SECRET;
  },
};