import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'user@example.com',
        pass: process.env.EMAIL_PASS || 'password',
    },
});

export const sendEmail = async (to, subject, htmlContent, attachments = []) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"EventHub" <no-reply@eventhub.com>',
            to,
            subject,
            html: htmlContent,
            attachments: attachments, // Add attachments to mailOptions
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        throw new Error('Failed to send email');
    }
};
