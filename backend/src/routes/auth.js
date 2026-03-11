const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register/customer
router.post('/register/customer', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, phone, role: 'customer', status: 'approved' });
    res.status(201).json({ token: generateToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register/provider
router.post('/register/provider', async (req, res) => {
  try {
    const { name, email, password, phone, bio, expertise } = req.body;
    if (!name || !email || !password || !expertise || expertise.length === 0)
      return res.status(400).json({ message: 'All fields including expertise are required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name, email, password, phone, bio,
      expertise,
      role: 'service_provider',
      status: 'pending',
    });
    res.status(201).json({
      message: 'Registration successful. Awaiting admin approval.',
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    res.json({ token: generateToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// PATCH /api/auth/profile — update basic info (name, phone, bio) — no admin review
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, phone, bio } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (bio !== undefined) updates.bio = bio;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/auth/expertise — update expertise → triggers re-approval by admin
router.patch('/expertise', protect, async (req, res) => {
  try {
    if (req.user.role !== 'service_provider') {
      return res.status(403).json({ message: 'Only service providers can update expertise' });
    }
    const { expertise } = req.body;
    if (!expertise || expertise.length === 0) {
      return res.status(400).json({ message: 'At least one expertise entry is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { expertise, status: 'pending', rejectionReason: '' },
      { new: true }
    );

    // Notify all admins via socket
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('provider_update_request', {
        providerId: user._id,
        providerName: user.name,
        message: `${user.name} has updated their expertise and needs re-approval.`,
      });
    }

    res.json({ message: 'Expertise updated. Awaiting admin re-approval.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
