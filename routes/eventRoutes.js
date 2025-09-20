import express from 'express'
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
  submitForApproval,
  approveEvent,
  rejectEvent,
  cancelEvent,
  revertToDraft,
  revertRejectedToDraft,
  cancelApproval,
  revertFromRejectionByOrganizer,
  getPaginatedEvents,
  simulatePaymentForEvent,
  markPastEventsAsFinished
} from '../controllers/eventController.js'
import requireAuth from '../middlewares/authMiddlewares.js'
import optionalAuth from '../middlewares/optionalAuth.js'
import { requireRole } from '../middlewares/roleMiddleware.js'
import upload from '../middlewares/uploadMiddleware.js'

const router = express.Router()

// Public event routes
router.get('/', optionalAuth, getAllEvents)
router.get('/paginated', optionalAuth, getPaginatedEvents) // New route for paginated events
router.get('/:id', optionalAuth, getEventById)

// Organizer routes
router.post(
  '/',
  requireAuth,
  requireRole(['organizer', 'admin']),
  upload.array('images', 10),
  createEvent
)

// Organizer & Admin routes
router.put(
  '/:id',
  requireAuth,
  requireRole(['organizer', 'admin']),
  upload.array('images', 10),
  updateEvent
)
router.delete(
  '/:id',
  requireAuth,
  requireRole(['organizer', 'admin']),
  deleteEvent
)

// Participant routes
router.post(
  '/:id/register',
  requireAuth,
  requireRole('participant'),
  registerForEvent
)
router.post(
  '/:id/simulate-payment',
  requireAuth,
  requireRole('participant'),
  simulatePaymentForEvent
)
router.delete(
  '/:id/register',
  requireAuth,
  requireRole('participant'),
  unregisterFromEvent
)

// Event Status Management Routes
router.patch(
  '/:id/submit-for-approval',
  requireAuth,
  requireRole(['organizer', 'admin']),
  submitForApproval
)
router.patch('/:id/approve', requireAuth, requireRole('admin'), approveEvent)
router.patch('/:id/reject', requireAuth, requireRole('admin'), rejectEvent)
router.patch(
  '/:id/cancel',
  requireAuth,
  requireRole(['organizer', 'admin']),
  cancelEvent
)
router.patch(
  '/:id/revert-to-draft',
  requireAuth,
  requireRole(['organizer', 'admin']),
  revertToDraft
)
router.patch(
  '/:id/revert-rejected-to-draft',
  requireAuth,
  requireRole('admin'),
  revertRejectedToDraft
)
router.patch(
  '/:id/cancel-approval',
  requireAuth,
  requireRole(['organizer', 'admin']),
  cancelApproval
)

// Route for organizer to revert their own rejected event
router.patch(
  '/:id/revert-from-rejection',
  requireAuth,
  requireRole('organizer'),
  revertFromRejectionByOrganizer
)

// Admin route to mark past events as finished
router.patch(
  '/mark-past-as-finished',
  requireAuth,
  requireRole('admin'),
  markPastEventsAsFinished
)

export default router
