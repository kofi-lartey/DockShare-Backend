import { Coupon } from '../models/Coupon.js';
import { Subscription } from '../models/Subscription.js';
import { logAudit } from '../services/adminAuditService.js';

// Revenue influenced by each coupon, derived from successful payment history.
const revenueByCoupon = async (codes) => {
  if (!codes.length) return {};
  const rows = await Subscription.aggregate([
    { $unwind: '$paymentHistory' },
    { $match: { 'paymentHistory.couponCode': { $in: codes }, 'paymentHistory.status': 'success' } },
    { $group: { _id: '$paymentHistory.couponCode', revenue: { $sum: '$paymentHistory.amount' } } }
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.revenue]));
};

export const listCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    const revMap = await revenueByCoupon(coupons.map((c) => c.code));
    const data = coupons.map((c) => ({
      ...c,
      redemptions: c.usedCount,
      revenueImpact: revMap[c.code] || 0
    }));
    res.json({ success: true, data: { coupons: data } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve coupons' });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const {
      code, type, value, currency, appliesTo, minAmount,
      maxRedemptions, validFrom, validTo, description
    } = req.body;

    if (!code || !type || value === undefined) {
      return res.status(400).json({ success: false, message: 'code, type and value are required' });
    }
    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon type' });
    }
    if (await Coupon.exists({ code: code.toUpperCase().trim() })) {
      return res.status(409).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code,
      type,
      value: Number(value),
      currency: currency || 'GHS',
      appliesTo: appliesTo || [],
      minAmount: Number(minAmount) || 0,
      maxRedemptions: maxRedemptions ?? null,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined,
      description,
      createdBy: req.user._id
    });

    await logAudit({ actor: req.user.email, action: 'coupon.create', target: coupon.code, ip: req.ip });
    res.status(201).json({ success: true, data: coupon, message: 'Coupon created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create coupon' });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const {
      code, type, value, currency, appliesTo, minAmount,
      maxRedemptions, validFrom, validTo, description, active
    } = req.body;

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    if (code !== undefined) coupon.code = code.toUpperCase().trim();
    if (type !== undefined) coupon.type = type;
    if (value !== undefined) coupon.value = Number(value);
    if (currency !== undefined) coupon.currency = currency;
    if (appliesTo !== undefined) coupon.appliesTo = appliesTo;
    if (minAmount !== undefined) coupon.minAmount = Number(minAmount);
    if (maxRedemptions !== undefined) coupon.maxRedemptions = maxRedemptions;
    if (validFrom !== undefined) coupon.validFrom = validFrom ? new Date(validFrom) : coupon.validFrom;
    if (validTo !== undefined) coupon.validTo = validTo ? new Date(validTo) : coupon.validTo;
    if (description !== undefined) coupon.description = description;
    if (active !== undefined) coupon.active = active;

    await coupon.save();
    await logAudit({ actor: req.user.email, action: 'coupon.update', target: coupon.code, ip: req.ip });

    res.json({ success: true, data: coupon, message: 'Coupon updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    const code = coupon.code;
    await Coupon.findByIdAndDelete(req.params.id);
    await logAudit({ actor: req.user.email, action: 'coupon.delete', target: code, ip: req.ip });

    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
};

export const adminCouponController = { listCoupons, createCoupon, updateCoupon, deleteCoupon };
