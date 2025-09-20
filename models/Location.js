import mongoose from 'mongoose';
import mongoose_delete from 'mongoose-delete';

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    address: { // Nouveau champ pour l'adresse textuelle
      type: String,
      trim: true,
    },
    coordinates: { // Nouveau champ pour les coordonnées géographiques
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
    },
    images: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['approuve', 'en_attente', 'rejete'],
      default: 'en_attente',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

locationSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deleted: { $eq: false } } });

// Add text index for searching
locationSchema.index({ name: 'text', description: 'text', address: 'text' });

// Add mongoose-delete plugin for soft delete
locationSchema.plugin(mongoose_delete, {
  overrideMethods: 'all',
  deletedAt: true,
  deletedBy: true,
});

const Location = mongoose.model('Location', locationSchema);

export default Location;
