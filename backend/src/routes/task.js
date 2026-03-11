const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const User = require('../models/User');
const Message = require('../models/Message');
const { protect, requireRole, requireApproved } = require('../middleware/auth');
const { matchProviders } = require('../services/aiTagging');

const ACCEPT_WINDOW_MS = parseInt(process.env.TASK_ACCEPT_WINDOW_MS) || 120000; // 2 minutes
const EXTEND_WINDOW_MS = 600000; // 10 minutes

// Calculate session price from provider's years of experience
// Formula: $20 base + $8 per year, capped at $150
function calcPrice(expertise) {
  if (!expertise || expertise.length === 0) return 20;
  const maxYears = Math.max(...expertise.map((e) => e.yearsOfExperience || 0));
  return Math.min(150, Math.max(20, 20 + maxYears * 8));
}

// POST /api/tasks — Customer creates a task
router.post('/', protect, requireRole('customer'), async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ message: 'Description is required' });

    // Get ALL approved providers (regardless of isAvailable — let socket handle delivery)
    const allProviders = await User.find({ role: 'service_provider', status: 'approved' });

    // AI match — ranks providers by domain relevance
    const { tags, domains, matchedProviders } = matchProviders(description, allProviders);

    const task = await Task.create({
      customerId: req.user._id,
      description,
      aiTags: tags,
      matchedDomains: domains,
      status: 'notifying',
      notifiedProviders: allProviders.map((p) => ({ providerId: p._id })),
      acceptWindowExpiry: new Date(Date.now() + ACCEPT_WINDOW_MS),
    });

    await Message.create({
      taskId: task._id,
      chatRoomId: task._id.toString(),
      senderId: req.user._id,
      senderRole: 'system',
      content: `Request received: "${description.slice(0, 80)}". Finding the best expert for you...`,
      type: 'system',
    });

    const io = req.app.get('io');
    const notifyPayload = {
      taskId: task._id,
      description: task.description,
      aiTags: task.aiTags,
      matchedDomains: task.matchedDomains,
      expiresAt: task.acceptWindowExpiry,
      customerId: req.user._id,
      customerName: req.user.name,
    };

    // Notify top matched providers first (priority), then rest as fallback
    const notifiedIds = new Set();
    for (const p of matchedProviders) {
      io.to(`provider_${p._id}`).emit('new_task_notification', notifyPayload);
      notifiedIds.add(p._id.toString());
    }
    // Also broadcast to ALL approved providers so no one misses it
    for (const p of allProviders) {
      if (!notifiedIds.has(p._id.toString())) {
        io.to(`provider_${p._id}`).emit('new_task_notification', notifyPayload);
      }
    }

    // Broadcast to provider_all room for the available tasks list
    io.to('providers_online').emit('task_available', notifyPayload);

    console.log(`[Task] ${task._id} created — domains:[${domains}] — notified ${allProviders.length} provider(s)`);

    // Auto-expire after window if no one accepts
    setTimeout(async () => {
      const freshTask = await Task.findById(task._id);
      if (freshTask && freshTask.status === 'notifying') {
        freshTask.status = 'expired';
        await freshTask.save();
        await Message.create({
          taskId: task._id,
          chatRoomId: task._id.toString(),
          senderId: req.user._id,
          senderRole: 'system',
          content: 'No expert was available to accept in time. Please try submitting again.',
          type: 'system',
        });
        io.to(`customer_${req.user._id}`).emit('task_expired', { taskId: task._id });
        console.log(`[Task] ${task._id} expired — no provider accepted`);
      }
    }, ACCEPT_WINDOW_MS);

    const populated = await Task.findById(task._id)
      .populate('customerId', 'name email')
      .populate('serviceProviderId', 'name email expertise bio avatar rating');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/tasks/available — Provider sees tasks they can accept right now
router.get('/available', protect, requireRole('service_provider'), requireApproved, async (req, res) => {
  try {
    const provider = req.user;
    const providerDomains = (provider.expertise || []).map((e) => e.domain.toLowerCase());

    // Tasks that are still in notifying window
    const tasks = await Task.find({
      status: 'notifying',
      acceptWindowExpiry: { $gt: new Date() },
    })
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 });

    // Prioritise domain-matched tasks, then show all
    const matched = tasks.filter((t) =>
      providerDomains.length === 0 ||
      t.matchedDomains?.some((d) => providerDomains.includes(d))
    );

    res.json(matched.length > 0 ? matched : tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks/:id/accept — Any approved provider can accept an open task
router.post('/:id/accept', protect, requireRole('service_provider'), requireApproved, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.status !== 'notifying') {
      return res.status(400).json({ message: 'Task is no longer available' });
    }
    if (new Date() > task.acceptWindowExpiry) {
      return res.status(400).json({ message: 'Acceptance window has expired' });
    }

    // Auto-calculate price from provider's years of experience
    const price = calcPrice(req.user.expertise);

    // Assign
    task.status = 'assigned';
    task.serviceProviderId = req.user._id;
    task.assignedAt = new Date();
    task.price = price;
    task.amount = price;

    // Record acceptance
    const existing = task.notifiedProviders.find(
      (n) => n.providerId.toString() === req.user._id.toString()
    );
    if (existing) {
      existing.response = 'accepted';
      existing.respondedAt = new Date();
    } else {
      task.notifiedProviders.push({ providerId: req.user._id, response: 'accepted', respondedAt: new Date() });
    }
    task.notifiedProviders.forEach((n) => {
      if (n.providerId.toString() !== req.user._id.toString() && n.response === 'pending') {
        n.response = 'expired';
      }
    });

    await task.save();

    await Message.create({
      taskId: task._id,
      chatRoomId: task.chatRoomId,
      senderId: req.user._id,
      senderRole: 'system',
      content: `✅ Expert ${req.user.name} has accepted your request.\n💰 Quoted price: $${parseFloat(price).toFixed(2)}\n\nPlease share your full task details in the chat to get started.`,
      type: 'system',
    });

    const populated = await Task.findById(task._id)
      .populate('customerId', 'name email')
      .populate('serviceProviderId', 'name email expertise bio avatar rating completedTasks');

    const io = req.app.get('io');
    // Notify customer
    io.to(`customer_${task.customerId}`).emit('task_assigned', {
      taskId: task._id,
      provider: populated.serviceProviderId,
      chatRoomId: task.chatRoomId,
    });
    // Tell all providers this task is gone
    io.to('providers_online').emit('task_taken', { taskId: task._id });
    // Notify admin
    io.to('admin_room').emit('task_updated', { task: populated });

    console.log(`[Task] ${task._id} accepted by ${req.user.name}`);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks/:id/reject — Provider declines
router.post('/:id/reject', protect, requireRole('service_provider'), requireApproved, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const n = task.notifiedProviders.find((n) => n.providerId.toString() === req.user._id.toString());
    if (n) { n.response = 'rejected'; n.respondedAt = new Date(); }
    await task.save();
    res.json({ message: 'Task declined' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks/:id/request-completion — Provider signals work is done
router.post('/:id/request-completion', protect, requireRole('service_provider'), requireApproved, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.serviceProviderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your task' });
    }
    if (!['assigned', 'in_progress'].includes(task.status)) {
      return res.status(400).json({ message: 'Task is not in a completable state' });
    }

    task.status = 'pending_completion';
    await task.save();

    await Message.create({
      taskId: task._id,
      chatRoomId: task.chatRoomId,
      senderId: req.user._id,
      senderRole: 'system',
      content: `🏁 ${req.user.name} has marked the work as done. Please review and approve completion to proceed with payment of $${task.price.toFixed(2)}.`,
      type: 'system',
    });

    const io = req.app.get('io');
    io.to(`customer_${task.customerId}`).emit('task_completion_requested', { taskId: task._id, price: task.price });
    io.to('admin_room').emit('task_updated', { task });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks/:id/complete — Customer approves task completion
router.post('/:id/complete', protect, requireRole('customer'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your task' });
    }
    if (task.status !== 'pending_completion') {
      return res.status(400).json({ message: 'Task completion has not been requested yet' });
    }

    task.status = 'completed';
    task.completedAt = new Date();
    await task.save();

    await Message.create({
      taskId: task._id,
      chatRoomId: task.chatRoomId,
      senderId: req.user._id,
      senderRole: 'system',
      content: `✅ Task approved as complete by ${req.user.name}. Please proceed with payment of $${task.price.toFixed(2)} to close the session.`,
      type: 'system',
    });

    await User.findByIdAndUpdate(task.serviceProviderId, { $inc: { completedTasks: 1 } });

    const io = req.app.get('io');
    io.to(`customer_${task.customerId}`).emit('task_completed', { taskId: task._id, amount: task.price });
    io.to(`provider_${task.serviceProviderId}`).emit('task_completed', { taskId: task._id, amount: task.price });
    io.to('admin_room').emit('task_updated', { task });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks/:id/extend — Customer extends acceptance window by 10 more minutes
router.post('/:id/extend', protect, requireRole('customer'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your task' });
    }
    if (task.status !== 'expired') {
      return res.status(400).json({ message: 'Task is not expired' });
    }

    // Reset task window
    task.status = 'notifying';
    task.acceptWindowExpiry = new Date(Date.now() + EXTEND_WINDOW_MS);
    // Re-open pending slots for providers who were expired
    task.notifiedProviders.forEach((n) => {
      if (n.response === 'expired') n.response = 'pending';
    });
    await task.save();

    await Message.create({
      taskId: task._id,
      chatRoomId: task._id.toString(),
      senderId: req.user._id,
      senderRole: 'system',
      content: 'Searching again — waiting up to 10 more minutes for an available expert.',
      type: 'system',
    });

    const io = req.app.get('io');
    const allProviders = await User.find({ role: 'service_provider', status: 'approved' });
    const notifyPayload = {
      taskId: task._id,
      description: task.description,
      aiTags: task.aiTags,
      matchedDomains: task.matchedDomains,
      expiresAt: task.acceptWindowExpiry,
      customerId: req.user._id,
      customerName: req.user.name,
    };
    for (const p of allProviders) {
      io.to(`provider_${p._id}`).emit('new_task_notification', notifyPayload);
    }
    io.to('providers_online').emit('task_available', notifyPayload);

    // Auto-expire again after extended window
    setTimeout(async () => {
      const freshTask = await Task.findById(task._id);
      if (freshTask && freshTask.status === 'notifying') {
        freshTask.status = 'expired';
        await freshTask.save();
        await Message.create({
          taskId: task._id,
          chatRoomId: task._id.toString(),
          senderId: req.user._id,
          senderRole: 'system',
          content: 'No expert was available after the extended wait. Please try starting a new session.',
          type: 'system',
        });
        io.to(`customer_${req.user._id}`).emit('task_expired', { taskId: task._id });
      }
    }, EXTEND_WINDOW_MS);

    const populated = await Task.findById(task._id)
      .populate('customerId', 'name email')
      .populate('serviceProviderId', 'name email expertise bio avatar rating');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/tasks/my
router.get('/my', protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'customer') filter.customerId = req.user._id;
    else if (req.user.role === 'service_provider') filter.serviceProviderId = req.user._id;
    const tasks = await Task.find(filter)
      .populate('customerId', 'name email')
      .populate('serviceProviderId', 'name email expertise bio avatar rating')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('serviceProviderId', 'name email expertise bio avatar rating completedTasks');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
