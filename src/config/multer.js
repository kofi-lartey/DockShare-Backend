import multer from 'multer';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../utils/constants.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = Object.keys(ALLOWED_FILE_TYPES);
  const isAllowed = allowedTypes.some(type => {
    if (type.includes('/*')) {
      const category = type.split('/')[0];
      return file.mimetype.startsWith(category);
    }
    return file.mimetype === type;
  });

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});

export const createUploader = (options = {}) => {
  return multer({
    storage,
    limits: {
      fileSize: options.maxFileSize || MAX_FILE_SIZE
    },
    fileFilter
  });
};