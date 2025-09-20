import Event from '../models/Event.js';
import { sendEmail } from '../services/emailService.js';
import cloudinary from '../configs/cloudinary.js';

// Helper function to upload a buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
};

import Ticket from '../models/Ticket.js';

// @desc    Create a new event
// @route   POST /api/events
// @access  Private (Organizer)
export const createEvent = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            startDate, 
            endDate, 
            location, 
            category, 
            price, 
            maxParticipants,
            isOnline,
            onlineUrl
        } = req.body;

        const organizer = req.user.id; // From requireAuth middleware

        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
            const uploadResults = await Promise.all(uploadPromises);
            imageUrls = uploadResults.map(result => result.secure_url);
        }

        const event = new Event({
            name,
            description,
            startDate,
            endDate,
            location,
            category,
            price,
            maxParticipants,
            organizer,
            images: imageUrls,
            isOnline,
            onlineUrl
            // status will default to 'brouillon' as per the model
        });

        const createdEvent = await event.save();
        res.status(201).json(createdEvent);
    } catch (err) {
        // Mongoose validation errors or custom pre-save errors from the model
        if (err.name === 'ValidationError' || err.message.includes('événement') || err.message.includes('date')) {
            return res.status(400).json({ message: err.message });
        }
        // Other internal errors
        res.status(500).json({ message: 'Erreur serveur lors de la création de l\'événement', error: err.message });
    }
};

export const getAllEvents = async (req, res) => {
    try {
        // Ensure past events are marked as finished before fetching
        await markPastEventsAsFinished(req, res, true);

        const { category, location, startDate, search } = req.query;
        let filterConditions = {};

        if (category) {
            filterConditions.category = category;
        }

        if (location) {
            filterConditions.location = location;
        }

        if (startDate) {
            filterConditions.startDate = { $gte: new Date(startDate) };
        }

        if (search) {
            filterConditions.$text = { $search: search };
        }

        let finalQuery = {};
        const baseStatusQuery = { status: 'publie' };

        if (req.user && req.user.role === 'admin') {
            finalQuery = filterConditions;
        }
        else if (req.user && req.user.role === 'organizer') {
            // Organizer sees ONLY their own filtered events
            finalQuery = {
                ...filterConditions,
                organizer: req.user.id
            };
        }
        else {
            finalQuery = {
                ...filterConditions,
                ...baseStatusQuery
            };
        }

        let query = Event.find(finalQuery)
            .populate('location', 'name')
            .populate('category', 'name')
            .populate('organizer', 'nom prenom _id');

        // Conditionally populate participants if user is logged in
        if (req.user) {
            query = query.populate('participants', '_id'); // Only need _id for checking participation
        }

        const events = await query;
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Get all events with pagination
// @route   GET /api/events/paginated
// @access  Public
export const getPaginatedEvents = async (req, res) => {
    try {
        // Ensure past events are marked as finished before fetching
        await markPastEventsAsFinished(req, res, true);

        const { category, location, startDate, search, isOnline, page = 1, limit = 10 } = req.query;
        let filterConditions = {};

        if (category) {
            filterConditions.category = category;
        }

        if (location) {
            filterConditions.location = location;
        }

        if (startDate) {
            filterConditions.startDate = { $gte: new Date(startDate) };
        }

        if (search) {
            filterConditions.$text = { $search: search };
        }

        if (isOnline !== undefined) {
            filterConditions.isOnline = isOnline === 'true'; // Convert string to boolean
        }

        let finalQuery = {};
        const baseStatusQuery = { status: 'publie' };

        if (req.user && req.user.role === 'admin') {
            finalQuery = filterConditions;
        }
        else if (req.user && req.user.role === 'organizer') {
            // Organizer sees ONLY their own filtered events
            finalQuery = {
                ...filterConditions,
                organizer: req.user.id
            };
        }
        else {
            finalQuery = {
                ...filterConditions,
                ...baseStatusQuery
            };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalEvents = await Event.countDocuments(finalQuery);
        const events = await Event.find(finalQuery)
            .populate('location', 'name')
            .populate('category', 'name')
            .populate('organizer', 'nom prenom _id')
            .limit(parseInt(limit))
            .skip(skip);

        res.json({
            events,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalEvents / parseInt(limit)),
            totalEvents,
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};


// @desc    Get a single event by ID
// @route   GET /api/events/:id
// @access  Public
export const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('location')
            .populate('category', 'name')
            .populate('organizer', 'nom prenom email')
            .populate('participants', 'nom prenom');

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        const isPublished = event.status === 'publie';
        const isOrganizer = req.user && event.organizer.equals(req.user.id);
        const isAdmin = req.user && req.user.role === 'admin';

        if (isPublished || isOrganizer || isAdmin) {
            res.json(event);
        } else {
            return res.status(404).json({ message: 'Événement non trouvé ou accès refusé' });
        }

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private (Organizer/Admin)
export const updateEvent = async (req, res) => {
    try {
        const { name, description, startDate, endDate, location, category, price, maxParticipants, status, isOnline, onlineUrl, imagesToDelete } = req.body; // Destructure imagesToDelete
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        const isOrganizer = event.organizer.equals(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isOrganizer && !isAdmin) {
            return res.status(403).json({ message: 'Action non autorisée' });
        }

        event.name = name || event.name;
        event.description = description || event.description;
        event.startDate = startDate || event.startDate;
        event.endDate = endDate || event.endDate;
        event.location = location || event.location;
        event.category = category || event.category;
        event.price = price !== undefined ? price : event.price;
        event.maxParticipants = maxParticipants || event.maxParticipants;

        if (isOnline !== undefined) {
            event.isOnline = isOnline;
        }
        if (onlineUrl !== undefined) {
            event.onlineUrl = onlineUrl;
        }
        if (isOnline === false) {
            event.onlineUrl = undefined;
        }

        if (status) {
            event.status = status;
        }

        if (isOrganizer && event.organizer.equals(req.user.id) && event.status === 'rejete') {
            event.status = 'brouillon';
        }

        let currentImages = event.images || []; // Get current images

        // Handle images to delete
        if (imagesToDelete) {
            const imagesToDeleteArray = JSON.parse(imagesToDelete);
            currentImages = currentImages.filter(img => !imagesToDeleteArray.includes(img));
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
            const uploadResults = await Promise.all(uploadPromises);
            const newImageUrls = uploadResults.map(result => result.secure_url);
            currentImages = [...currentImages, ...newImageUrls];
        }

        event.images = currentImages; // Assign the updated image array

        const updatedEvent = await event.save();
        res.json(updatedEvent);

    } catch (err) {
        if (err.name === 'ValidationError' || err.message.includes('événement') || err.message.includes('date')) {
            return res.status(400).json({ message: err.message });
        }
        res.status(400).json({ message: 'Erreur lors de la mise à jour de l\'événement', error: err.message });
    }
};

// @desc    Submit an event for approval
// @route   PATCH /api/events/:id/submit-for-approval
// @access  Private (Organizer)
export const submitForApproval = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        const isOrganizer = event.organizer.equals(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isOrganizer && !isAdmin) {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        if (event.status !== 'brouillon') {
            return res.status(400).json({ message: 'L\'événement doit être en statut brouillon pour être soumis à approbation.' });
        }

        event.status = 'en_attente_approbation';
        await event.save();
        res.json({ message: 'Événement soumis à approbation avec succès.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la soumission de l\'événement.', error: err.message });
    }
};

// @desc    Approve an event
// @route   PATCH /api/events/:id/approve
// @access  Private (Admin)
export const approveEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        if (event.status !== 'en_attente_approbation') {
            return res.status(400).json({ message: 'L\'événement doit être en attente d\'approbation pour être approuvé.' });
        }

        event.status = 'publie';
        event.rejectionReason = null;
        await event.save();
        res.json({ message: 'Événement approuvé avec succès.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de l\'approbation de l\'événement.', error: err.message });
    }
};

// @desc    Reject an event
// @route   PATCH /api/events/:id/reject
// @access  Private (Admin)
export const rejectEvent = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        if (!rejectionReason) {
            return res.status(400).json({ message: 'Le motif du rejet est requis.' });
        }

        const event = await Event.findById(req.params.id).populate('organizer', 'nom prenom email');

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        if (event.status !== 'en_attente_approbation') {
            return res.status(400).json({ message: 'L\'événement doit être en attente d\'approbation pour être rejeté.' });
        }

        event.status = 'rejete';
        event.rejectionReason = rejectionReason;
        await event.save();

        try {
            const organizer = event.organizer;
            const subject = `Votre événement "${event.name}" a été rejeté`;
            const htmlContent = `
                <h1>Mise à jour concernant votre événement</h1>
                <p>Bonjour ${organizer.prenom},</p>
                <p>Nous vous informons que votre événement "<strong>${event.name}</strong>" a été examiné et rejeté.</p>
                <p><strong>Motif du rejet :</strong></p>
                <p><em>${rejectionReason}</em></p>
                <p>Vous pouvez remettre votre événement en brouillon depuis votre tableau de bord pour y apporter les modifications nécessaires.</p>
                <p>Cordialement,<br>L'équipe EventHub</p>
            `;
            await sendEmail(organizer.email, subject, htmlContent);
        } catch (emailError) {
            console.error('Failed to send rejection email:', emailError);
        }

        res.json({ message: 'Événement rejeté avec succès.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors du rejet de l\'événement.', error: err.message });
    }
};

// @desc    Cancel an event
// @route   PATCH /api/events/:id/cancel
// @access  Private (Organizer/Admin)
export const cancelEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        const isOrganizer = event.organizer.equals(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isOrganizer && !isAdmin) {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        if (event.status === 'annule' || event.status === 'termine') {
            return res.status(400).json({ message: 'L\'événement ne peut pas être annulé.' });
        }

        event.status = 'annule';
        await event.save();
        res.json({ message: 'Événement annulé avec succès.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de l\'annulation de l\'événement.', error: err.message });
    }
};

// @desc    Revert an event from cancelled to draft
// @route   PATCH /api/events/:id/revert-to-draft
// @access  Private (Organizer)
export const revertToDraft = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        const isOrganizer = event.organizer.equals(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isOrganizer && !isAdmin) {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        if (event.status !== 'annule') {
            return res.status(400).json({ message: 'L\'événement doit être annulé pour être remis en brouillon.' });
        }

        event.status = 'brouillon';
        await event.save();
        res.json({ message: 'Événement remis en brouillon avec succès.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la remise en brouillon.', error: err.message });
    }
};

// @desc    Revert a rejected event to draft
// @route   PATCH /api/events/:id/revert-rejected-to-draft
// @access  Private (Admin)
export const revertRejectedToDraft = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        if (event.status !== 'rejete') {
            return res.status(400).json({ message: 'L\'événement doit être rejeté pour être remis en brouillon.' });
        }

        event.status = 'brouillon';
        await event.save();
        res.json({ message: 'Événement rejeté remis en brouillon.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la remise en brouillon.', error: err.message });
    }
};

// @desc    Cancel approval for an event (revert to draft)
// @route   PATCH /api/events/:id/cancel-approval
// @access  Private (Organizer/Admin)
export const cancelApproval = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        const isOrganizer = event.organizer.equals(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isOrganizer && !isAdmin) {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        if (event.status !== 'en_attente_approbation') {
            return res.status(400).json({ message: 'L\'événement doit être en attente d\'approbation.' });
        }

        event.status = 'brouillon';
        await event.save();
        res.json({ message: 'Approbation annulée. Événement remis en brouillon.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de l\'annulation de l\'approbation.', error: err.message });
    }
};


// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private (Organizer/Admin)
export const deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        const isOrganizer = event.organizer.equals(req.user.id);
        const isAdmin = req.user.role === 'admin';

        if (!isOrganizer && !isAdmin) {
            return res.status(403).json({ message: 'Action non autorisée' });
        }

        await event.delete(req.user.id);

        res.json({ message: 'Événement supprimé avec succès' });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

import QRCode from 'qrcode';

// @desc    Register a user for an event (Free events only)
// @route   POST /api/events/:id/register
// @access  Private (Participant)
export const registerForEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('location', 'name');

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        if (event.price > 0) {
            return res.status(400).json({ message: 'Cet événement est payant. Veuillez utiliser la procédure d\'achat.' });
        }

        if (event.status !== 'publie') {
            return res.status(400).json({ message: 'Cet événement n\'est pas ouvert aux inscriptions.' });
        }

        if (event.participants.length >= event.maxParticipants) {
            return res.status(400).json({ message: 'Cet événement est complet.' });
        }

        const userId = req.user.id;

        if (event.participants.includes(userId)) {
            return res.status(400).json({ message: 'Vous êtes déjà inscrit.' });
        }

        if (event.organizer.equals(userId)) {
            return res.status(400).json({ message: 'Un organisateur ne peut pas s\'inscrire.' });
        }

        // Create a new ticket
        const newTicket = new Ticket({
            event: event._id,
            user: userId,
            priceAtPurchase: 0, // Free event
        });
        await newTicket.save();

        // Add user to participants array for compatibility
        event.participants.push(userId);
        await event.save();

        const qrCodeBuffer = await QRCode.toBuffer(newTicket.qrCodeData);

        // Send confirmation email with ticket info
        const userEmail = req.user.email;
        const userName = req.user.prenom;
        const subject = `Votre billet pour: ${event.name}`;
        const attachments = [{
            filename: 'qrcode.png',
            content: qrCodeBuffer,
            cid: 'ticketQRCode' // Unique CID
        }];
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h1>Votre Billet Électronique</h1>
                <p>Bonjour ${userName},</p>
                <p>Merci pour votre inscription à l'événement: <strong>${event.name}</strong>.</p>
                <div style="border: 1px solid #ddd; padding: 15px; text-align: center; background-color: #f9f9f9;">
                    <p>Voici votre numéro de billet :</p>
                    <h2 style="font-size: 24px; margin: 10px 0;">${newTicket.ticketNumber}</h2>
                    <p>Veuillez présenter ce QR code à l'entrée.</p>
                    <img src="cid:ticketQRCode" alt="QR Code de votre billet" style="width: 200px; height: 200px; margin-top: 10px;"/>
                </div>
                <hr style="margin: 20px 0;">
                <h3>Détails de l'événement</h3>
                <p><strong>Date:</strong> ${event.startDate.toLocaleDateString('fr-FR')}</p>
                <p><strong>Heure:</strong> ${event.startDate.toLocaleTimeString('fr-FR')}</p>
                <p><strong>Lieu:</strong> ${event.isOnline ? 'En ligne' : (event.location ? event.location.name : 'N/A')}</p>
            </div>
        `;

        try {
            await sendEmail(userEmail, subject, htmlContent, attachments);
        } catch (emailError) {
            console.error('Failed to send ticket confirmation email:', emailError);
        }

        res.status(201).json({ message: 'Inscription réussie. Votre billet a été envoyé par e-mail.', ticket: newTicket });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.', error: err.message });
    }
};

// @desc    Simulate a successful payment and register a user for a paid event
// @route   POST /api/events/:id/simulate-payment
// @access  Private (Participant)
export const simulatePaymentForEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('location', 'name');

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        if (event.price === 0) {
            return res.status(400).json({ message: 'Cet événement est gratuit. Veuillez utiliser la procédure d\'inscription gratuite.' });
        }

        if (event.status !== 'publie') {
            return res.status(400).json({ message: 'Cet événement n\'est pas ouvert aux inscriptions.' });
        }
        if (event.participants.length >= event.maxParticipants) {
            return res.status(400).json({ message: 'Cet événement est complet.' });
        }
        const userId = req.user.id;
        if (event.participants.includes(userId)) {
            return res.status(400).json({ message: 'Vous êtes déjà inscrit.' });
        }
        if (event.organizer.equals(userId)) {
            return res.status(400).json({ message: 'Un organisateur ne peut pas s\'inscrire.' });
        }

        const newTicket = new Ticket({
            event: event._id,
            user: userId,
            priceAtPurchase: event.price,
        });
        await newTicket.save();

        event.participants.push(userId);
        await event.save();

        const qrCodeBuffer = await QRCode.toBuffer(newTicket.qrCodeData);

        const userEmail = req.user.email;
        const userName = req.user.prenom;
        const subject = `Votre billet pour: ${event.name}`;
        const attachments = [{
            filename: 'qrcode.png',
            content: qrCodeBuffer,
            cid: 'ticketQRCode'
        }];
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h1>Votre Billet Électronique</h1>
                <p>Bonjour ${userName},</p>
                <p>Merci pour votre achat pour l'événement: <strong>${event.name}</strong>.</p>
                <div style="border: 1px solid #ddd; padding: 15px; text-align: center; background-color: #f9f9f9;">
                    <p>Voici votre numéro de billet :</p>
                    <h2 style="font-size: 24px; margin: 10px 0;">${newTicket.ticketNumber}</h2>
                    <p>Veuillez présenter ce QR code à l'entrée.</p>
                    <img src="cid:ticketQRCode" alt="QR Code de votre billet" style="width: 200px; height: 200px; margin-top: 10px;"/>
                </div>
                <hr style="margin: 20px 0;">
                <h3>Détails de l'événement</h3>
                <p><strong>Date:</strong> ${event.startDate.toLocaleDateString('fr-FR')}</p>
                <p><strong>Heure:</strong> ${event.startDate.toLocaleTimeString('fr-FR')}</p>
                <p><strong>Lieu:</strong> ${event.isOnline ? 'En ligne' : (event.location ? event.location.name : 'N/A')}</p>
            </div>
        `;

        try {
            await sendEmail(userEmail, subject, htmlContent, attachments);
        } catch (emailError) {
            console.error('Failed to send ticket confirmation email:', emailError);
        }

        res.status(201).json({ message: 'Paiement simulé réussi. Votre billet a été envoyé par e-mail.', ticket: newTicket });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur serveur lors de la simulation de paiement.', error: err.message });
    }
};

// @desc    Unregister a user from an event
// @route   DELETE /api/events/:id/register
// @access  Private (Participant)
export const unregisterFromEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé' });
        }

        const userId = req.user.id;

        const participantIndex = event.participants.indexOf(userId);

        if (participantIndex === -1) {
            return res.status(400).json({ message: 'Vous n\'êtes pas inscrit.' });
        }

        event.participants.splice(participantIndex, 1);
        await event.save();

        res.json({ message: 'Désinscription réussie.' });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Revert a rejected event to draft by its organizer
// @route   PATCH /api/events/:id/revert-from-rejection
// @access  Private (Organizer)
export const revertFromRejectionByOrganizer = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Événement non trouvé.' });
        }

        if (!event.organizer.equals(req.user.id)) {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        if (event.status !== 'rejete') {
            return res.status(400).json({ message: 'L\'événement doit être rejeté.' });
        }

        event.status = 'brouillon';
        event.rejectionReason = null;
        await event.save();
        res.json({ message: 'Événement remis en brouillon.', event });

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur lors de la remise en brouillon.', error: err.message });
    }
};

// @desc    Mark past published events as 'termine'
// @route   PATCH /api/events/mark-past-as-finished (Internal/Admin only)
// @access  Private (Admin)
export const markPastEventsAsFinished = async (req, res, internalCall = false) => {
    try {
        const now = new Date();
        const result = await Event.updateMany(
            { 
                endDate: { $lt: now }, 
                status: 'publie' 
            },
            { $set: { status: 'termine' } }
        );

        if (!internalCall) {
            res.json({
                message: `${result.modifiedCount} événements ont été marqués comme terminés.`,
                modifiedCount: result.modifiedCount,
            });
        } else {
            // For internal calls, just log or return the result
            console.log(`Internal call: ${result.modifiedCount} events marked as finished.`);
            return result;
        }
    } catch (err) {
        console.error('Erreur lors du marquage des événements terminés:', err);
        if (!internalCall) {
            res.status(500).json({ message: 'Erreur serveur lors du marquage des événements terminés.', error: err.message });
        }
        throw err; // Re-throw for internal callers to handle
    }
};
