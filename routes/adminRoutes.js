import express from 'express';
import { getAllUsers, deleteUser, updateUserRole , getDashboardStats , getEventActivityStats } from '../controllers/adminController.js';
import requireAuth from '../middlewares/authMiddlewares.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = express.Router();


router.use(requireAuth, requireRole('admin'));

router.route('/users').get(getAllUsers);

router.route('/users/:id').delete(deleteUser);

router.route('/users/:id/role').patch(updateUserRole);

router.route('/dashboard-stats').get(getDashboardStats);

router.route('/event-activity-stats').get(getEventActivityStats);

export default router;