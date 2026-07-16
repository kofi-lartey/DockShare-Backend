import { User } from '../models/User.js';
import { File } from '../models/File.js';
import { Coupon } from '../models/Coupon.js';
import { Subscription } from '../models/Subscription.js';
import { DownloadEvent } from '../models/DownloadEvent.js';
import { AuditLog } from '../models/AuditLog.js';

const MRR_BY_PLAN = { free: 0, pro: 19, express: 49 };

export const getAnalytics = async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 86400000);

    const [
      totalUsers, activeUsers, newUsers7d,
      subs, couponAgg, fileAgg, dlGeo, signups
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
      Subscription.find({ status: 'active' }).lean(),
      Coupon.aggregate([{ $group: { _id: null, used: { $sum: '$usedCount' } } }]),
      File.aggregate([{ $group: { _id: null, views: { $sum: '$views' }, size: { $sum: '$size' } } }]),
      DownloadEvent.aggregate([
        { $match: { country: { $ne: null } } },
        { $group: { _id: '$country', value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $limit: 5 }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    const mrr = subs.reduce((sum, s) => sum + (MRR_BY_PLAN[s.plan] || 0), 0);

    const [totalRevenue, revenueSeries, planMix, payments] = await Promise.all([
      Subscription.aggregate([
        { $unwind: '$paymentHistory' },
        { $match: { 'paymentHistory.status': 'success' } },
        { $group: { _id: null, total: { $sum: '$paymentHistory.amount' } } }
      ]),
      Subscription.aggregate([
        { $unwind: '$paymentHistory' },
        { $match: { 'paymentHistory.status': 'success', 'paymentHistory.date': { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentHistory.date' } }, count: { $sum: '$paymentHistory.amount' } } },
        { $sort: { _id: 1 } }
      ]),
      Subscription.aggregate([{ $group: { _id: '$plan', value: { $sum: 1 } } }]),
      Subscription.aggregate([
        { $unwind: '$paymentHistory' },
        { $match: { 'paymentHistory.couponCode': { $exists: true }, 'paymentHistory.status': 'success' } },
        { $group: { _id: '$paymentHistory.couponCode', revenue: { $sum: '$paymentHistory.amount' } } }
      ])
    ]);

    const revMap = Object.fromEntries(payments.map((p) => [p._id, p.revenue]));
    const coupons = await Coupon.find().select('code usedCount').lean();
    const couponPerformance = coupons.map((c) => ({
      code: c.code,
      redemptions: c.usedCount,
      revenueImpact: revMap[c.code] || 0
    }));

    res.json({
      success: true,
      data: {
        kpis: {
          totalUsers,
          activeUsers,
          newUsers7d,
          mrr,
          totalRevenue: totalRevenue[0]?.total || 0,
          couponRedemptions: couponAgg[0]?.used || 0,
          fileViews: fileAgg[0]?.views || 0,
          storageUsed: fileAgg[0]?.size || 0
        },
        signupsSeries: signups.map((s) => ({ date: s._id, count: s.count })),
        revenueSeries: revenueSeries.map((s) => ({ date: s._id, count: s.count })),
        planMix: planMix.map((p) => ({
          plan: p._id ? p._id.charAt(0).toUpperCase() + p._id.slice(1) : 'Unknown',
          value: p.value
        })),
        couponPerformance,
        topCountries: dlGeo.map((d) => ({ country: d._id, value: d.value }))
      },
      message: 'Analytics retrieved'
    });
  } catch (error) {
    console.error('Admin analytics error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve analytics' });
  }
};

const normalizeAuditRow = (row) => {
  const at = row.at instanceof Date ? row.at : new Date(row.at);
  const atValid = at instanceof Date && !Number.isNaN(at.getTime());
  return {
    ...row,
    at: atValid ? at.toISOString() : null,
    actor: row.actor || null,
    target: row.target ?? null,
    ip: row.ip ?? null,
    method: row.method ?? null,
  };
};

export const getAuditLog = async (req, res) => {
  try {
    const rows = await AuditLog.find().sort({ at: -1 }).limit(100).lean();
    const log = rows.map(normalizeAuditRow);
    res.json({ success: true, data: { log } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve audit log' });
  }
};

export const adminAnalyticsController = { getAnalytics, getAuditLog };
