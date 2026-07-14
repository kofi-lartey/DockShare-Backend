import mongoose from 'mongoose';

// Immutable record of privileged administrative actions. Written on every
// admin mutation and auth event for compliance/forensics.
const auditLogSchema = new mongoose.Schema({
  actor: {
    type: String,
    required: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  target: String,
  method: String,
  ip: String,
  at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
