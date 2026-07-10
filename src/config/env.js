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
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
export const CLOUDINARY_UPLOAD_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER || 'docshare';

// ClamAV / clamd integration
// Opt-in: scanning only runs when explicitly enabled. This prevents uploads
// from failing on deployments where clamd is not running.
export const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED === 'true';
export const CLAMAV_HOST = process.env.CLAMAV_HOST || '127.0.0.1';
export const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310', 10);
export const CLAMAV_TIMEOUT_MS = parseInt(process.env.CLAMAV_TIMEOUT_MS || '30000', 10);
// 'closed' (default) rejects uploads when the scanner is unavailable/errors;
// 'open' allows uploads through when scanning cannot be performed.
export const CLAMAV_FAIL_MODE = process.env.CLAMAV_FAIL_MODE || 'closed';