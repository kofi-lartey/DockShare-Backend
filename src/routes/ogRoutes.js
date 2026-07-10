import express from 'express';
import { getOgPreview } from '../controllers/ogController.js';
import { auth } from '../middleware/auth.js';

const ogRoutes = express.Router();

// Extract OG metadata from an external URL for the share link-preview card.
ogRoutes.get('/preview', auth, getOgPreview);

export default ogRoutes;
