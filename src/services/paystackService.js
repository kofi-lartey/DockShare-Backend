import axios from 'axios';
import crypto from 'crypto';

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

  verifyWebhook: (signature, body) => {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) return true;
    const hmac = crypto.createHmac('sha512', secret);
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const hash = hmac.update(payload).digest('hex');
    return signature === hash;
  },
};