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

const signMfaToken = (user) => jwt.sign(
  { id: user._id, email: user.email, role: user.role, mfa: 'pending', jti: crypto.randomUUID() },
  JWT_SECRET,
  { expiresIn: MFA_TOKEN_TTL }
);

const signAdminToken = (user) => jwt.sign(
  { id: user._id, email: user.email, role: user.role, mfa: true, jti: crypto.randomUUID() },
  JWT_SECRET,
  { expiresIn: ADMIN_TOKEN_TTL }
);

const verifyMfaToken = (token) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.mfa !== 'pending') throw new Error('INVALID_MFA_TOKEN');
  return decoded;
};

const SECRET_SELECT = '-password -adminCodeHash -emailVerificationToken -emailVerificationExpires -emailOTP -emailOTPExpires -emailOTPSentAt -resetPasswordToken -resetPasswordExpires';

const sanitizeAdmin = (user) => {
  const obj = user.toObject();
  delete obj.password;
  delete obj.adminCodeHash;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.emailOTP;
  delete obj.emailOTPExpires;
  delete obj.emailOTPSentAt;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

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
    if (await User.exists({ email: email.toLowerCase().trim() })) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const fullName = email.split('@')[0];
    const user = await User.create({
      fullName,
      email: email.toLowerCase().trim(),
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

    const userData = sanitizeAdmin(user);

    res.status(201).json({
      success: true,
      data: { ...userData, token: signAdminToken(user) },
      message: 'Administrator initialized'
    });
  } catch (error) {
    console.error('Admin setup error:', error);
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

export const getAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(SECRET_SELECT);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    res.json({ success: true, data: sanitizeAdmin(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve admin profile' });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const { fullName, email, currentPassword, newPassword, adminCode, mfaMethod } = req.body;

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
      user.email = email.toLowerCase().trim();
    }

    if (fullName) user.fullName = fullName;

    if (mfaMethod && ['password+code', 'otp+code'].includes(mfaMethod)) {
      user.mfaMethod = mfaMethod;
    }

    if (adminCode !== undefined) {
      if (typeof adminCode === 'string' && adminCode.length >= 6) {
        const salt = await bcrypt.genSalt(10);
        user.adminCodeHash = await bcrypt.hash(adminCode, salt);
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required' });
      }
      if (!(await user.comparePassword(currentPassword))) {
        return res.status(401).json({ success: false, message: 'Invalid current password' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();
    await logAudit({ actor: user.email, action: 'admin.profile.update', target: user.email, ip: req.ip });

    res.json({ success: true, data: sanitizeAdmin(user), message: 'Admin profile updated' });
  } catch (error) {
    console.error('Admin update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update admin profile' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'admin' });
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
    if (!(await bcrypt.compare(adminCode.trim(), user.adminCodeHash || ''))) {
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

export const loginOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'admin' });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
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

    const cleanedOtp = typeof otp === 'string' ? otp.trim().replace(/\s/g, '') : otp;
    if (!/^\d{6}$/.test(cleanedOtp)) {
      return res.status(400).json({ success: false, message: 'OTP must be exactly 6 digits' });
    }

    const user = await User.findOne({
      _id: decoded.id,
      emailOTP: cleanedOtp,
      emailOTPExpires: { $gt: new Date() }
    }).select('+adminCodeHash');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }
    if (!(await bcrypt.compare(adminCode.trim(), user.adminCodeHash || ''))) {
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

export const adminAuthController = {
  setup, hasAdmin, getAdminProfile, updateAdmin,
  login, loginVerify, loginOtp, loginOtpVerify,
  switchMfaMethod, logout
};