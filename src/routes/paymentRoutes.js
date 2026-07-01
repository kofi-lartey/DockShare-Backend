import express from 'express';
import { verifyPaystackPayment } from '../controllers/subscriptionController.js';

const paymentRoutes = express.Router();

paymentRoutes.get('/verify-paystack/:reference', verifyPaystackPayment);

export default paymentRoutes;
