import express from 'express';
import { 
  updateProfile, 
  changePassword, 
  updatePreferences, 
  getNotifications,
  getProfile,
  updateConsent,
  exportUserData,
  deleteUserData
} from '../controllers/userController.js';
import { requireOnboarding } from '../middleware/auth.js';

const userRoutes = express.Router();

userRoutes.use(requireOnboarding);

userRoutes.get('/profile', getProfile);
userRoutes.put('/profile', updateProfile);
userRoutes.post('/password', changePassword);
userRoutes.put('/preferences', updatePreferences);
userRoutes.get('/notifications', getNotifications);
userRoutes.put('/consent', updateConsent);
userRoutes.get('/data-export', exportUserData);
userRoutes.delete('/data', deleteUserData);

export default userRoutes;