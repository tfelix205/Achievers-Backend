const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const {User, Group} = require('../models');
const { Op } = require('sequelize');
const { signupMail } = require('../utils/signup_mail');
const { sendMail } = require('../utils/sendgrid');
const { passwordResetMail } = require('../utils/resetPasswordMail')
const {nameToTitleCase} = require('../helper/nameConverter');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');




const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// REGISTER USER
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    // Validate
    if (!name || !email || !password || !confirmPassword)
      return res.status(400).json({ message: 'Name, email and password required' });

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Password and confirm password do not match'
      })
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const newUser = await User.create({
      name: nameToTitleCase(name).trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hash,
      otp,
      otpExpiry,
      isVerified: false
    });

    const  response = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      
      
    };

   
    await sendMail({
      email: newUser.email,
      subject: 'Verify Your Splita Account',
      html:signupMail(otp, newUser.name)
    });

    res.status(201).json({ message: 'User registered successfully', data: response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
    try {

        const { email, otp } = req.body;

        const user = await User.findOne({ where: { email: email.toLowerCase().trim() }});

        if (!user) {
            return res.status(404).json({
                message: ' User not found'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                message: "User already verified"
            });
        }

        if (user.otp !== otp) {
            return res.status(400).json({
                message: "Invalid OTP"
            });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({
                message: "OTP has expired"
            });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;

        await user.save();

        const token = jwt.sign({
            id: user.id,
            email: user.email
        }, process.env.JWT_SECRET, {
             expiresIn: '1d'
            });

        res.status(200).json({
            message: "Email verified successfullyy",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        res.status(500).json({
            message: 'Internal Server Error',
            error: error.message 
        })
    }
};


exports.resendOtp = async (req, res) => {

    try {

        const { email } = req.body;

        const user = await User.findOne({ where: { email }});

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }
        if (user.isVerified) {
            return res.status(400).json({
                message: 'User already verified'
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes from now

        user.otp = otp;
        user.otpExpiry = otpExpiry;

        await user.save();

        await sendMail({
            email: user.email,
            subject: 'Your New Splita Verification Code',
            html: signupMail(otp, user.name)
        });

        res.status(200).json({
            message: 'OTP resent successfully',
            email: user.email
        });

    } catch (error) {
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        })
    }
};

// LOGIN USER
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Email not verified. Please verify your email before logging in.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful', token ,user:{
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      verified: user.isVerified,
      profilePicture: user.profilePicture
      
      
      
    }});
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET PROFILE
exports.getProfile = async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
        include: [
          {
            model: Group,
            as: 'groups',
            attributes: ['id', 'groupName', 'status']
          }
        ]
      });

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile',
        error: error.message
      });
    }
  },




exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {};
    if (name) updateData.name = nameToTitleCase(name);
    if (phone) updateData.phone = phone;

    // Handle profile picture upload
    if (req.file) {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'splita/profiles',
          public_id: `user_${userId}`,
          overwrite: true,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto' }
          ]
        });

        updateData.profilePicture = result.secure_url;

        // Delete local file
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload image' });
      }
    }

    await user.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  } 
};

exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { email: { [Op.iLike]: `%${query}%` } },
        ],  
      },
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;  
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


exports.forgotPassword = async (req, res) => {
    try {
        
        const { email } = req.body;

        const user = await User.findOne({ where: { email: email.toLowerCase().trim() }});

        if(!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpExpiry = Date.now() + 5 * 60 * 1000;

    user.otp = otp;
    user.otpExpiry = otpExpiry;

    await user.save();

    
    const html = passwordResetMail(user.name, otp);
    await sendMail({
      email: user.email,
      subject: "Reset Your Password",
      html,
    });

    
    return res.status(200).json({
      message: "Reset password OTP code sent successfully. check your mail"
      

    })

    } catch (error) {
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        })
    }
};


exports.resetPassword = async (req, res) => {
  try {
    const { otp, newPassword, confirmNewPassword } = req.body;

    if (!otp || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
         message: "otp and new password and confirm new password required"
         });
    }

    if (newPassword !== confirmNewPassword) {
        return res.status({
            message: 'Password do not match'
        })
    }

      const user = await User.findOne({ where: { otp } });
    
    if (!user) {
        return res.status(400).json({
             message: 'Invalid OTP'
        });
    } 

    if (Date.now() > user.otpExpiry) {
        return res.status(400).json({
            message: 'OTP has expired'
        })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    
    res.status(400).json({ 
        message: "Invalid or expired otp",
        error: error.message 
    });
}
};
exports.getOneUser = async (req, res) => {
  try {
    const {id} = req.params;

    const user = await User.findByPk(id, {
      attributes: {  exclude: ['password', 'otp', 'otpExpiry']}
    })

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.status(200).json({
      message: 'User retrieved successfully',
      data: user
    })

  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    })
  }
}