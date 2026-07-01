import { File } from '../models/File.js';
import { User } from '../models/User.js';

export const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;
    const usage = await File.getUserUsage(user._id);
    
    const totalUploads = usage.totalFiles;
    const totalViews = usage.totalViews;
    const totalSize = usage.totalSize;
    const activeLinks = await File.countDocuments({ userId: user._id, status: 'active' });

    res.json({
      success: true,
      data: {
        totalUploads,
        totalViews,
        storageUsed: totalSize,
        storageLimit: user.storageLimit,
        activeLinks,
        plan: user.plan
      },
      message: 'Stats retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats'
    });
  }
};

export const getRecentActivity = async (req, res) => {
  try {
    const files = await File.find({ userId: req.user._id, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-password -fileData');

    const activity = files.map(file => ({
      id: file._id,
      name: file.name,
      size: file.size,
      type: file.type,
      views: file.views,
      status: file.status,
      createdAt: file.createdAt,
      requirePassword: file.requirePassword,
      description: file.requirePassword ? 'Uploaded a password-protected file' : 'Uploaded a new file',
      uploadedDate: file.createdAt
    }));

    res.json({
      success: true,
      data: activity,
      message: 'Recent activity retrieved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity'
    });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const usage = await File.getUserUsage(req.user._id);
    
    const monthlyUploads = await File.aggregate([
      { $match: { userId: req.user._id, status: 'active' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          totalViews: { $sum: '$views' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    const fileTypeDistribution = await File.aggregate([
      { $match: { userId: req.user._id, status: 'active' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalUploads: usage.totalFiles,
        totalViews: usage.totalViews,
        totalSize: usage.totalSize,
        monthlyUploads,
        fileTypeDistribution,
        mostViewed: await File.findOne({ userId: req.user._id, status: 'active' })
          .sort({ views: -1 })
          .select('name views')
      },
      message: 'Analytics retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics'
    });
  }
};