const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const Payment = require('../models/Payment');
const { protect, requireRole } = require('../middleware/auth');

const adminOnly = [protect, requireRole('admin')];

// GET /api/admin/providers/pending
router.get('/providers/pending', ...adminOnly, async (req, res) => {
  try {
    const providers = await User.find({ role: 'service_provider', status: 'pending' }).sort({ createdAt: -1 });
    res.json(providers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/providers
router.get('/providers', ...adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { role: 'service_provider' };
    if (status) filter.status = status;
    const providers = await User.find(filter).sort({ createdAt: -1 });
    res.json(providers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/providers/:id/approve
router.patch('/providers/:id/approve', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', rejectionReason: '' },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'Provider not found' });

    // Notify provider via their named room
    const io = req.app.get('io');
    io.to(`provider_${user._id}`).emit('account_approved', { message: 'Your account has been approved!' });

    res.json({ message: 'Provider approved', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/providers/:id/reject
router.patch('/providers/:id/reject', ...adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason: reason || 'Not specified' },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'Provider not found' });

    const io = req.app.get('io');
    io.to(`provider_${user._id}`).emit('account_rejected', { message: 'Your account has been rejected.', reason });

    res.json({ message: 'Provider rejected', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/customers
router.get('/customers', ...adminOnly, async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/tasks
router.get('/tasks', ...adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const tasks = await Task.find(filter)
      .populate('customerId', 'name email')
      .populate('serviceProviderId', 'name email expertise')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/stats
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [totalCustomers, totalProviders, pendingProviders, totalTasks, completedTasks, payments] =
      await Promise.all([
        User.countDocuments({ role: 'customer' }),
        User.countDocuments({ role: 'service_provider', status: 'approved' }),
        User.countDocuments({ role: 'service_provider', status: 'pending' }),
        Task.countDocuments(),
        Task.countDocuments({ status: 'completed' }),
        Payment.find({ status: 'succeeded' }),
      ]);

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      totalCustomers,
      totalProviders,
      pendingProviders,
      totalTasks,
      completedTasks,
      totalRevenue,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
