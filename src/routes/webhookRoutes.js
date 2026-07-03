import express from 'express';
import { handleStripeWebhook, handlePaystackWebhook } from '../controllers/webhookController.js';

const webhookRoutes = express.Router();

webhookRoutes.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
webhookRoutes.post('/paystack', express.raw({ type: 'application/json' }), handlePaystackWebhook);

export default webhookRoutes;