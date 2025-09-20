import Joi from 'joi';

const registrationSchema = Joi.object({
    nom: Joi.string().min(2).max(30).required(),
    prenom: Joi.string().min(2).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])')).required()
        .messages({
            'string.pattern.base': 'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial (!@#$%^&*)'
        }),
    role: Joi.string().valid('admin', 'organizer', 'participant')
});

export const validateRegistration = (req, res, next) => {
    const { error } = registrationSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};