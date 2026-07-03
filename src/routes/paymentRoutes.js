import express from 'express';
import { verifyPaystackPayment } from '../controllers/subscriptionController.js';
import { auth } from '../middleware/auth.js';
import { downloadInvoice } from '../controllers/paymentController.js';

const paymentRoutes = express.Router();

paymentRoutes.get('/verify-paystack/:reference', verifyPaystackPayment);
paymentRoutes.get('/invoices/:id/download', auth, downloadInvoice);

export default paymentRoutes;
