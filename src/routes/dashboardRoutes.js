import express from 'express';
import { 
  getDashboardStats, 
  getRecentActivity, 
  getAnalytics 
} from '../controllers/dashboardController.js';
import { requireOnboarding } from '../middleware/auth.js';

const dashboardRoutes = express.Router();

dashboardRoutes.use(requireOnboarding);

dashboardRoutes.get('/stats', getDashboardStats);
dashboardRoutes.get('/activity', getRecentActivity);
dashboardRoutes.get('/analytics', getAnalytics);

export default dashboardRoutes;