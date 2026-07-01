import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const stripeService = {
  createCheckoutSession: async ({ planType, userId, email }) => {
    const prices = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      express: process.env.STRIPE_EXPRESS_PRICE_ID,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: prices[planType],
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId.toString(),
        plan: planType,
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
    });

    return session;
  },

  createCustomer: async ({ email, name }) => {
    const customer = await stripe.customers.create({
      email,
      name,
    });
    return customer;
  },

  retrieveSession: async (sessionId) => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  },

  constructEvent: (payload, signature) => {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  },

  verifyWebhook: (payload, signature) => {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      throw new Error('Invalid webhook signature');
    }
  },
};