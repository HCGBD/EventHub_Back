import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import User from "../models/Users.js";
import dotenv from 'dotenv'

dotenv.config()

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      const user = await User.findById(jwt_payload.id).select("-password");
      if (user) {
        return done(null, user);
      }

      return done(null, false);
    } catch (err) {
      return done(err, false);
    }
  })
);

const requireAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err); // Pour les erreurs internes
    }
    if (!user) {
      // Explicitement bloquer si l'utilisateur n'est pas authentifié
      return res.status(401).json({ message: 'Accès non autorisé. Token invalide ou manquant.' });
    }
    // Si l'utilisateur est trouvé, l'attacher à la requête et continuer
    req.user = user;
    next();
  })(req, res, next);
};

export default requireAuth
