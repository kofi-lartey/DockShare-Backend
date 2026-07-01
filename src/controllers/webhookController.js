import { stripeService } from '../services/stripeService.js';
import { paystackService } from '../services/paystackService.js';
import { Subscription } from '../models/Subscription.js';
import { Invoice } from '../models/Invoice.js';
import { User } from '../models/User.js';

export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
  try {
    const event = stripeService.verifyWebhook(req.body, signature);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const plan = session.metadata.plan;
        
        const subscription = await Subscription.findOne({ userId });
        if (subscription) {
          subscription.status = 'active';
          subscription.provider = 'stripe';
          subscription.transactionRef = session.id;
          await subscription.save();
        }
        
        const invoice = await Invoice.findOne({ 
          userId, 
          status: 'pending',
          provider: 'stripe'
        });
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          await invoice.save();
        }
        
        const user = await User.findById(userId);
        if (user) {
          user.subscriptionStatus = 'active';
          await user.save();
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoiceData = event.data.object;
        const invoiceRecord = await Invoice.findOne({ 
          transactionRef: invoiceData.subscription
        });
        if (invoiceRecord) {
          invoiceRecord.status = 'paid';
          invoiceRecord.paidAt = new Date();
          await invoiceRecord.save();
        }
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoiceData = event.data.object;
        const subscription = await Subscription.findOne({ 
          transactionRef: invoiceData.subscription
        });
        if (subscription) {
          subscription.status = 'past_due';
          await subscription.save();
          
          const user = await User.findById(subscription.userId);
          if (user) {
            user.subscriptionStatus = 'past_due';
            await user.save();
          }
        }
        break;
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: 'Webhook error' });
  }
};

export const handlePaystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  
  if (!paystackService.verifyWebhook(signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const event = req.body;
  
  try {
    switch (event.event) {
      case 'charge.success': {
        const charge = event.data;
        const reference = charge.reference;
        
        const invoice = await Invoice.findOne({ 
          transactionRef: reference,
          provider: 'paystack'
        });
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          await invoice.save();
        }
        
        const subscription = await Subscription.findOne({ userId: invoice?.userId });
        if (subscription) {
          subscription.status = 'active';
          await subscription.save();
          
          const user = await User.findById(subscription.userId);
          if (user) {
            user.subscriptionStatus = 'active';
            await user.save();
          }
        }
        break;
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: 'Webhook error' });
  }
};