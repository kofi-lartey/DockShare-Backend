import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  pages: {
    type: Number,
    default: null
  },
  duration: {
    type: String,
    default: null
  },
  fileData: {
    type: String,
    default: null,
    required: false
  },
  filePath: {
    type: String,
    default: null
  },
  cloudinaryPublicId: {
    type: String,
    default: null,
    index: true
  },
  views: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'deleted'],
    default: 'active'
  },
  shareableLink: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  requirePassword: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    select: false
  },
  qrCodeGenerated: {
    type: Boolean,
    default: false
  },
  qrCode: {
    type: String,
    default: null
  },
  notifyOnView: {
    type: Boolean,
    default: false
  },
  lastViewedAt: {
    type: Date
  },
  // Bounded inline cache of recent viewers, sliced to the most recent N
  // entries by analyticsService.recordView. The durable, TTL-expiring
  // history is kept in the separate ViewEvent collection.
  viewHistory: [{
    timestamp: { type: Date, default: Date.now },
    ip: String,
    userAgent: String
  }],
  downloadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ status: 1 });
fileSchema.index({ expiresAt: 1 });
fileSchema.index({ shareableLink: 1 });
fileSchema.index({ name: 'text' });

// Bounded atomic increment used by analyticsService. Keeps the inline
// viewHistory cache at a fixed size to prevent unbounded document growth.
fileSchema.methods.incrementViews = function(viewerInfo = {}) {
  this.views += 1;
  this.lastViewedAt = new Date();
  this.viewHistory.push({
    timestamp: new Date(),
    ip: viewerInfo.ip,
    userAgent: viewerInfo.userAgent
  });
  if (this.viewHistory.length > 20) {
    this.viewHistory = this.viewHistory.slice(-20);
  }
  return this.save();
};

fileSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

fileSchema.methods.canBeViewedBy = function(user) {
  if (this.userId.toString() === user._id.toString()) return true;
  if (this.status === 'expired') return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  return true;
};

fileSchema.statics.getUserUsage = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    { $group: {
      _id: null,
      totalSize: { $sum: '$size' },
      totalFiles: { $sum: 1 },
      totalViews: { $sum: '$views' }
    }}
  ]);
  return result[0] || { totalSize: 0, totalFiles: 0, totalViews: 0 };
};

export const File = mongoose.model('File', fileSchema);