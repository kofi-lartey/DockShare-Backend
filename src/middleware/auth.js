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
