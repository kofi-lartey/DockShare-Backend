import express from 'express';
import { 
  getDashboardStats, 
  getRecentActivity, 
  getAnalytics 
} from '../controllers/dashboardController.js';
import { auth } from '../middleware/auth.js';

const dashboardRoutes = express.Router();

dashboardRoutes.use(auth);

dashboardRoutes.get('/stats', getDashboardStats);
dashboardRoutes.get('/activity', getRecentActivity);
dashboardRoutes.get('/analytics', getAnalytics);

export default dashboardRoutes;