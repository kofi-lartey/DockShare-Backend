import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'express'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'trialing', 'canceled', 'past_due'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  nextBillingDate: {
    type: Date
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  paymentMethodId: {
    type: String
  },
  provider: {
    type: String,
    enum: ['stripe', 'paystack'],
    default: 'stripe'
  },
  transactionRef: {
    type: String
  },
  lastPaymentDate: {
    type: Date
  },
  paymentHistory: [{
    date: { type: Date, default: Date.now },
    amount: { type: Number },
    status: { type: String, enum: ['success', 'failed', 'pending'] },
    provider: { type: String, enum: ['stripe', 'paystack'] },
    transactionRef: String
  }]
}, {
  timestamps: true
});

subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);