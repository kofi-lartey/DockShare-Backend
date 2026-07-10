import { File } from '../models/File.js';
import { User } from '../models/User.js';
import { DownloadEvent } from '../models/DownloadEvent.js';
import { getClientIP, hashIP, anonymizeIP } from '../utils/helpers.js';
import { lookupGeo } from '../services/geoService.js';

const RETENTION_DAYS = { free: 7, pro: 90, express: 365 };

/**
 * Records a download event, honouring the file owner's privacy consent.
 *  - analytics not consented  -> nothing is stored.
 *  - geoTracking not consented -> only a hashed IP is kept, no geolocation.
 *  - DNT header                -> treated like analytics-not-consented.
 */
export const trackDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findOne({ $or: [{ _id: id }, { shareableLink: id }] })
      .select('userId status name')
      .lean();

    if (!file || file.status === 'deleted') {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const owner = await User.findById(file.userId).select('plan privacyConsent').lean();
    const consent = owner?.privacyConsent || {};
    const dnt = req.headers['dnt'] === '1' || req.headers['dnt'] === '1';

    const analyticsConsented = consent.analytics === true && !dnt;
    if (!analyticsConsented) {
      // Count the download for the owner's totals, but store no PII.
      await File.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } });
      return res.status(200).json({ success: true, tracked: false });
    }

    const ip = getClientIP(req);
    const geoConsented = consent.geoTracking === true;
    const geo = geoConsented ? lookupGeo(ip) : { country: null, region: null, city: null };

    const retentionDays = RETENTION_DAYS[owner?.plan] || RETENTION_DAYS.free;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    await DownloadEvent.create({
      fileId: file._id,
      ownerId: file.userId,
      downloadedBy: req.user ? req.user._id : null,
      timestamp: new Date(),
      ipHash: hashIP(ip) || anonymizeIP(ip),
      userAgent: req.headers['user-agent'] || null,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      geoConsented,
      consentVersion: consent.consentVersion || null,
      expiresAt
    });

    await File.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } });

    res.status(200).json({ success: true, tracked: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to track download' });
  }
};

/**
 * Owner-facing download analytics (counts + coarse geo distribution).
 * Only returns aggregates; raw events with PII are never exposed here.
 */
export const getDownloadAnalytics = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const [totals, byCountry, recent] = await Promise.all([
      DownloadEvent.aggregate([
        { $match: { ownerId } },
        { $group: { _id: '$fileId', count: { $sum: 1 } } },
        { $group: { _id: null, totalDownloads: { $sum: '$count' }, uniqueFiles: { $sum: 1 } } }
      ]),
      DownloadEvent.aggregate([
        { $match: { ownerId, country: { $ne: null } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      DownloadEvent.find({ ownerId })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('fileId timestamp country')
        .lean()
    ]);

    const fileIds = recent.map((r) => r.fileId);
    const files = await File.find({ _id: { $in: fileIds } }).select('name').lean();
    const fileMap = Object.fromEntries(files.map((f) => [f._id.toString(), f.name]));

    res.json({
      success: true,
      data: {
        totalDownloads: totals[0]?.totalDownloads || 0,
        uniqueFiles: totals[0]?.uniqueFiles || 0,
        byCountry,
        recent: recent.map((r) => ({
          fileId: r.fileId,
          fileName: fileMap[r.fileId.toString()] || 'Unknown',
          country: r.country,
          timestamp: r.timestamp
        }))
      },
      message: 'Download analytics retrieved'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve analytics' });
  }
};

export const analyticsController = { trackDownload, getDownloadAnalytics };
