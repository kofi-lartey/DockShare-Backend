import express from 'express';
import { 
  updateProfile, 
  changePassword, 
  updatePreferences, 
  getNotifications,
  getProfile
} from '../controllers/userController.js';
import { requireOnboarding } from '../middleware/auth.js';

const userRoutes = express.Router();

userRoutes.use(requireOnboarding);

userRoutes.get('/profile', getProfile);
userRoutes.put('/profile', updateProfile);
userRoutes.post('/change-password', changePassword);
userRoutes.put('/preferences', updatePreferences);
userRoutes.get('/notifications', getNotifications);

export default userRoutes;