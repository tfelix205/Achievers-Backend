const Joi = require('joi')

exports.registerValidator = async (req, res, next) => {

    const Schema = Joi.object({

        name: Joi.string().trim().lowercase().min(3).required().pattern(/^[A-Za-z\s]+$/).messages({

            'string.empty': 'Name is required',

            'string.min': 'Name should have at least 3 characters',

            'string.pattern.base': 'Name can only contain letters and spaces'
        }),

        email: Joi.string().trim().lowercase().pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/).required().messages({
            
            'string.empty': 'Email is required',

            'string.pattern.base': 'Email must be a valid address (e.g. name@example.com)'
        }),

        phone: Joi.string().trim().pattern(/^\d{11}$/).required().messages({

            'string.empty': 'Phone number is required',

            'string.pattern.base': 'Phone number must be 11 digits'

        }),

       password: Joi.string()
        .required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%_*#?&-])[A-Za-z\d@$!%_*#?&-]{8,}$/)
        .messages({
            'string.empty': 'Password is required',
            'string.pattern.base': 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%_*#?&-)',
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
            message:error.details.map(err => err.message)
            
        });
    }

};

exports.loginValidator = async (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().trim().lowercase().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
    }),
  });

  try {
    await schema.validateAsync(req.body, { abortEarly: false });
    next();
  } catch (error) {
    return res.status(400).json({
      message:error.details.map(err => err.message) ,
      
    });
  }
};

exports.resetPasswordValidator = async (req, res, next) => {

    const schema = Joi.object({

        otp: Joi.string().trim().length(6).required().messages({

            'string.empty': 'OTP is required',

            'string.length': 'OTP must be 6 digits long'
        }),

        newPassword: Joi.string().required().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%_*#?&-])[A-Za-z\d@$!%_*#?&-]{8,}$/).messages({

            'string.empty': 'Password is required',

            'string.pattern.base': 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%_*#?&-)',
        }),

        confirmNewPassword: Joi.any().valid(Joi.ref('newPassword')).required().messages({

            'any.only': 'Passwords do not match',

            'any.required': 'Please confirm your new password'
        })
    });

    try {
        await schema.validateAsync(req.body, { abortEarly: false });

        next();

    } catch (error) {
        return res.status(500).json({
            message: error.message
        })
    }
}



exports.groupRegisterValidator = async (req, res, next) => {
  const Schema = Joi.object({
    groupName: Joi.string()
      .min(2)
      .trim()
      .required()
      .pattern(/^[A-Za-z\s]+$/)
      .messages({
        'string.empty': 'Group Name is required',
        'string.min': 'Group Name should have at least 2 characters',
        'string.pattern.base': 'Name can only contain letters and spaces',
      }),

    contributionAmount: Joi.number() // 🧠 note: fixed typo "constributionAmount"
      .precision(2)
      .positive()
      .required()
      .messages({
        'number.base': 'Contribution Amount must be a number',
        'number.positive': 'Contribution Amount must be greater than zero (0)',
        'any.required': 'Contribution Amount is required',
        'number.precision': 'Contribution amount can only have up to 2 decimal places',
      }),

    contributionFrequency: Joi.string()
      .valid('daily', 'weekly', 'monthly')
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Contribution Frequency requires a value',
        'string.base': 'Contribution Frequency must be a text value',
        'any.only': 'Contribution frequency can only be (daily, weekly or monthly)',
        'any.required': 'Contribution frequency is required',
      }),

    payoutFrequency: Joi.string()
      .valid('daily', 'weekly', 'monthly')
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.empty': 'Payout Frequency requires a value',
        'string.base': 'Payout Frequency must be a text value',
        'any.only': 'Payout frequency can only be (daily, weekly or monthly)',
        'any.required': 'Payout frequency is required',
      }),

    description: Joi.string()
      .trim()
      .allow('')
      .max(500)
      .messages({
        'string.base': 'Description must be a text',
        'string.max': 'Description cannot exceed 500 characters',
      }),

    totalMembers: Joi.number()
      .integer()
      .min(2)
      .max(12)
      .required()
      .messages({
        'number.base': 'Total members must be a number',
        'number.integer': 'Total number must be a whole number',
        'number.min': 'Total members cannot be less than 2',
        'number.max': 'Total members cannot be more than 12',
        'any.required': 'Total members is required',
      }),
  });

  try {
    await Schema.validateAsync(req.body, { abortEarly: false });
    next();
  } catch (error) {
    return res.status(400).json({
      message: error.details.map((err) => err.message),
    });
  }
};
