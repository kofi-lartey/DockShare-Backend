import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'failed', 'refunded'],
    default: 'pending'
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'express']
  },
  provider: {
    type: String,
    enum: ['stripe', 'paystack']
  },
  transactionRef: {
    type: String
  },
  description: {
    type: String
  },
  billingPeriod: {
    start: Date,
    end: Date
  },
  paidAt: {
    type: Date
  },
  pdfUrl: {
    type: String
  }
}, {
  timestamps: true
});

invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);