import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../config/email.js';
import { validateRegistration, validateLogin, validatePassword, validateSendOtpLogin, validateLoginWithOtp } from '../utils/validators.js';
import { jwtBlacklist } from '../utils/jwtBlacklist.js';

const generateRandomPassword = () => crypto.randomBytes(16).toString('hex');

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
      subscriptionStatus: 'incomplete',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff&size=128`
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.emailOTPSentAt = new Date();
    await user.save();

    await sendOtpEmail(user.email, otp);

    const userData = user.toObject();
    delete userData.password;
    delete userData.emailVerificationToken;
    delete userData.emailVerificationExpires;
    delete userData.emailOTP;
    delete userData.emailOTPExpires;
    delete userData.emailOTPSentAt;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    res.status(201).json({
      success: true,
      data: userData,
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

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please check your inbox and confirm your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    user.lastActivity = new Date();
    await user.save();

    const expiresIn = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN;
    const token = jwt.sign(
      { id: user._id, email: user.email, plan: user.plan, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const userData = user.toObject();
    delete userData.password;
    delete userData.emailVerificationToken;
    delete userData.emailVerificationExpires;
    delete userData.emailOTP;
    delete userData.emailOTPExpires;
    delete userData.emailOTPSentAt;
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

export const sendOtpLogin = async (req, res) => {
  try {
    const { email } = req.body;

    const errors = validateSendOtpLogin({ email });
    if (errors) {
      return res.status(400).json({ success: false, errors });
    }

    const normalizedEmail = email.toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const randomPassword = generateRandomPassword();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = await User.create({
        fullName: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: hashedPassword,
        subscriptionStatus: 'incomplete',
        emailVerified: true,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(normalizedEmail.split('@')[0])}&background=6366f1&color=fff&size=128`
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.emailOTPSentAt = new Date();
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json({
      success: true,
      message: isNewUser
        ? 'Account created. A verification code has been sent to your email.'
        : 'A verification code has been sent to your email.',
      data: { email: user.email, isNewUser }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.'
    });
  }
};

export const loginWithOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const errors = validateLoginWithOtp({ email, otp });
    if (errors) {
      return res.status(400).json({ success: false, errors });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      emailOTP: otp,
      emailOTPExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    user.lastActivity = new Date();
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    user.emailOTPSentAt = undefined;
    await user.save();

    const userData = user.toObject();
    delete userData.password;
    delete userData.emailVerificationToken;
    delete userData.emailVerificationExpires;
    delete userData.emailOTP;
    delete userData.emailOTPExpires;
    delete userData.emailOTPSentAt;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    const token = jwt.sign(
      { id: user._id, email: user.email, plan: user.plan, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

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

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
      emailOTP: otp,
      emailOTPExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    user.emailVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    user.emailOTPSentAt = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const userData = user.toObject();
    delete userData.password;
    delete userData.emailVerificationToken;
    delete userData.emailVerificationExpires;
    delete userData.emailOTP;
    delete userData.emailOTPExpires;
    delete userData.emailOTPSentAt;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordExpires;

    const token = jwt.sign(
      { id: user._id, email: user.email, plan: user.plan, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: { ...userData, token },
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a verification email has been sent.'
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a verification email has been sent.'
      });
    }

    if (user.emailOTPSentAt && (Date.now() - user.emailOTPSentAt.getTime()) < 60000) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 60 seconds before requesting a new code.'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.emailOTPSentAt = new Date();
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a verification code has been sent.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send verification email. Please try again.'
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

export const getOnboardingStatus = async (req, res) => {
  try {
    const user = req.user;
    const subscription = await Subscription.findOne({ userId: user._id });

    let step = 'registration';
    let nextStep = 'verify_email';
    let completedSteps = [];

    if (user.emailVerified) {
      step = 'verified';
      nextStep = 'select_plan';
      completedSteps = ['registration', 'verify_email'];

      if (subscription) {
        if (subscription.plan === 'free' && subscription.status === 'active') {
          step = 'complete';
          nextStep = null;
          completedSteps = ['registration', 'verify_email', 'select_plan'];
        } else if (user.subscriptionStatus === 'active') {
          step = 'complete';
          nextStep = null;
          completedSteps = ['registration', 'verify_email', 'select_plan', 'payment'];
        } else {
          step = 'payment_pending';
          nextStep = 'complete_payment';
          completedSteps = ['registration', 'verify_email', 'select_plan'];
        }
      }
    }

    res.json({
      success: true,
      data: {
        step,
        nextStep,
        completedSteps,
        emailVerified: user.emailVerified,
        subscription: subscription ? {
          plan: subscription.plan,
          status: subscription.status,
          provider: subscription.provider
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve onboarding status'
    });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      jwtBlacklist.add(token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid token'
    });
  }
};