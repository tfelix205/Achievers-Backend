const Joi = require('joi')

exports.registerValidator = async (req, res, next) => {

    const Schema = Joi.object({

        name: Joi.string().min(3).required().pattern(/^[A-Za-z\s]+$/).messages({

            'string.empty': 'Name is required',

            'string.min': 'Name should have at least 3 characters',

            'string.pattern.base': 'Name can only contain letters and spaces'
        }),

        email: Joi.string().pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/).required().messages({

            'string.empty': 'Email is required',

            'string.pattern.base': 'Email must be a valid address (e.g. name@example.com)'
        }),

        phone: Joi.string().trim().pattern(/^\d{11}$/).required().messages({

            'string.empty': 'Phone number is required',

            'string.pattern.base': 'Phone number must be 11 digits'

        }),

       password: Joi.string().required().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%_*#?&-])[A-Za-z\d@$!%_*#?&-]{8,}$/).messages({
            'string.empty': 'Password is required',

            'string.pattern.base': 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character(d@$!%_*#?&-)'
        }),

        confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({

            'any.only': 'Passwords do not match',

            'any.required': 'Please confirm your password'

        })

    }); 

    try {
        await Schema.validateAsync(req.body, { abortEarly: false });

        next();

    } catch (error) {

        return res.status(400).json({
            message: 'Validation Error',
            error: error.details[0].message
        });
    }

};

exports.loginValidator = async (req, res, next) => {

    const Schema = Joi.object({

        email: Joi.string().email().required().messages({

            'string.empty': 'Email is required',

            'string.email': 'Please provide a valid email address'

        }),

        password: Joi.string().min(8).required().messages({

            'string.empty': 'Password is required',

            'string.min': 'Password should have at least 8 characters'

        })

    });

    try {

        await Schema.validateAsync(req.body, { abortEarly: false });

        next();

    } catch (error) {
        
        return res.status(400).json({
            message: 'Validation Error',
            error: error.details[0].message
        });
    }

};