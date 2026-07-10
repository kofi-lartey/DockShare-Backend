import mongoose from 'mongoose';

// Captures download events with IP (hashed), geolocation and consent context.
// Auto-expires via the TTL index, with retention aligned to the owner's plan.
const downloadEventSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  downloadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Salted SHA-256 hash of the IP — never the raw address.
  ipHash: {
    type: String,
    select: false
  },
  userAgent: {
    type: String,
    select: false
  },
  country: String,
  region: String,
  city: String,
  // Whether geo tracking was consented at time of event (data minimisation).
  geoConsented: { type: Boolean, default: false },
  // Version of the privacy policy the owner/downloader accepted.
  consentVersion: String,
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

downloadEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
downloadEventSchema.index({ ownerId: 1, timestamp: -1 });

export const DownloadEvent = mongoose.model('DownloadEvent', downloadEventSchema);
