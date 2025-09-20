import mongoose from 'mongoose';

const valueItemSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: String, default: '' } // Store icon names as strings
});

const settingSchema = new mongoose.Schema(
  {
    mainLogo: {
      type: String,
      default: '/uploads/default-logo-light.png',
    },
    darkModeLogo: {
      type: String,
      default: '/uploads/default-logo-dark.png',
    },
    carousel: [
      { type: String }
    ],
    aboutText: {
      type: String,
      default: 'EventHub est votre plateforme dédiée à la découverte et à l\'organisation d\'événements locaux. Notre mission est de connecter les communautés en rendant l\'accès aux activités culturelles, sportives et sociales plus simple que jamais.',
    },
    carouselWelcomeText: {
      type: String,
      default: 'Bienvenue chez',
    },
    carouselAppNameText: {
      type: String,
      default: 'Event Hub',
    },
    carouselDescriptionText: {
      type: String,
      default: 'Découvrez les meilleurs événements près de chez vous',
    },
    // New fields for AboutPage
    founderName: {
      type: String,
      default: 'Mamadou Cire Diallo',
    },
    founderRole: {
      type: String,
      default: 'Développeur Full Stack & Designer',
    },
    founderImage: {
      type: String,
      default: '/uploads/default-founder.png', // Placeholder for founder image
    },
    founderBio: {
      type: String,
      default: 'Passionné par la technologie et la création de liens, j\'ai conçu, développé et designé EventHub pour aider chacun à découvrir et partager des expériences uniques au sein de sa communauté.',
    },
    callToActionText: {
      type: String,
      default: 'Rejoignez la communauté EventHub et découvrez une multitude d\'événements près de chez vous, ou commencez à organiser le vôtre dès aujourd\'hui !',
    },
    values: [valueItemSchema], // Array of value items
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', settingSchema);

export default Setting;
