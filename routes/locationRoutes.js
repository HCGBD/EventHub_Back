import express from 'express';
import {
    createLocation,
    getAllLocations,
    getLocationById,
    updateLocation,
    deleteLocation,
    approveLocation,
    rejectLocation,
    setPendingLocation,
    getPaginatedLocations
} from '../controllers/locationController.js';
import requireAuth from '../middlewares/authMiddlewares.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import optionalAuth from '../middlewares/optionalAuth.js';

const router = express.Router();

// Public routes (logic in controller handles role-based filtering)
router.get('/', optionalAuth, getAllLocations);
router.get('/paginated', optionalAuth, getPaginatedLocations); // New route for paginated locations
router.get('/:id', optionalAuth, getLocationById);

// Organizer routes
router.post('/', requireAuth, requireRole(['organizer', 'admin']), upload.array('images', 10), (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Multer error: ${err.message}` });
    } else if (err) {
        return res.status(500).json({ message: `Unknown error during upload: ${err.message}` });
    }
    next();
}, createLocation);
router.put('/:id', requireAuth, upload.array('images', 10), (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Multer error: ${err.message}` });
    } else if (err) {
        return res.status(500).json({ message: `Unknown error during upload: ${err.message}` });
    }
    next();
}, updateLocation); // Organizer (own location) / Admin (any location)

// Admin routes
router.delete('/:id', requireAuth, requireRole('admin'), deleteLocation);
router.patch('/:id/approve', requireAuth, requireRole('admin'), approveLocation);
router.patch('/:id/reject', requireAuth, requireRole('admin'), rejectLocation);
router.patch('/:id/set-pending', requireAuth, requireRole('admin'), setPendingLocation);

export default router;