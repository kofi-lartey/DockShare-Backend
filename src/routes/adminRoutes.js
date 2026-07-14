import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  setup, hasAdmin, login, loginVerify, loginOtp, loginOtpVerify, switchMfaMethod, logout
} from '../controllers/adminAuthController.js';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/adminUserController.js';
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from '../controllers/adminCouponController.js';
import { getAnalytics, getAuditLog } from '../controllers/adminAnalyticsController.js';
import { requireMfa } from '../middleware/auth.js';

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin authentication attempts, please try again later.' }
});

const router = express.Router();

// ---- Public (restricted onboarding + MFA challenge issuance) ----
router.post('/setup', adminAuthLimiter, setup);
router.get('/has-admin', hasAdmin);
router.post('/login', adminAuthLimiter, login);
router.post('/login/verify', loginVerify);
router.post('/login-otp', adminAuthLimiter, loginOtp);
router.post('/login-otp/verify', loginOtpVerify);

// ---- Protected: every route below requires admin role + verified MFA ----
router.use(requireMfa);

router.post('/logout', logout);
router.put('/security/mfa', switchMfaMethod);

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.get('/coupons', listCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

router.get('/analytics', getAnalytics);
router.get('/security/audit', getAuditLog);

export default router;
