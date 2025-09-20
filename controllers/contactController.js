import { sendEmail } from '../services/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

export const sendContactMessage = async (req, res) => {
    const { name, email, subject, message } = req.body;

    // Validation simple
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const recipient = process.env.EMAIL_USER;
    if (!recipient) {
        console.error('ADMIN_EMAIL or EMAIL_USER is not defined in .env file.');
        return res.status(500).json({ message: 'Erreur de configuration du serveur.' });
    }

    const emailSubject = `Nouveau message de contact : ${subject}`;
    const htmlContent = `
        <h1>Nouveau message depuis le formulaire de contact EventHub</h1>
        <p><strong>Nom :</strong> ${name}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Sujet :</strong> ${subject}</p>
        <hr>
        <h2>Message :</h2>
        <p>${message.replace(/\n/g, '<br>')}</p>
    `;

    try {
        await sendEmail(recipient, emailSubject, htmlContent);
        res.status(200).json({ message: 'Votre message a été envoyé avec succès !' });
    } catch (error) {
        console.error('Failed to send contact email:', error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'envoi de l\'e-mail.' });
    }
};
