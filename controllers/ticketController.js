import Ticket from '../models/Ticket.js';

// @desc    Get all tickets for the logged-in user
// @route   GET /api/tickets/my-tickets
// @access  Private
export const getMyTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.user.id })
            .populate({
                path: 'event',
                select: 'name startDate images isOnline onlineUrl location',
                populate: {
                    path: 'location',
                    select: 'name address'
                }
            })
            .sort({ createdAt: -1 });

        if (!tickets) {
            return res.status(404).json({ message: 'Aucun billet trouvé pour cet utilisateur.' });
        }

        res.json(tickets);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des billets.' });
    }
};
