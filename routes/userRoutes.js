import express from 'express';
import { getMe, updateMe, getOrganizerDashboardStats , getOrganizerEventsWithParticipants, getParticipatedEvents } from '../controllers/userController.js';
import requireAuth from '../middlewares/authMiddlewares.js';

const router = express.Router();

// All routes here are protected, so we can use the middleware at the top level
router.use(requireAuth);

router.route('/me').get(getMe)
.put(updateMe);

router.route('/me/dashboard-stats').get(getOrganizerDashboardStats);

router.route('/me/events-with-participants').get(getOrganizerEventsWithParticipants);

router.route('/me/participated-events').get(getParticipatedEvents); // New route

export default router;
