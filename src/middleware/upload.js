import { upload } from '../config/multer.js';

export const uploadSingle = (fieldName) => upload.single(fieldName);

export const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof Error && err.message === 'File type not allowed') {
    return res.status(400).json({
      success: false,
      message: 'File type not allowed'
    });
  }
  next(err);
};