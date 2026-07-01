import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { File } from '../models/File.js';
import { validateProfileUpdate, validatePasswordChange } from '../utils/validators.js';

export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, bio } = req.body;

    const errors = validateProfileUpdate({ fullName, email, bio });
    if (errors) {
      return res.status(400).json({ success: false, errors });
    }

    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email.toLowerCase();
    if (bio !== undefined) updateData.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -emailVerificationExpires -resetPasswordToken -resetPasswordExpires');

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const errors = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
    if (errors) {
      return res.status(400).json({ success: false, errors });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const { notifications } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { notifications },
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -emailVerificationExpires -resetPasswordToken -resetPasswordExpires');

    res.json({
      success: true,
      data: user,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    res.json({
      success: true,
      data: user.notifications,
      message: 'Notifications retrieved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications'
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -emailVerificationToken -emailVerificationExpires -resetPasswordToken -resetPasswordExpires');
    
    const usage = await File.getUserUsage(req.user._id);
    
    res.json({
      success: true,
      data: {
        ...user.toObject(),
        storageUsed: usage.totalSize,
        uploadCount: usage.totalFiles
      },
      message: 'Profile retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile'
    });
  }
};