import { log } from 'console';
import Location from '../models/Location.js';
import User from '../models/Users.js'; // Assuming User model is needed for createdBy/validatedBy


// @desc    Get all locations
// @route   GET /api/locations
// @access  Public (approved only) / Admin (all) / Organizer (approved + own)
export const getAllLocations = async (req, res) => {
    try {
        let query = {};
        const { validated } = req.query; // Get the validated query param

        // If the request specifically asks for validated locations, only return approved ones.
        if (validated === 'true') {
            query.status = 'approuve';
        } else {
            // Otherwise, use the existing role-based logic
            if (req.user && req.user.role === 'admin') {
                // No filter for admin
            }
            else if (req.user && req.user.role === 'organizer') {
                query = {
                    $or: [
                        { status: 'approuve' },
                        { createdBy: req.user.id }
                    ]
                };
            }
            else {
                query.status = 'approuve';
            }
        }

        const locations = await Location.find(query).populate('createdBy', 'nom prenom email').populate('validatedBy', 'nom prenom email');
        res.json(locations);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Get all locations with pagination
// @route   GET /api/locations/paginated
// @access  Public (approved only) / Admin (all) / Organizer (approved + own)
export const getPaginatedLocations = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        let query = {};

        // For public access, only approved locations are shown
        // For admin, all locations are shown
        // For organizer, approved locations and their own locations are shown
        if (req.user && req.user.role === 'admin') {
            // No status filter for admin
        } else if (req.user && req.user.role === 'organizer') {
            query = {
                $or: [
                    { status: 'approuve' },
                    { createdBy: req.user.id }
                ]
            };
        } else {
            query.status = 'approuve';
        }

        if (search) {
            query.$text = { $search: search };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalLocations = await Location.countDocuments(query);
        const locations = await Location.find(query)
            .populate('createdBy', 'nom prenom email')
            .populate('validatedBy', 'nom prenom email')
            .limit(parseInt(limit))
            .skip(skip);

        res.json({
            locations,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalLocations / parseInt(limit)),
            totalLocations,
        });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Get single location by ID
// @route   GET /api/locations/:id
// @access  Public (approved only) / Admin (any) / Organizer (own)
export const getLocationById = async (req, res) => {
    try {
        const location = await Location.findById(req.params.id).populate('createdBy', 'nom prenom email').populate('validatedBy', 'nom prenom email');

        if (!location) {
            return res.status(404).json({ message: 'Lieu non trouvé' });
        }

        const isOwner = req.user && location.createdBy && location.createdBy.equals(req.user.id);
        const isAdmin = req.user && req.user.role === 'admin';
        const isApproved = location.status === 'approuve';

        // Public users can only see approved locations.
        // Organizers can see approved locations OR their own.
        // Admins can see everything.
        if (isApproved || isAdmin || isOwner) {
            res.json(location);
        } else {
            // Use 404 to avoid revealing the existence of a resource
            res.status(404).json({ message: 'Lieu non trouvé ou accès refusé' });
        }

    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

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

// @desc    Create a new location
// @route   POST /api/locations
// @access  Organizer or Admin
export const createLocation = async (req, res) => {
    try {
        let { name, description, address, coordinates } = req.body;
        const createdBy = req.user.id;

        const existingLocation = await Location.findOne({ name, deleted: false });
        if (existingLocation) {
            return res.status(400).json({ message: 'Un lieu avec ce nom existe déjà.' });
        }

        if (typeof coordinates === 'string') {
            coordinates = JSON.parse(coordinates);
        }

        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
            const uploadResults = await Promise.all(uploadPromises);
            imageUrls = uploadResults.map(result => result.secure_url);
        }

        const location = new Location({
            name,
            description,
            address,
            coordinates,
            images: imageUrls,
            createdBy,
            status: 'en_attente',
        });

        const createdLocation = await location.save();
        res.status(201).json(createdLocation);
    } catch (err) {
        res.status(400).json({ message: 'Erreur lors de la création du lieu', error: err.message });
    }
};

// @desc    Update a location
// @route   PUT /api/locations/:id
// @access  Organizer (own location) / Admin (any location)
export const updateLocation = async (req, res) => {
    try {
        let { name, description, address, coordinates, imagesToDelete } = req.body;
        const location = await Location.findById(req.params.id);

        if (!location) {
            return res.status(404).json({ message: 'Lieu non trouvé' });
        }

        if (req.user.role !== 'admin' && location.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Non autorisé à modifier ce lieu' });
        }

        if (typeof coordinates === 'string') {
            coordinates = JSON.parse(coordinates);
        }

        location.name = name || location.name;
        location.description = description || location.description;
        location.address = address || location.address;
        location.coordinates = coordinates || location.coordinates;

        let currentImages = location.images || [];

        if (imagesToDelete) {
            const imagesToDeleteArray = JSON.parse(imagesToDelete);
            currentImages = currentImages.filter(img => !imagesToDeleteArray.includes(img));
        }

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
            const uploadResults = await Promise.all(uploadPromises);
            const newImageUrls = uploadResults.map(result => result.secure_url);
            currentImages = [...currentImages, ...newImageUrls];
        }

        location.images = currentImages;

        const updatedLocation = await location.save();
        res.json(updatedLocation);
    } catch (err) {
        res.status(400).json({ message: 'Erreur lors de la mise à jour du lieu', error: err.message });
    }
};

// @desc    Delete a location
// @route   DELETE /api/locations/:id
// @access  Admin
export const deleteLocation = async (req, res) => {
    try {
        const location = await Location.findById(req.params.id);

        if (location) {
            await location.delete(req.user.id); // Soft delete, recording who deleted it
            res.json({ message: 'Lieu supprimé (soft delete)' });
        } else {
            res.status(404).json({ message: 'Lieu non trouvé' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Approve a location
// @route   PATCH /api/locations/:id/approve
// @access  Admin
export const approveLocation = async (req, res) => {
    try {
        const location = await Location.findById(req.params.id);

        if (location) {
            location.status = 'approuve';
            location.validatedBy = req.user.id; // Admin who approved it

            const updatedLocation = await location.save();
            res.json(updatedLocation);
        } else {
            res.status(404).json({ message: 'Lieu non trouvé' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Reject a location
// @route   PATCH /api/locations/:id/reject
// @access  Admin
export const rejectLocation = async (req, res) => {
    try {
        const location = await Location.findById(req.params.id);

        if (location) {
            location.status = 'rejete';
            location.validatedBy = req.user.id; // Admin who rejected it

            const updatedLocation = await location.save();
            res.json(updatedLocation);
        } else {
            res.status(404).json({ message: 'Lieu non trouvé' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Set a location status to pending
// @route   PATCH /api/locations/:id/set-pending
// @access  Admin
export const setPendingLocation = async (req, res) => {
    try {
        const location = await Location.findById(req.params.id);

        if (location) {
            location.status = 'en_attente';
            location.validatedBy = undefined; // Clear the admin who previously validated/rejected

            const updatedLocation = await location.save();
            res.json(updatedLocation);
        } else {
            res.status(404).json({ message: 'Lieu non trouvé' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};