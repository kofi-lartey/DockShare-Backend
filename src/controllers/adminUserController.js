import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { File } from '../models/File.js';
import { logAudit } from '../services/adminAuditService.js';

const SECRET_SELECT = '-password -adminCodeHash -emailVerificationToken -emailVerificationExpires -emailOTP -emailOTPExpires -emailOTPSentAt -resetPasswordToken -resetPasswordExpires';

const sanitize = (user) => {
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

// Returns a userId -> { uploadCount, storageUsed } map in a single aggregation.
const usageMap = async () => {
  const rows = await File.aggregate([
    { $group: { _id: '$userId', uploadCount: { $sum: 1 }, storageUsed: { $sum: '$size' } } }
  ]);
  return Object.fromEntries(rows.map((r) => [r._id.toString(), r]));
};

export const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = 'all', status = 'all', sort = 'createdAt:desc' } = req.query;
    const filter = {};
    if (role !== 'all') filter.role = role;
    if (status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const [field, dir] = String(sort).split(':');
    const sortObj = { [field]: dir === 'asc' ? 1 : -1 };
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [users, total] = await Promise.all([
      User.find(filter).select(SECRET_SELECT).sort(sortObj).skip(skip).limit(parseInt(limit, 10)),
      User.countDocuments(filter)
    ]);

    const usage = await usageMap();
    const data = users.map((u) => {
      const s = sanitize(u);
      const u2 = usage[u._id.toString()] || {};
      return { ...s, uploadCount: u2.uploadCount || 0, storageUsed: u2.storageUsed || 0 };
    });

    res.json({
      success: true,
      data: {
        users: data,
        total,
        page: parseInt(page, 10),
        totalPages: Math.max(1, Math.ceil(total / parseInt(limit, 10)))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve users' });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(SECRET_SELECT);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const usage = await usageMap();
    const u2 = usage[user._id.toString()] || {};
    res.json({
      success: true,
      data: { ...sanitize(user), uploadCount: u2.uploadCount || 0, storageUsed: u2.storageUsed || 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve user' });
  }
};

// Enforces the single-administrator rule on creation/promotion.
const enforceSingleAdmin = async (desiredRole, excludeId = null) => {
  if (desiredRole !== 'admin') return;
  const q = excludeId ? { role: 'admin', _id: { $ne: excludeId } } : { role: 'admin' };
  if (await User.exists(q)) {
    const err = new Error('Only one administrator is allowed');
    err.code = 'ADMIN_EXISTS';
    throw err;
  }
};

export const createUser = async (req, res) => {
  try {
    const { fullName, email, password, plan = 'free', role = 'user', emailVerified = true } = req.body;

    if (!fullName || !email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Full name and a valid email are required' });
    }
    if (await User.exists({ email: email.toLowerCase() })) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    await enforceSingleAdmin(role);

    const salt = await bcrypt.genSalt(10);
    const hashed = password
      ? await bcrypt.hash(password, salt)
      : await bcrypt.hash(crypto.randomBytes(16).toString('hex'), salt);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashed,
      plan,
      role,
      permissions: role === 'admin' ? ['user.*', 'admin.*'] : [],
      emailVerified: !!emailVerified,
      subscriptionStatus: plan === 'free' ? 'incomplete' : 'active',
      status: 'active',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff&size=128`
    });

    await logAudit({ actor: req.user.email, action: 'user.create', target: user.email, ip: req.ip });

    res.status(201).json({ success: true, data: sanitize(user), message: 'User created' });
  } catch (error) {
    const status = error.code === 'ADMIN_EXISTS' ? 409 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to create user' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { fullName, plan, role, status, emailVerified } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (role && role !== user.role) {
      await enforceSingleAdmin(role, user._id);
      user.role = role;
      user.permissions = role === 'admin' ? ['user.*', 'admin.*'] : [];
    }
    if (fullName) user.fullName = fullName;
    if (plan) user.plan = plan;
    if (status) user.status = status;
    if (typeof emailVerified === 'boolean') user.emailVerified = emailVerified;

    await user.save();
    await logAudit({ actor: req.user.email, action: 'user.update', target: user.email, ip: req.ip });

    res.json({ success: true, data: sanitize(user), message: 'User updated' });
  } catch (error) {
    const status = error.code === 'ADMIN_EXISTS' ? 409 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'The administrator account cannot be deleted' });
    }

    const email = user.email;
    await User.findByIdAndDelete(req.params.id);
    await logAudit({ actor: req.user.email, action: 'user.delete', target: email, ip: req.ip });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

export const adminUserController = { listUsers, getUser, createUser, updateUser, deleteUser };
