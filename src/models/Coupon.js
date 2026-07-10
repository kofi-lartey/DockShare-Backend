import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'GHS'
  },
  // Plans this coupon applies to. Empty array = all plans.
  appliesTo: {
    type: [String],
    enum: ['pro', 'express'],
    default: []
  },
  minAmount: {
    type: Number,
    default: 0
  },
  maxRedemptions: {
    type: Number,
    default: null
  },
  usedCount: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validTo: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: String
}, {
  timestamps: true
});

couponSchema.index({ code: 1 });
couponSchema.index({ active: 1 });

export const Coupon = mongoose.model('Coupon', couponSchema);
