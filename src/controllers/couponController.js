import { Coupon } from '../models/Coupon.js';
import { validateCoupon } from '../services/couponService.js';

/**
 * Verifies a coupon for a given plan without redeeming it. Returns the
 * discount breakdown the client can display before checkout.
 */
export const verifyCoupon = async (req, res) => {
  try {
    const { code, planId, baseAmount } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required' });
    }

    const result = await validateCoupon(code, planId, Number(baseAmount) || 0);
    res.json({
      success: true,
      data: result,
      message: 'Coupon applied'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Invalid coupon',
      code: error.code || 'COUPON_ERROR'
    });
  }
};

/**
 * Admin-only: creates a new coupon. Nowhere in the client calls this; it is
 * exposed for operational use via the admin allowlist.
 */
export const createCoupon = async (req, res) => {
  try {
    const {
      code, type, value, currency, appliesTo, minAmount,
      maxRedemptions, validFrom, validTo, description
    } = req.body;

    if (!code || !type || value === undefined) {
      return res.status(400).json({ success: false, message: 'code, type and value are required' });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code,
      type,
      value,
      currency,
      appliesTo: appliesTo || [],
      minAmount: minAmount || 0,
      maxRedemptions: maxRedemptions ?? null,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined,
      description,
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: coupon, message: 'Coupon created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create coupon' });
  }
};

export const couponController = { verifyCoupon, createCoupon };
