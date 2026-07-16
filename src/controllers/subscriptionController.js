import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { Invoice } from '../models/Invoice.js';
import { File } from '../models/File.js';
import { generateInvoiceNumber } from '../utils/helpers.js';
import { stripeService } from '../services/stripeService.js';
import { paystackService } from '../services/paystackService.js';
import { validateCoupon, redeemCoupon } from '../services/couponService.js';

export const createSubscription = async (req, res) => {
  try {
    const { planId, paymentMethod, paymentMethodId, couponCode } = req.body;
    const user = req.user;

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before selecting a plan',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    const validPlans = ['free', 'pro', 'express'];
    if (!validPlans.includes(planId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan'
      });
    }

    let couponResult = null;
    if (planId !== 'free' && couponCode) {
      const baseAmount = { pro: 20, express: 50 }[planId];
      try {
        couponResult = await validateCoupon(couponCode, planId, baseAmount);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
          code: err.code || 'COUPON_ERROR'
        });
      }
    }

    let paymentResult;
    let transactionRef = null;
    let provider = paymentMethod || 'stripe';

    // A coupon that brings the price to 0 means the user pays nothing, so we
    // skip the payment provider entirely and activate the plan immediately.
    const basePrices = { pro: 20, express: 50 };
    const amount = couponResult ? couponResult.finalAmount : basePrices[planId];
    const isFreeCoupon = planId !== 'free' && amount <= 0;

    if (planId !== 'free' && !isFreeCoupon) {
      if (provider === 'stripe') {
        const session = await stripeService.createCheckoutSession({
          planType: planId,
          userId: user._id,
          email: user.email,
          amount,
          couponCode: couponResult ? couponResult.code : undefined
        });
        transactionRef = session.id;
        paymentResult = { sessionUrl: session.url };
      } else if (provider === 'paystack') {
        const result = await paystackService.initializeTransaction({
          email: user.email,
          amount,
          planType: planId,
          userId: user._id,
          couponCode: couponResult ? couponResult.code : undefined
        });
        transactionRef = result.data.reference;
        paymentResult = { authorizationUrl: result.data.authorization_url };
      }
    }

    let subscription = await Subscription.findOne({ userId: user._id });

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const prices = { free: 0, pro: 20, express: 50 };
    const finalAmount = couponResult ? couponResult.finalAmount : prices[planId];
    const currency = provider === 'paystack' ? 'GHS' : 'USD';
    // The plan is active immediately when it's the free tier or a coupon
    // brought the price to 0 (no payment provider involved).
    const subscriptionActive = planId === 'free' || isFreeCoupon;

    if (subscription) {
      subscription.plan = planId;
      subscription.status = subscriptionActive ? 'active' : 'pending';
      subscription.paymentMethodId = paymentMethodId;
      subscription.nextBillingDate = nextBillingDate;
      subscription.cancelAtPeriodEnd = false;
      subscription.provider = provider;
      subscription.transactionRef = transactionRef;
      subscription.couponCode = couponResult ? couponResult.code : subscription.couponCode;
      subscription.couponRedeemed = subscription.couponRedeemed || isFreeCoupon;
      subscription.lastPaymentDate = subscriptionActive ? new Date() : null;
      subscription.paymentHistory.push({
        date: new Date(),
        amount: finalAmount,
        status: subscriptionActive ? 'success' : 'pending',
        provider,
        transactionRef,
        couponCode: couponResult ? couponResult.code : undefined
      });
      await subscription.save();
      subscription = await Subscription.findOne({ userId: user._id });
    } else {
      subscription = await Subscription.create({
        userId: user._id,
        plan: planId,
        status: subscriptionActive ? 'active' : 'pending',
        paymentMethodId,
        provider,
        transactionRef,
        couponCode: couponResult ? couponResult.code : undefined,
        couponRedeemed: isFreeCoupon,
        nextBillingDate,
        lastPaymentDate: subscriptionActive ? new Date() : null,
      });
    }

    user.plan = planId;
    user.subscriptionStatus = subscriptionActive ? 'active' : 'incomplete';
    user.subscriptionStartDate = subscription.startDate || new Date();
    user.nextBillingDate = nextBillingDate;
    await user.save();

    const invoice = await Invoice.create({
      userId: user._id,
      invoiceNumber: generateInvoiceNumber(),
      amount: finalAmount,
      currency,
      status: subscriptionActive ? 'paid' : 'pending',
      plan: planId,
      provider,
      transactionRef,
      couponCode: couponResult ? couponResult.code : undefined,
      description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan Subscription`,
      billingPeriod: {
        start: new Date(),
        end: nextBillingDate,
      },
      paidAt: subscriptionActive ? new Date() : null,
    });

    // For a zero-amount coupon there is no provider webhook, so redeem the
    // coupon inline exactly once (guarded by the subscription's couponRedeemed).
    if (isFreeCoupon && couponResult) {
      await redeemCoupon(couponResult.code, `freecoupon_${subscription._id}`);
    }

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
      message: isFreeCoupon
        ? 'Subscription activated with free coupon'
        : planId === 'free'
          ? 'Free plan activated'
          : 'Subscription created, complete payment',
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

export const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await paystackService.verifyTransaction(reference);
    
    if (result.data.status === 'success') {
      const subscription = await Subscription.findOne({ transactionRef: reference });
      
      if (subscription) {
        subscription.status = 'active';
        subscription.provider = 'paystack';
        await subscription.save();
        
        const user = await User.findById(subscription.userId);
        if (user) {
          user.subscriptionStatus = 'active';
          user.plan = subscription.plan;
          await user.save();
        }
        
        const invoice = await Invoice.findOne({ 
          transactionRef: reference, 
          provider: 'paystack' 
        });
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          await invoice.save();
        }
      }
      
      let userResp = null;
      if (req.user) {
        const userObj = req.user.toObject();
        delete userObj.password;
        delete userObj.emailVerificationToken;
        delete userObj.emailVerificationExpires;
        delete userObj.emailOTP;
        delete userObj.emailOTPExpires;
        delete userObj.emailOTPSentAt;
        delete userObj.resetPasswordToken;
        delete userObj.resetPasswordExpires;
        userResp = { ...userObj, token: req.user.generateAuthToken() };
      } else {
        const userData = subscription ? await User.findById(subscription.userId) : null;
        if (userData) {
          const userObj = userData.toObject();
          delete userObj.password;
          delete userObj.emailVerificationToken;
          delete userObj.emailVerificationExpires;
          delete userObj.emailOTP;
          delete userObj.emailOTPExpires;
          delete userObj.emailOTPSentAt;
          delete userObj.resetPasswordToken;
          delete userObj.resetPasswordExpires;
          userResp = { ...userObj, token: userData.generateAuthToken() };
        }
      }
      
      const invoice = subscription ? await Invoice.findOne({ 
        transactionRef: reference, 
        provider: 'paystack' 
      }) : null;
      let invoiceResp = null;
      if (invoice) {
        invoiceResp = { ...invoice.toObject() };
        delete invoiceResp.pdfUrl;
      }
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          ...result.data,
          user: userResp,
          subscription,
          invoice: invoiceResp
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Payment not successful',
        data: result.data
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};