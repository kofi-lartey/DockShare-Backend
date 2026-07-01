import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const MONGODB_URI = process.env.MONGODB_URI;
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
export const STRIPE_EXPRESS_PRICE_ID = process.env.STRIPE_EXPRESS_PRICE_ID;
export const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
export const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;