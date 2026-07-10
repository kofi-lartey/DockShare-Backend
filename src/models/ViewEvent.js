import mongoose from 'mongoose';

// Durable, time-expiring view history. Each document auto-expires via the
// MongoDB TTL index (expireAfterSeconds: 0) once `expiresAt` passes, which
// prevents unbounded growth regardless of how many views a file receives.
const viewEventSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ip: {
    type: String,
    select: false
  },
  userAgent: {
    type: String,
    select: false
  },
  // When this record should be purged by the TTL monitor. Plan-aware.
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// TTL index: MongoDB removes documents shortly after expiresAt.
viewEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
viewEventSchema.index({ fileId: 1, timestamp: -1 });

export const ViewEvent = mongoose.model('ViewEvent', viewEventSchema);
