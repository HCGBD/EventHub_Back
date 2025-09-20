import express from 'express';
import { getMyTickets } from '../controllers/ticketController.js';
import requireAuth from '../middlewares/authMiddlewares.js';

const router = express.Router();

// @route   GET /api/tickets/my-tickets
// @desc    Get all tickets for the logged-in user
// @access  Private
router.get('/my-tickets', requireAuth, getMyTickets);

export default router;
