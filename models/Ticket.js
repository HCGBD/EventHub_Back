import mongoose from 'mongoose';
import crypto from 'crypto';

const ticketSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
    },
    qrCodeData: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['valide', 'scanne', 'annule'],
      default: 'valide',
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    priceAtPurchase: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// Hook pour générer un numéro de billet et le QR code avant la sauvegarde
ticketSchema.pre('validate', function (next) {
  if (this.isNew) {
    // Générer une chaîne unique et difficile à deviner
    const uniqueString = `${this.event.toString()}-${this.user.toString()}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    // Générer le numéro de billet (plus lisible)
    const eventPart = this.event.toString().slice(-5).toUpperCase();
    const userPart = this.user.toString().slice(-5).toUpperCase();
    const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    this.ticketNumber = `TKT-${eventPart}-${userPart}-${randomPart}`;

    // Les données du QR code seront simplement le numéro de billet unique
    this.qrCodeData = this.ticketNumber;
  }
  next();
});

// Index pour des recherches efficaces
ticketSchema.index({ event: 1, user: 1 }, { unique: true });

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;
