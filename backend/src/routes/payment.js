const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const Payment = require('../models/Payment');
const Task = require('../models/Task');
const { protect, requireRole } = require('../middleware/auth');

// POST /api/payment/create-intent — Customer initiates payment
router.post('/create-intent', protect, requireRole('customer'), async (req, res) => {
  try {
    const { taskId } = req.body;
    const task = await Task.findById(taskId).populate('serviceProviderId', 'name');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.customerId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    if (task.status !== 'completed') return res.status(400).json({ message: 'Task is not completed yet' });

    const amount = task.amount || 0;
    if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    let paymentIntent;
    let clientSecret;

    // Try to use real Stripe, fall back to mock for demo
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // cents
        currency: 'usd',
        metadata: { taskId: taskId.toString(), customerId: req.user._id.toString() },
      });
      clientSecret = paymentIntent.client_secret;
    } catch (stripeErr) {
      // Mock mode for demo without real Stripe key
      paymentIntent = { id: `pi_mock_${Date.now()}` };
      clientSecret = `mock_secret_${Date.now()}`;
    }

    const payment = await Payment.create({
      taskId,
      customerId: req.user._id,
      serviceProviderId: task.serviceProviderId._id,
      amount,
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: clientSecret,
      status: 'pending',
    });

    task.paymentStatus = 'pending';
    await task.save();

    res.json({ clientSecret, paymentId: payment._id, amount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payment/confirm — Confirm payment (mock/webhook fallback)
router.post('/confirm', protect, requireRole('customer'), async (req, res) => {
  try {
    const { paymentId } = req.body;
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    payment.status = 'succeeded';
    payment.paidAt = new Date();
    await payment.save();

    await Task.findByIdAndUpdate(payment.taskId, { paymentStatus: 'paid' });

    const io = req.app.get('io');
    io.to(`provider_${payment.serviceProviderId}`).emit('payment_received', {
      taskId: payment.taskId,
      amount: payment.amount,
    });
    io.to('admin_room').emit('payment_updated', { payment });

    res.json({ message: 'Payment confirmed', payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payment/:taskId — Get payment details for a task
router.get('/:taskId', protect, async (req, res) => {
  try {
    const payment = await Payment.findOne({ taskId: req.params.taskId })
      .populate('customerId', 'name email')
      .populate('serviceProviderId', 'name email');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
