import express from 'express';
import { 
  uploadFile, 
  getFiles, 
  getFile, 
  verifyPassword, 
  deleteFile,
  convertToPdf
} from '../controllers/fileController.js';
import { auth, optionalAuth } from '../middleware/auth.js';
import { upload } from '../config/multer.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { virusScan } from '../middleware/virusScan.js';
import { serveOgTags } from '../controllers/ogController.js';
import { trackDownload } from '../controllers/analyticsController.js';

const fileRoutes = express.Router();

fileRoutes.post('/upload', auth, upload.single('file'), rateLimiter, virusScan, uploadFile);
fileRoutes.get('/', auth, getFiles);
fileRoutes.get('/:id', optionalAuth, getFile);
fileRoutes.post('/:id/verify-password', verifyPassword);
fileRoutes.post('/:id/convert-pdf', optionalAuth, convertToPdf);
fileRoutes.delete('/:id', auth, deleteFile);
// Records a download for analytics (honours owner privacy consent).
fileRoutes.post('/:id/download', optionalAuth, trackDownload);
// Crawler-facing Open Graph meta tags for public share links.
fileRoutes.get('/:shareableLink/og', serveOgTags);

export default fileRoutes;