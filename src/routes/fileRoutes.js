import express from 'express';
import { 
  uploadFile, 
  getFiles, 
  getFile, 
  verifyPassword, 
  deleteFile 
} from '../controllers/fileController.js';
import { auth } from '../middleware/auth.js';
import { upload } from '../config/multer.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const fileRoutes = express.Router();

fileRoutes.use(auth);

fileRoutes.post('/upload', upload.single('file'), rateLimiter, uploadFile);
fileRoutes.get('/', getFiles);
fileRoutes.get('/:id', getFile);
fileRoutes.post('/:id/verify-password', verifyPassword);
fileRoutes.delete('/:id', deleteFile);

export default fileRoutes;