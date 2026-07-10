import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { File } from '../models/File.js';
import { User } from '../models/User.js';
import { sendViewNotification } from '../config/email.js';
import { generateShareableLink, getFileTypeCategory, generateQRCode, getPdfPageCount } from '../utils/helpers.js';
import { PLAN_LIMITS } from '../utils/constants.js';
import { FRONTEND_URL } from '../config/env.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

export const uploadFile = async (req, res) => {
  try {
    const user = req.user;
    const file = req.file;
    const {
      fileName,
      requirePassword,
      password,
      generateQR,
      setExpiry,
      expiresAt,
      notifyOnView,
      pages: pagesCount
    } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const userFiles = await File.countDocuments({ userId: user._id, status: 'active' });
    const uploadLimit = user.uploadLimit;
    if (userFiles >= uploadLimit && uploadLimit !== Infinity) {
      return res.status(403).json({
        success: false,
        message: `You have reached your upload limit of ${uploadLimit} files. Please upgrade your plan.`
      });
    }

    const usage = await File.getUserUsage(user._id);
    const storageLimit = user.storageLimit;
    const newFileSize = file.size;
    if (storageLimit !== Infinity && (usage.totalSize + newFileSize) > storageLimit) {
      return res.status(403).json({
        success: false,
        message: 'Storage limit exceeded. Please upgrade your plan.'
      });
    }

    const maxFileSize = user.maxFileSize;
    if (maxFileSize !== Infinity && newFileSize > maxFileSize) {
      return res.status(400).json({
        success: false,
        message: `File size exceeds the maximum allowed size of ${maxFileSize / (1024 * 1024)}MB`
      });
    }

    const fileCategory = getFileTypeCategory(file.mimetype);
    const allowedFormats = PLAN_LIMITS[user.plan]?.allowedFormats || ['PDF'];
    if (user.plan === 'free' && fileCategory !== 'pdf') {
      return res.status(400).json({
        success: false,
        message: 'Free plan only supports PDF files. Please upgrade to upload other formats.'
      });
    }

    if (requirePassword === 'true' && (!password || password.length < 6)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    let hashedPassword = null;
    if (requirePassword === 'true' && password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    let cloudinaryPublicId = null;
    let cloudinaryUrl = null;
    try {
      const uploadResult = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      cloudinaryPublicId = uploadResult.public_id;
      cloudinaryUrl = uploadResult.secure_url;
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to cloud storage. Please try again.',
        error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
      });
    }

    const shareableLink = generateShareableLink();
    let qrCodeDataUrl = null;
    if (generateQR === 'true') {
      try {
        qrCodeDataUrl = await generateQRCode(`${FRONTEND_URL}/view/${shareableLink}`);
      } catch (qrError) {
        console.error('QR generation error:', qrError);
      }
    }

    // Determine page count for PDFs. Detect it directly from the uploaded
    // file buffer so we don't rely on a value the client may not send.
    let pages = null;
    if (file.mimetype === 'application/pdf') {
      const detectedPages = await getPdfPageCount(file.buffer);
      pages = detectedPages || (pagesCount ? parseInt(pagesCount) : 1);
    } else if (pagesCount) {
      pages = parseInt(pagesCount);
    }

    const newFile = await File.create({
      userId: user._id,
      name: fileName || file.originalname,
      originalName: file.originalname,
      size: newFileSize,
      type: file.mimetype,
      pages,
      fileData: null,
      filePath: cloudinaryUrl,
      cloudinaryPublicId,
      shareableLink,
      requirePassword: requirePassword === 'true',
      password: hashedPassword,
      expiresAt: setExpiry === 'true' ? expiresAt : null,
      qrCodeGenerated: generateQR === 'true',
      qrCode: qrCodeDataUrl,
      notifyOnView: notifyOnView === 'true'
    });

    user.uploadCount += 1;
    user.storageUsed += newFileSize;
    await user.save();

    const fileResponse = newFile.toObject();
    delete fileResponse.password;
    delete fileResponse.fileData;

    res.status(201).json({
      success: true,
      data: {
        ...fileResponse,
        filePath: cloudinaryUrl,
        shareableUrl: `${FRONTEND_URL}/view/${newFile.shareableLink}`
      },
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getFiles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      filter = 'all',
      sort = 'date-desc'
    } = req.query;

    const query = { userId: req.user._id, status: { $ne: 'deleted' } };

    if (search) {
      query.$text = { $search: search };
    }

    if (filter !== 'all') {
      query.status = filter;
    }

    const sortMap = {
      'date-desc': { createdAt: -1 },
      'date-asc': { createdAt: 1 },
      'name-asc': { name: 1 },
      'name-desc': { name: -1 },
      'size-asc': { size: 1 },
      'size-desc': { size: -1 },
      'views-desc': { views: -1 },
      'views-asc': { views: 1 }
    };
    const sortObj = sortMap[sort] || sortMap['date-desc'];

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [files, total] = await Promise.all([
      File.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password -fileData'),
      File.countDocuments(query)
    ]);

    const stats = await File.getUserUsage(req.user._id);

    const filesWithUrl = files.map(file => ({
      ...file.toObject(),
      shareableUrl: `${FRONTEND_URL}/view/${file.shareableLink}`
    }));

    res.json({
      success: true,
      data: {
        files: filesWithUrl,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        totalSize: stats.totalSize,
        totalViews: stats.totalViews,
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1
      },
      message: 'Files retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files'
    });
  }
};

export const getFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.query;

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    if (isObjectId && !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access this file'
      });
    }

    const file = await File.findOne({
      $or: isObjectId
        ? [{ _id: id }, { shareableLink: id }]
        : [{ shareableLink: id }]
    }).select('+password');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.isExpired()) {
      file.status = 'expired';
      await file.save();
      return res.status(410).json({
        success: false,
        message: 'This file has expired'
      });
    }

    const isOwner = req.user && file.userId.toString() === req.user._id.toString();

    if (file.requirePassword && !isOwner) {
      if (!password) {
        return res.status(401).json({
          success: false,
          message: 'Password required',
          requirePassword: true
        });
      }

      const isMatch = await bcrypt.compare(password, file.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password'
        });
      }
    }

    if (!isOwner) {
      await file.incrementViews({
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent']
      });
      if (file.notifyOnView) {
        const user = await User.findById(file.userId);
        if (user?.notifications?.viewNotifications) {
          await sendViewNotification(user.email, file.name);
        }
      }
    }

    const fileResponse = file.toObject();
    delete fileResponse.password;
    delete fileResponse.fileData;

    if (file.filePath) {
      fileResponse.filePath = file.filePath;
    } else if (file.fileData) {
      fileResponse.fileData = file.fileData;
    }

    if (file.qrCode) {
      fileResponse.qrCode = file.qrCode;
    }

    fileResponse.shareableUrl = `${FRONTEND_URL}/view/${file.shareableLink}`;

    res.json({
      success: true,
      data: fileResponse,
      message: 'File retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve file'
    });
  }
};

export const verifyPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const file = await File.findOne({
      $or: isObjectId
        ? [{ _id: id }, { shareableLink: id }]
        : [{ shareableLink: id }]
    }).select('+password');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (!file.requirePassword) {
      return res.status(400).json({
        success: false,
        message: 'This file is not password protected'
      });
    }

    const isMatch = await bcrypt.compare(password, file.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    const responseData = {};

    if (file.filePath) {
      responseData.filePath = file.filePath;
    } else if (file.fileData) {
      responseData.fileData = file.fileData;
    }

    if (file.qrCode) {
      responseData.qrCode = file.qrCode;
    }

    res.json({
      success: true,
      data: responseData,
      message: 'Password verified successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify password'
    });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(file.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete from Cloudinary:', cloudinaryError);
      }
    }

    file.status = 'deleted';
    await file.save();

    req.user.storageUsed -= file.size;
    await req.user.save();

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
};