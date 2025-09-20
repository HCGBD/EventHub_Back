import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingController.js';
import requireAuth from '../middlewares/authMiddlewares.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Public route to get settings (e.g., for frontend display)
router.get('/', getSettings);

// Admin route to update settings
router.put(
  '/',
  requireAuth,
  requireRole('admin'),
  upload.any(),
  updateSettings
);

export default router;
