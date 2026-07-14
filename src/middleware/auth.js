import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { jwtBlacklist } from '../utils/jwtBlacklist.js';

const verifyToken = async (token) => {
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  if (jwtBlacklist.has(token)) {
    return { error: 'Token has been revoked', status: 401 };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { error: 'Invalid or expired token', status: 401 };
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    return { error: 'User not found', status: 401 };
  }

  return { user, token };
};

export const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const result = await verifyToken(token);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    req.user = result.user;
    req.token = result.token;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const result = await verifyToken(token);

    if (!result.error) {
      req.user = result.user;
      req.token = result.token;
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireVerified = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const result = await verifyToken(token);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    if (!result.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required. Please check your inbox and confirm your email.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    req.user = result.user;
    req.token = result.token;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const result = await verifyToken(token);

    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    // Backward-compatible: role-based admin OR legacy ADMIN_EMAILS allowlist.
    const isAdmin = result.user.role === 'admin' || adminEmails.includes(result.user.email.toLowerCase());
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    req.user = result.user;
    req.token = result.token;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Role gate. The Administrator (superuser) inherits every standard user
 * privilege and additionally owns advanced administrative controls.
 */
export const requireRole = (...roles) => async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const result = await verifyToken(token);

    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    if (!roles.includes(result.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    req.user = result.user;
    req.token = result.token;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Granular permission scope gate. An administrator (superuser) satisfies any
 * scope, including `admin.*`. Standard users satisfy `user.*` scopes only.
 */
export const requirePermission = (scope) => async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const result = await verifyToken(token);

    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    const isAdmin = result.user.role === 'admin';
    if (scope.startsWith('admin.') && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin permission required', code: 'FORBIDDEN' });
    }

    req.user = result.user;
    req.token = result.token;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Strict admin guard that also requires the multi-factor claim. Used to
 * protect every privileged /api/admin route after the MFA challenge is
 * satisfied (the full admin JWT carries `mfa: true`).
 */
export const requireMfa = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (jwtBlacklist.has(token)) {
      return res.status(401).json({ success: false, message: 'Token has been revoked' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required', code: 'FORBIDDEN' });
    }
    if (decoded.mfa !== true) {
      return res.status(403).json({ success: false, message: 'Multi-factor verification required', code: 'MFA_REQUIRED' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const requireOnboarding = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const result = await verifyToken(token);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    if (!result.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required. Please check your inbox and confirm your email.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    if (result.user.subscriptionStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Please complete your subscription to access the dashboard.',
        code: 'ONBOARDING_INCOMPLETE'
      });
    }

    req.user = result.user;
    req.token = result.token;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};
