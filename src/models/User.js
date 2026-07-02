import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  avatar: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff&size=128'
  },
  bio: {
    type: String,
    maxlength: 500
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'express'],
    default: 'free'
  },
  subscriptionStatus: {
    type: String,
    enum: ['incomplete', 'active', 'trialing', 'canceled', 'past_due'],
    default: 'incomplete'
  },
  subscriptionStartDate: {
    type: Date
  },
  nextBillingDate: {
    type: Date
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  notifications: {
    emailNotifications: { type: Boolean, default: true },
    uploadSuccess: { type: Boolean, default: true },
    shareNotifications: { type: Boolean, default: true },
    monthlyReports: { type: Boolean, default: false },
    viewNotifications: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true }
  },
  storageUsed: {
    type: Number,
    default: 0
  },
  uploadCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ plan: 1 });
userSchema.index({ subscriptionStatus: 1 });

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id, email: this.email, plan: this.plan, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

userSchema.virtual('uploadLimit').get(function() {
  const limits = {
    free: 2,
    pro: Infinity,
    express: Infinity
  };
  return limits[this.plan] || 2;
});

userSchema.virtual('storageLimit').get(function() {
  const limits = {
    free: 100 * 1024 * 1024,
    pro: 50 * 1024 * 1024 * 1024,
    express: Infinity
  };
  return limits[this.plan] || 100 * 1024 * 1024;
});

userSchema.virtual('maxFileSize').get(function() {
  const limits = {
    free: 10 * 1024 * 1024,
    pro: 1024 * 1024 * 1024,
    express: Infinity
  };
  return limits[this.plan] || 10 * 1024 * 1024;
});

userSchema.virtual('retentionDays').get(function() {
  const limits = {
    free: 7,
    pro: 90,
    express: Infinity
  };
  return limits[this.plan] || 7;
});

export const User = mongoose.model('User', userSchema);