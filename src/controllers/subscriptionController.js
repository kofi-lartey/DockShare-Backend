import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { Invoice } from '../models/Invoice.js';
import { File } from '../models/File.js';
import { generateInvoiceNumber } from '../utils/helpers.js';
import { stripeService } from '../services/stripeService.js';
import { paystackService } from '../services/paystackService.js';

export const createSubscription = async (req, res) => {
  try {
    const { planId, paymentMethod, paymentMethodId } = req.body;
    const user = req.user;

    const validPlans = ['free', 'pro', 'express'];
    if (!validPlans.includes(planId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan'
      });
    }

    let paymentResult;
    let transactionRef = null;
    let provider = paymentMethod || 'stripe';

    if (planId !== 'free') {
      const prices = { pro: 20, express: 50 };
      const amount = prices[planId];

      if (provider === 'stripe') {
        const session = await stripeService.createCheckoutSession({
          planType: planId,
          userId: user._id,
          email: user.email,
        });
        transactionRef = session.id;
        paymentResult = { sessionUrl: session.url };
      } else if (provider === 'paystack') {
        const result = await paystackService.initializeTransaction({
          email: user.email,
          amount,
          planType: planId,
          userId: user._id,
        });
        transactionRef = result.data.reference;
        paymentResult = { authorizationUrl: result.data.authorization_url };
      }
    }

    let subscription = await Subscription.findOne({ userId: user._id });

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const prices = { free: 0, pro: 20, express: 50 };
    const currency = provider === 'paystack' ? 'GHS' : 'USD';

    if (subscription) {
      subscription.plan = planId;
      subscription.status = planId === 'free' ? 'active' : 'trialing';
      subscription.paymentMethodId = paymentMethodId;
      subscription.nextBillingDate = nextBillingDate;
      subscription.cancelAtPeriodEnd = false;
      subscription.provider = provider;
      subscription.transactionRef = transactionRef;
      subscription.lastPaymentDate = planId === 'free' ? new Date() : null;
      subscription.paymentHistory.push({
        date: new Date(),
        amount: prices[planId],
        status: planId === 'free' ? 'success' : 'pending',
        provider,
        transactionRef,
      });
      await subscription.save();
      subscription = await Subscription.findOne({ userId: user._id });
    } else {
      subscription = await Subscription.create({
        userId: user._id,
        plan: planId,
        status: planId === 'free' ? 'active' : 'trialing',
        paymentMethodId,
        provider,
        transactionRef,
        nextBillingDate,
        lastPaymentDate: planId === 'free' ? new Date() : null,
      });
    }

    user.plan = planId;
    user.subscriptionStatus = subscription.status;
    user.subscriptionStartDate = subscription.startDate;
    user.nextBillingDate = nextBillingDate;
    await user.save();

    const invoice = await Invoice.create({
      userId: user._id,
      invoiceNumber: generateInvoiceNumber(),
      amount: prices[planId],
      currency,
      status: planId === 'free' ? 'paid' : 'pending',
      plan: planId,
      provider,
      transactionRef,
      description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan Subscription`,
      billingPeriod: {
        start: new Date(),
        end: nextBillingDate,
      },
      paidAt: planId === 'free' ? new Date() : null,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          token: user.generateAuthToken(),
        },
        subscription,
        invoice,
        payment: paymentResult,
      },
      message: planId === 'free' ? 'Free plan activated' : 'Subscription created, complete payment',
    });
  } catch (error) {
    console.error('Subscription creation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription',
      error: error.message,
    });
  }
};

export const getSubscription = async (req, res) => {
  try {
    const user = req.user;
    const subscription = await Subscription.findOne({ userId: user._id });
    const usage = await File.getUserUsage(user._id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      data: {
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        nextBillingDate: subscription.nextBillingDate,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        usage: {
          uploads: usage.totalFiles,
          storage: usage.totalSize,
          teamMembers: 1
        }
      },
      message: 'Subscription details retrieved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription'
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    subscription.cancelAtPeriodEnd = true;
    if (subscription.plan !== 'free') {
      subscription.status = 'canceled';
    }
    await subscription.save();

    req.user.subscriptionStatus = subscription.status;
    await req.user.save();

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription canceled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-pdfUrl');
    
    res.json({
      success: true,
      data: invoices,
      message: 'Invoices retrieved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoices'
    });
  }
};