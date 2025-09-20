import mongoose from 'mongoose';
import mongoose_delete from 'mongoose-delete';

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    onlineUrl: {
      type: String,
      trim: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: function () {
        return !this.isOnline;
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['brouillon', 'en_attente_approbation', 'publie', 'annule', 'termine', 'rejete'],
      default: 'brouillon',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    maxParticipants: {
      type: Number,
      required: true,
      min: 1,
    },
    images: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

// Add mongoose-delete plugin for soft delete
eventSchema.plugin(mongoose_delete, {
  overrideMethods: 'all',
  deletedAt: true,
  deletedBy: true,
});

// Ensure endDate is after startDate and handle online event logic
eventSchema.pre('save', function (next) {
  if (this.endDate < this.startDate) {
    return next(new Error('La date de fin doit être après la date de début.'));
  }

  if (this.isOnline) {
    if (!this.onlineUrl) {
      return next(new Error("L'URL de l'événement en ligne est requise."));
    }
    // Basic URL validation
    const urlRegex = /^(https?|ftp):\/\/[^\s\/$.?#].[^\s]*$/i;
    if (!urlRegex.test(this.onlineUrl)) {
      return next(new Error("L'URL de l'événement en ligne n'est pas valide."));
    }
    this.location = undefined; // Ensure location is unset for online events
  }

  next();
});

// Add text index for searching
eventSchema.index({ name: 'text', description: 'text' });

const Event = mongoose.model('Event', eventSchema);

export default Event;