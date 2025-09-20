import jwt from 'jsonwebtoken';
import User from '../models/Users.js';
import 'dotenv/config';

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader?.startsWith('Bearer')) {
        return next(); // Pas de token, on passe au suivant
    }

    const token = authHeader.split(' ')[1];
    // console.log('optionalAuth: Token received:', token); // NEW DEBUG LOG

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err, decoded) => {
            if (err) {
                // console.log('optionalAuth: JWT verification failed:', err); // NEW DEBUG LOG
                // If a token was provided but is invalid/expired, send 401 to trigger refresh logic
                return res.status(401).json({ message: 'Token invalide ou expiré.' });
            }
            // console.log('optionalAuth: JWT decoded successfully:', decoded); // NEW DEBUG LOG
            // Le token est valide, on attache un objet utilisateur à la requête
            // directement depuis les données du token. C'est sécurisé car le token est signé.
            req.user = {
                _id: decoded.id,
                id: decoded.id, // Parfois utile d'avoir les deux
                role: decoded.role
            };

            next();
        }
    );
};

export default optionalAuth;
