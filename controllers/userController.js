import User from '../models/Users.js';
import Event from '../models/Event.js';
import mongoose from 'mongoose';

// @desc    Get user profile
// @route   GET /api/users/me
// @access  Private
export const getMe = async (req, res) => {
    // req.user is set by the requireAuth middleware
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    res.json(user);
};

// @desc    Update user profile
// @route   PUT /api/users/me
// @access  Private
export const updateMe = async (req, res) => {
    const { nom, prenom, email, password } = req.body;

    const user = await User.findById(req.user.id);

    if (user) {
        user.nom = nom || user.nom;
        user.prenom = prenom || user.prenom;
        user.email = email || user.email;
        if (password) {
            // The pre-save hook in the model will automatically hash it
            user.password = password;
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            nom: updatedUser.nom,
            prenom: updatedUser.prenom,
            email: updatedUser.email,
            role: updatedUser.role,
        });
    } else {
        res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
};

// @desc    Get organizer dashboard statistics
// @route   GET /api/users/me/dashboard-stats
// @access  Private (Organizer)
export const getOrganizerDashboardStats = async (req, res) => {
    try {
        const organizerId = req.user.id;

        const totalEventsCreated = await Event.countDocuments({ organizer: organizerId, status: { $ne: 'brouillon' } });
    
        const publishedEvents = await Event.countDocuments({ organizer: organizerId, status: 'publie' });
        const pendingApprovalEvents = await Event.countDocuments({ organizer: organizerId, status: 'en_attente_approbation' });
        const draftEvents = await Event.countDocuments({ organizer: organizerId, status: 'brouillon' });
        const rejectedEvents = await Event.countDocuments({ organizer: organizerId, status: 'rejete' });
        const cancelledEvents = await Event.countDocuments({ organizer: organizerId, status: 'annule' });
        const finishedEvents = await Event.countDocuments({ organizer: organizerId, status: 'termine' });

        // Aggregate UNIQUE participants for all events created by this organizer
        const uniqueParticipantsResult = await Event.aggregate([
            { $match: { organizer: new mongoose.Types.ObjectId(organizerId) } },
            { $unwind: '$participants' },
            { $group: { _id: '$participants' } },
            { $count: 'total' }
        ]);

        const totalParticipants = uniqueParticipantsResult.length > 0 ? uniqueParticipantsResult[0].total : 0;

        res.json({
            totalEventsCreated,
            publishedEvents,
            pendingApprovalEvents,
            draftEvents,
            rejectedEvents,
            cancelledEvents,
            finishedEvents,
            totalParticipants,
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Get organizer's events with participant counts
// @route   GET /api/users/me/events-with-participants
// @access  Private (Organizer)
export const getOrganizerEventsWithParticipants = async (req, res) => {
    try {
        const organizerId = req.user.id;

        const events = await Event.aggregate([
            { $match: { organizer: new mongoose.Types.ObjectId(organizerId), status: { $ne: 'brouillon' } } },
            { $project: {
                _id: 1,
                name: 1,
                participantsCount: { $size: '$participants' }
            }},
            { $sort: { name: 1 } } // Sort by event name for consistent chart display
        ]);

        res.json(events);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Get events participated in by the authenticated user
// @route   GET /api/users/me/participated-events
// @access  Private (Participant)
export const getParticipatedEvents = async (req, res) => {
    try {
        const userId = req.user.id;
        const { search, category, isOnline, page = 1, limit = 6 } = req.query;

        let query = {
            participants: { $in: [userId] },
            status: 'publie'
        };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (category) {
            query.category = category;
        }

        if (isOnline !== undefined) {
            query.isOnline = isOnline === 'true'; // Convert string to boolean
        }

        const totalEvents = await Event.countDocuments(query);
        const totalPages = Math.ceil(totalEvents / limit);

        const events = await Event.find(query)
            .populate('location', 'name address')
            .populate('category', 'name')
            .populate('organizer', 'nom prenom')
            .sort({ startDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            events,
            currentPage: parseInt(page),
            totalPages,
            totalEvents
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};