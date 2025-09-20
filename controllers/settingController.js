import Setting from '../models/Setting.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get the uploads directory path
const getUploadsDirPath = () => path.join(__dirname, '..', 'uploads');

// @desc    Get application settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      // If no settings exist, create default ones
      settings = await Setting.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des paramètres', error: err.message });
  }
};

// @desc    Update application settings
// @route   PUT /api/settings
// @access  Private (Admin)
export const updateSettings = async (req, res) => {
  try {
    console.log('--- updateSettings START ---');
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);

    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }

    const { aboutText, carousel, carouselWelcomeText, carouselAppNameText, carouselDescriptionText, founderName, founderRole, founderBio, callToActionText, values } = req.body;
    // req.files will be an array of all files when using upload.any()
    const mainLogoFile = req.files?.find(file => file.fieldname === 'mainLogo');
    const darkModeLogoFile = req.files?.find(file => file.fieldname === 'darkModeLogo');
    const newCarouselImagesFiles = req.files?.filter(file => file.fieldname.startsWith('newCarouselImages'));
    const founderImageFile = req.files?.find(file => file.fieldname === 'founderImage');

    // Handle mainLogo update
    if (mainLogoFile) {
      const oldLogoPath = settings.mainLogo;
      settings.mainLogo = 'uploads/' + mainLogoFile.filename;
      // Delete old logo file if it's not the default one
      if (oldLogoPath && oldLogoPath !== '/uploads/default-logo-light.png') {
        const fullOldLogoPath = path.join(__dirname, '..', oldLogoPath);
        if (fs.existsSync(fullOldLogoPath)) {
          fs.unlinkSync(fullOldLogoPath);
        }
      }
    }

    // Handle darkModeLogo update
    if (darkModeLogoFile) {
      const oldDarkModeLogoPath = settings.darkModeLogo;
      settings.darkModeLogo = 'uploads/' + darkModeLogoFile.filename;
      // Delete old dark mode logo file if it's not the default one
      if (oldDarkModeLogoPath && oldDarkModeLogoPath !== '/uploads/default-logo-dark.png') {
        const fullOldDarkModeLogoPath = path.join(__dirname, '..', oldDarkModeLogoPath);
        if (fs.existsSync(fullOldDarkModeLogoPath)) {
          fs.unlinkSync(fullOldDarkModeLogoPath);
        }
      }
    }

    // Handle founderImage update
    if (founderImageFile) {
      const oldFounderImagePath = settings.founderImage;
      settings.founderImage = 'uploads/' + founderImageFile.filename;
      // Delete old founder image file if it's not the default one
      if (oldFounderImagePath && oldFounderImagePath !== '/uploads/default-founder.png') {
        const fullOldFounderImagePath = path.join(__dirname, '..', oldFounderImagePath);
        if (fs.existsSync(fullOldFounderImagePath)) {
          fs.unlinkSync(fullOldFounderImagePath);
        }
      }
    } else if (req.body.founderImage !== undefined) { // If no new file, but there's an existing image path, send it
      settings.founderImage = req.body.founderImage;
    }

    // Handle aboutText update
    if (aboutText !== undefined) {
      settings.aboutText = aboutText;
    }

    // Handle global carousel text updates
    if (carouselWelcomeText !== undefined) {
      settings.carouselWelcomeText = carouselWelcomeText;
    }
    if (carouselAppNameText !== undefined) {
      settings.carouselAppNameText = carouselAppNameText;
    }
    if (carouselDescriptionText !== undefined) {
      settings.carouselDescriptionText = carouselDescriptionText;
    }

    // Handle values update
    if (values !== undefined) {
      try {
        const parsedValues = JSON.parse(values);
        settings.values = parsedValues;
      } catch (e) {
        console.error('Error parsing values:', e);
        // Optionally send an error response or handle it gracefully
      }
    }

    // Handle carousel update
    let updatedCarouselImagePaths = [];
    const oldCarouselImagePaths = settings.carousel || []; // Get current carousel images from DB

    if (carousel) {
      // Parse the carousel array from req.body (which contains existing image URLs)
      const parsedCarousel = JSON.parse(carousel);
      updatedCarouselImagePaths = parsedCarousel;
    }

    // Add new carousel images
    if (newCarouselImagesFiles && newCarouselImagesFiles.length > 0) {
      newCarouselImagesFiles.forEach(file => {
        updatedCarouselImagePaths.push('uploads/' + file.filename);
      });
    }

    // Delete old carousel images that are no longer in the updated list
    const imagesToDelete = oldCarouselImagePaths.filter(
      (oldPath) => !updatedCarouselImagePaths.includes(oldPath) && oldPath.startsWith('uploads/')
    );

    imagesToDelete.forEach(imagePath => {
      const fullImagePath = path.join(__dirname, '..', imagePath);
      if (fs.existsSync(fullImagePath)) {
        fs.unlinkSync(fullImagePath);
      }
    });

    settings.carousel = updatedCarouselImagePaths; // Update the settings object

    const updatedSettings = await settings.save();
    res.json(updatedSettings);
  } catch (err) {
    console.error('Erreur lors de la mise à jour des paramètres:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la mise à jour des paramètres', error: err.message });
  }
};
