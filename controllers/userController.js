const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const db = require('../models');
const User = db.User;
const { Op } = require('sequelize');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// REGISTER USER
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password required' });

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const newUser = await User.create({
      name,
      email,
      phone,
      password: hash,
      otp,
      otpExpiry
    });

    // create wallet automatically
    await db.Wallet.create({ userId: newUser.id });

    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};




exports.verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({
      where: {
        email,
        otp,
        otpExpiry: { [Op.gt]: new Date() } 
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully!' });
  } catch (err) {
    console.log(err);
    
    res.status(500).json({ error: err.message });
  }
};


// LOGIN USER
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Email not verified. Please verify your email before logging in.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET PROFILE
exports.profile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: db.Wallet,
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
