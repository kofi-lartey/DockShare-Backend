import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../config/email.js';
import { validateRegistration, validateLogin, validatePassword } from '../utils/validators.js';

export const register = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, terms } = req.body;

    const errors = validateRegistration({ fullName, email, password, confirmPassword, terms });
    if (errors) {
      return res.status(400).json({ success: false, errors });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff&size=128`
    });

    await Subscription.create({
      userId: user._id,
      plan: 'free',
      status: 'active',
      startDate: new Date()
    });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.email, verificationToken);

    const token = user.generateAuthToken();

    const userData = user.toObject();
    delete userData.password;
    delete userData.emailVerificationToken;
    delete userData.emailVerificationExpires;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    res.status(201).json({
      success: true,
      data: {
        ...userData,
        token
      },
      message: 'Registration successful. Please check your email to confirm your account.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const errors = validateLogin({ email, password });
    if (errors) {
      return res.status(400).json({ success: false, errors });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    user.lastActivity = new Date();
    await user.save();

    const expiresIn = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN;
    const token = jwt.sign(
      { id: user._id, email: user.email, plan: user.plan },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const userData = user.toObject();
    delete userData.password;
    delete userData.emailVerificationToken;
    delete userData.emailVerificationExpires;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    res.json({
      success: true,
      data: {
        ...userData,
        token
      },
      message: 'Login successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 1 * 60 * 60 * 1000);
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    const errors = validatePassword({ password, confirmPassword });
    if (errors) {
      return res.status(400).json({ success: false, errors });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};