import express from 'express';
import { 
  register, 
  login, 
  verifyEmail, 
  forgotPassword, 
  resetPassword 
} from '../controllers/authController.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const authRoutes = express.Router();

authRoutes.post('/register', rateLimiter, register);
authRoutes.post('/login', rateLimiter, login);
authRoutes.get('/verify-email/:token', verifyEmail);
authRoutes.post('/forgot-password', rateLimiter, forgotPassword);
authRoutes.post('/reset-password/:token', rateLimiter, resetPassword);

export default authRoutes;