import express from 'express';
import { 
  createSubscription, 
  getSubscription, 
  cancelSubscription, 
  getInvoices,
  verifyPaystackPayment
} from '../controllers/subscriptionController.js';
import { auth } from '../middleware/auth.js';

const subscriptionRoutes = express.Router();

subscriptionRoutes.use(auth);

subscriptionRoutes.get('/', getSubscription);
subscriptionRoutes.post('/', createSubscription);
subscriptionRoutes.post('/cancel', cancelSubscription);
subscriptionRoutes.get('/invoices', getInvoices);
subscriptionRoutes.get('/verify-paystack/:reference', verifyPaystackPayment);

export default subscriptionRoutes;