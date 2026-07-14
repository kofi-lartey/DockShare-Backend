import { AuditLog } from '../models/AuditLog.js';

// Fire-and-forget audit writer. Failures are logged but never break the
// request that triggered them (best-effort compliance trail).
export const logAudit = async ({ actor, action, target, method, ip }) => {
  try {
    await AuditLog.create({
      actor: actor || 'system',
      action,
      target: target || null,
      method: method || null,
      ip: ip || null,
      at: new Date()
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
};

export const adminAuditService = { logAudit };
