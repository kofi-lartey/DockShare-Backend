import { ViewEvent } from '../models/ViewEvent.js';
import { File } from '../models/File.js';
import { User } from '../models/User.js';

// Maximum number of entries kept inline on the File document for quick
// display. The durable, TTL-expiring history lives in ViewEvent.
const INLINE_VIEW_CACHE = 20;

const RETENTION_DAYS = {
  free: 7,
  pro: 90,
  express: 365
};

const getRetentionDays = async (userId) => {
  if (!userId) return RETENTION_DAYS.free;
  const user = await User.findById(userId).select('plan').lean();
  return RETENTION_DAYS[user?.plan] || RETENTION_DAYS.free;
};

/**
 * Records a single view. Performs two writes:
 *  1. Bounded inline cache on the File doc (sliced to INLINE_VIEW_CACHE).
 *  2. A durable ViewEvent that auto-expires via the TTL index.
 * Both writes are atomic per-collection and fire-and-forget safe.
 */
export const recordView = async (fileId, viewerInfo = {}) => {
  const file = await File.findById(fileId).select('userId').lean();
  if (!file) return;

  const retentionDays = await getRetentionDays(file.userId);
  const timestamp = new Date();
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  const entry = {
    timestamp,
    ip: viewerInfo.ip || null,
    userAgent: viewerInfo.userAgent || null
  };

  await File.updateOne(
    { _id: fileId },
    {
      $inc: { views: 1 },
      $set: { lastViewedAt: timestamp },
      $push: { viewHistory: { $each: [entry], $slice: -INLINE_VIEW_CACHE } }
    }
  );

  await ViewEvent.create({
    fileId,
    userId: file.userId,
    timestamp,
    ip: entry.ip,
    userAgent: entry.userAgent,
    expiresAt
  });
};

/**
 * Returns paginated, full view history from the durable collection.
 */
export const getViewHistory = async (fileId, { page = 1, limit = 25 } = {}) => {
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [events, total] = await Promise.all([
    ViewEvent.find({ fileId }).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit, 10)),
    ViewEvent.countDocuments({ fileId })
  ]);

  return {
    events,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit)
  };
};

/**
 * Hard-deletes ViewEvents for files that no longer exist (e.g. deleted files
 * whose TTL hasn't fired yet). Intended to run from the TTL cleanup job.
 */
export const pruneOrphanedViewEvents = async () => {
  const orphaned = await ViewEvent.aggregate([
    { $sort: { fileId: 1 } },
    {
      $lookup: {
        from: 'files',
        localField: 'fileId',
        foreignField: '_id',
        as: 'file'
      }
    },
    { $match: { file: { $size: 0 } } },
    { $project: { _id: 1 } },
    { $limit: 1000 }
  ]);

  if (!orphaned.length) return 0;
  const ids = orphaned.map((e) => e._id);
  const result = await ViewEvent.deleteMany({ _id: { $in: ids } });
  return result.deletedCount;
};

export const analyticsService = {
  recordView,
  getViewHistory,
  pruneOrphanedViewEvents,
  INLINE_VIEW_CACHE
};
