export const requireRole = (roles) => {
    return (req, res, next) => {
        const userRole = req.user && req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (userRole && allowedRoles.includes(userRole)) {
            next();
        } else {
            res.status(403).json({ message: `Accès refusé. Rôle(s) requis: ${allowedRoles.join(', ')}.` });
        }
    };
};