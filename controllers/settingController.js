import Setting from '../models/Setting.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// @desc    Get application settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
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
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }

    const { aboutText, carousel, carouselWelcomeText, carouselAppNameText, carouselDescriptionText, founderName, founderRole, founderBio, callToActionText, values } = req.body;

    const mainLogoFile = req.files?.find(file => file.fieldname === 'mainLogo');
    const darkModeLogoFile = req.files?.find(file => file.fieldname === 'darkModeLogo');
    const newCarouselImagesFiles = req.files?.filter(file => file.fieldname.startsWith('newCarouselImages'));
    const founderImageFile = req.files?.find(file => file.fieldname === 'founderImage');

    // Handle mainLogo update
    if (mainLogoFile) {
      const result = await uploadToCloudinary(mainLogoFile.buffer);
      settings.mainLogo = result.secure_url;
    }

    // Handle darkModeLogo update
    if (darkModeLogoFile) {
      const result = await uploadToCloudinary(darkModeLogoFile.buffer);
      settings.darkModeLogo = result.secure_url;
    }

    // Handle founderImage update
    if (founderImageFile) {
      const result = await uploadToCloudinary(founderImageFile.buffer);
      settings.founderImage = result.secure_url;
    } else if (req.body.founderImage !== undefined) {
      settings.founderImage = req.body.founderImage;
    }

    // Handle text fields update
    if (aboutText !== undefined) settings.aboutText = aboutText;
    if (carouselWelcomeText !== undefined) settings.carouselWelcomeText = carouselWelcomeText;
    if (carouselAppNameText !== undefined) settings.carouselAppNameText = carouselAppNameText;
    if (carouselDescriptionText !== undefined) settings.carouselDescriptionText = carouselDescriptionText;
    if (founderName !== undefined) settings.founderName = founderName;
    if (founderRole !== undefined) settings.founderRole = founderRole;
    if (founderBio !== undefined) settings.founderBio = founderBio;
    if (callToActionText !== undefined) settings.callToActionText = callToActionText;

    // Handle values update
    if (values !== undefined) {
      try {
        settings.values = JSON.parse(values);
      } catch (e) {
        console.error('Error parsing values:', e);
      }
    }

    // Handle carousel update
    let updatedCarouselImagePaths = [];
    if (carousel) {
      try {
        updatedCarouselImagePaths = JSON.parse(carousel);
      } catch (e) { /* Ignore parsing error */ }
    }

    if (newCarouselImagesFiles && newCarouselImagesFiles.length > 0) {
      const uploadPromises = newCarouselImagesFiles.map(file => uploadToCloudinary(file.buffer));
      const uploadResults = await Promise.all(uploadPromises);
      const newImageUrls = uploadResults.map(result => result.secure_url);
      updatedCarouselImagePaths.push(...newImageUrls);
    }

    settings.carousel = updatedCarouselImagePaths;

    const updatedSettings = await settings.save();
    res.json(updatedSettings);

  } catch (err) {
    console.error('Erreur lors de la mise à jour des paramètres:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la mise à jour des paramètres', error: err.message });
  }
};
