import express from 'express';
import { 
  register, 
  login, 
  verifyOtp, 
  forgotPassword, 
  resetPassword,
  getOnboardingStatus,
  getMe,
  logout,
  resendVerification,
  sendOtpLogin,
  loginWithOtp
} from '../controllers/authController.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { auth } from '../middleware/auth.js';

const authRoutes = express.Router();

authRoutes.post('/register', rateLimiter, register);
authRoutes.post('/login', rateLimiter, login);
authRoutes.post('/send-otp-login', rateLimiter, sendOtpLogin);
authRoutes.post('/login-with-otp', loginWithOtp);
authRoutes.post('/resend-verification', rateLimiter, resendVerification);
authRoutes.post('/verify-otp', verifyOtp);
authRoutes.post('/forgot-password', rateLimiter, forgotPassword);
authRoutes.post('/reset-password/:token', rateLimiter, resetPassword);
authRoutes.get('/onboarding-status', auth, getOnboardingStatus);
authRoutes.get('/me', auth, getMe);
authRoutes.post('/logout', auth, logout);

export default authRoutes;