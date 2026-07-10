import express from 'express';
import { 
  uploadFile, 
  getFiles, 
  getFile, 
  verifyPassword, 
  deleteFile 
} from '../controllers/fileController.js';
import { auth, optionalAuth } from '../middleware/auth.js';
import { upload } from '../config/multer.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const fileRoutes = express.Router();

fileRoutes.post('/upload', auth, upload.single('file'), rateLimiter, uploadFile);
fileRoutes.get('/', auth, getFiles);
fileRoutes.get('/:id', optionalAuth, getFile);
fileRoutes.post('/:id/verify-password', verifyPassword);
fileRoutes.delete('/:id', auth, deleteFile);

export default fileRoutes;