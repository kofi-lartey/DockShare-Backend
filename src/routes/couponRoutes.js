import express from 'express';
import { verifyCoupon, createCoupon } from '../controllers/couponController.js';
import { auth, requireAdmin } from '../middleware/auth.js';

const couponRoutes = express.Router();

couponRoutes.post('/verify', auth, verifyCoupon);
couponRoutes.post('/', requireAdmin, createCoupon);

export default couponRoutes;
