import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { sendOtpEmail } from '../config/email.js';
import { logAudit } from '../services/adminAuditService.js';
import { jwtBlacklist } from '../utils/jwtBlacklist.js';

const JWT_SECRET = process.env.JWT_SECRET;
const MFA_TOKEN_TTL = '5m';
const ADMIN_TOKEN_TTL = process.env.ADMIN_JWT_EXPIRES_IN || '12h';

// Step-1 challenge token: proves identity but is NOT a full session.
const signMfaToken = (user) => jwt.sign(
  { id: user._id, email: user.email, role: user.role, mfa: 'pending', jti: crypto.randomUUID() },
  JWT_SECRET,
  { expiresIn: MFA_TOKEN_TTL }
);

// Step-2 full admin session: carries the verified MFA claim.
const signAdminToken = (user) => jwt.sign(
  { id: user._id, email: user.email, role: user.role, mfa: true, jti: crypto.randomUUID() },
  JWT_SECRET,
  { expiresIn: ADMIN_TOKEN_TTL }
);

// Verifies a step-1 challenge token; rejects anything that isn't a pending MFA challenge.
const verifyMfaToken = (token) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.mfa !== 'pending') throw new Error('INVALID_MFA_TOKEN');
  return decoded;
};

const SECRET_SELECT = '-password -adminCodeHash -emailVerificationToken -emailVerificationExpires -emailOTP -emailOTPExpires -emailOTPSentAt -resetPasswordToken -resetPasswordExpires';

/**
 * Restricted onboarding: initializes the single, unique Administrator.
 * Enforced server-side — succeeds only when zero admins already exist.
 */
export const setup = async (req, res) => {
  try {
    const { email, password, adminCode, confirmCode, mfaMethod } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (!adminCode || adminCode.length < 6) {
      return res.status(400).json({ success: false, message: 'Admin Code must be at least 6 characters' });
    }
    if (adminCode !== confirmCode) {
      return res.status(409).json({ success: false, message: 'Admin Codes do not match', code: 'ADMIN_CODE_MISMATCH' });
    }

    if (await User.exists({ role: 'admin' })) {
      return res.status(409).json({ success: false, message: 'An administrator already exists', code: 'ADMIN_EXISTS' });
    }
    if (await User.exists({ email: email.toLowerCase() })) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const fullName = email.split('@')[0];
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, salt),
      emailVerified: true,
      role: 'admin',
      permissions: ['user.*', 'admin.*'],
      adminCodeHash: await bcrypt.hash(adminCode, salt),
      mfaMethod: mfaMethod || 'password+code',
      plan: 'express',
      subscriptionStatus: 'active',
      status: 'active',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4f46e5&color=fff&size=128`
    });

    await logAudit({ actor: user.email, action: 'admin.setup', target: user.email, ip: req.ip });

    const userData = user.toObject();
    delete userData.password;
    delete userData.adminCodeHash;

    res.status(201).json({
      success: true,
      data: { ...userData, token: signAdminToken(user) },
      message: 'Administrator initialized'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to initialize administrator' });
  }
};

export const hasAdmin = async (req, res) => {
  try {
    const count = await User.countDocuments({ role: 'admin' });
    res.json({ success: true, data: { exists: count > 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check administrator status' });
  }
};

// ---- Option A: Username/Email + Password, then Admin Code ----
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    res.json({
      success: true,
      data: { mfaToken: signMfaToken(user), method: user.mfaMethod },
      message: 'MFA challenge issued'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const loginVerify = async (req, res) => {
  try {
    const { mfaToken, adminCode } = req.body;
    let decoded;
    try {
      decoded = verifyMfaToken(mfaToken);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired MFA challenge' });
    }
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    if (!adminCode) {
      return res.status(400).json({ success: false, message: 'Admin Code is required' });
    }

    const user = await User.findById(decoded.id).select('+adminCodeHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!(await bcrypt.compare(adminCode, user.adminCodeHash || ''))) {
      return res.status(401).json({ success: false, message: 'Invalid Admin Code' });
    }

    await logAudit({ actor: user.email, action: 'admin.login', target: user.email, ip: req.ip });

    res.json({
      success: true,
      data: { token: signAdminToken(user), method: user.mfaMethod },
      message: 'Admin authenticated'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

// ---- Option B: Email + OTP, then Admin Code ----
export const loginOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.emailOTPSentAt = new Date();
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.json({
      success: true,
      data: { mfaToken: signMfaToken(user), method: 'otp+code' },
      message: 'OTP sent to administrator email'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

export const loginOtpVerify = async (req, res) => {
  try {
    const { mfaToken, otp, adminCode } = req.body;
    let decoded;
    try {
      decoded = verifyMfaToken(mfaToken);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired MFA challenge' });
    }
    if (!otp || !adminCode) {
      return res.status(400).json({ success: false, message: 'OTP and Admin Code are required' });
    }

    const user = await User.findOne({
      _id: decoded.id,
      emailOTP: otp,
      emailOTPExpires: { $gt: new Date() }
    }).select('+adminCodeHash');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }
    if (!(await bcrypt.compare(adminCode, user.adminCodeHash || ''))) {
      return res.status(401).json({ success: false, message: 'Invalid Admin Code' });
    }

    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    user.emailOTPSentAt = undefined;
    await user.save();

    await logAudit({ actor: user.email, action: 'admin.login', target: user.email, ip: req.ip });

    res.json({
      success: true,
      data: { token: signAdminToken(user), method: 'otp+code' },
      message: 'Admin authenticated'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

// ---- Protected (requireMfa) ----
export const switchMfaMethod = async (req, res) => {
  try {
    const { method } = req.body;
    if (!['password+code', 'otp+code'].includes(method)) {
      return res.status(400).json({ success: false, message: 'Invalid MFA method' });
    }
    req.user.mfaMethod = method;
    await req.user.save();

    await logAudit({ actor: req.user.email, action: 'mfa.method.switch', target: method, ip: req.ip });

    res.json({ success: true, data: { method }, message: 'MFA method updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update MFA method' });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) jwtBlacklist.add(token);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Idempotent env-driven bootstrap. On first start (no admin exists), creates
 * or promotes the Administrator from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_CODE
 * so the console is reachable without manually hitting /api/admin/setup.
 * If the admin email already belongs to a regular account, that account is
 * promoted (and its password/Admin Code are set to the env values) rather
 * than failing on a duplicate key. No-op when an admin already exists or when
 * env vars are absent.
 */
export const bootstrapAdminFromEnv = async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const adminCode = process.env.ADMIN_CODE;
    if (!email || !password || !adminCode) return;

    if (await User.exists({ role: 'admin' })) return;

    const salt = await bcrypt.genSalt(10);
    const adminCodeHash = await bcrypt.hash(adminCode, salt);
    const lowerEmail = email.toLowerCase();
    const fullName = email.split('@')[0];

    const existing = await User.findOne({ email: lowerEmail });
    if (existing) {
      existing.role = 'admin';
      existing.permissions = ['user.*', 'admin.*'];
      existing.adminCodeHash = adminCodeHash;
      existing.mfaMethod = process.env.ADMIN_MFA_METHOD || 'password+code';
      existing.password = await bcrypt.hash(password, salt);
      existing.emailVerified = true;
      existing.plan = 'express';
      existing.subscriptionStatus = 'active';
      existing.status = 'active';
      await existing.save();
      console.log(`[admin] promoted existing account to administrator: ${email}`);
      return;
    }

    await User.create({
      fullName,
      email: lowerEmail,
      password: await bcrypt.hash(password, salt),
      emailVerified: true,
      role: 'admin',
      permissions: ['user.*', 'admin.*'],
      adminCodeHash,
      mfaMethod: process.env.ADMIN_MFA_METHOD || 'password+code',
      plan: 'express',
      subscriptionStatus: 'active',
      status: 'active',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4f46e5&color=fff&size=128`
    });

    console.log(`[admin] bootstrapped administrator from env: ${email}`);
  } catch (error) {
    console.error('[admin] env bootstrap failed:', error.message);
  }
};

export const adminAuthController = {
  setup, hasAdmin, login, loginVerify, loginOtp, loginOtpVerify,
  switchMfaMethod, logout, bootstrapAdminFromEnv
};
