import { Coupon } from '../models/Coupon.js';

/**
 * Validates a coupon code against the requested plan and base amount without
 * mutating any records. Returns the discount breakdown or throws with a
 * user-facing message.
 */
export const validateCoupon = async (code, planId, baseAmount) => {
  if (!code) {
    const err = new Error('Coupon code is required');
    err.code = 'COUPON_REQUIRED';
    throw err;
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (!coupon) {
    const err = new Error('Invalid coupon code');
    err.code = 'COUPON_INVALID';
    throw err;
  }

  if (!coupon.active) {
    const err = new Error('This coupon is no longer active');
    err.code = 'COUPON_INACTIVE';
    throw err;
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    const err = new Error('This coupon is not active yet');
    err.code = 'COUPON_NOT_STARTED';
    throw err;
  }
  if (coupon.validTo && now > coupon.validTo) {
    const err = new Error('This coupon has expired');
    err.code = 'COUPON_EXPIRED';
    throw err;
  }

  if (coupon.appliesTo.length > 0 && !coupon.appliesTo.includes(planId)) {
    const err = new Error(`This coupon does not apply to the ${planId} plan`);
    err.code = 'COUPON_PLAN_MISMATCH';
    throw err;
  }

  if (baseAmount < coupon.minAmount) {
    const err = new Error(`Minimum purchase of ${coupon.minAmount} required for this coupon`);
    err.code = 'COUPON_MIN_AMOUNT';
    throw err;
  }

  if (coupon.maxRedemptions !== null && coupon.usedCount >= coupon.maxRedemptions) {
    const err = new Error('This coupon has reached its redemption limit');
    err.code = 'COUPON_LIMIT_REACHED';
    throw err;
  }

  const { discountAmount, finalAmount } = applyCoupon(coupon, baseAmount);

  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    baseAmount,
    discountAmount,
    finalAmount,
    currency: coupon.currency
  };
};

/**
 * Pure function that computes the discount for a base amount.
 */
export const applyCoupon = (coupon, baseAmount) => {
  let discountAmount;
  if (coupon.type === 'percentage') {
    discountAmount = Math.round(baseAmount * (coupon.value / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(coupon.value, baseAmount);
  }
  const finalAmount = Math.max(0, baseAmount - discountAmount);
  return { discountAmount, finalAmount };
};

/**
 * Idempotently increments a coupon's redemption count, keyed by the payment
 * transaction reference so webhooks don't double-count.
 */
export const redeemCoupon = async (code, transactionRef) => {
  if (!code) return false;
  const result = await Coupon.updateOne(
    { code: code.toUpperCase().trim(), usedCount: { $lt: couponMaxRedemptionsSelector() } },
    { $inc: { usedCount: 1 } }
  );
  return result.modifiedCount > 0;
};

// Helper to keep the update selector valid when maxRedemptions is null.
const couponMaxRedemptionsSelector = () => Number.MAX_SAFE_INTEGER;

export const couponService = { validateCoupon, applyCoupon, redeemCoupon };
