const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

// GET /api/chat/:chatRoomId — Get messages for a chat room
router.get('/:chatRoomId', protect, async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Verify user has access to this chat room
    const task = await Task.findOne({ chatRoomId });
    if (!task) return res.status(404).json({ message: 'Chat room not found' });

    const userId = req.user._id.toString();
    const isOwner =
      task.customerId.toString() === userId ||
      (task.serviceProviderId && task.serviceProviderId.toString() === userId) ||
      req.user.role === 'admin';

    if (!isOwner) return res.status(403).json({ message: 'Access denied to this chat' });

    const messages = await Message.find({ chatRoomId })
      .populate('senderId', 'name role avatar')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chat/:chatRoomId — Send a message (REST fallback)
router.post('/:chatRoomId', protect, async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Message content required' });

    const task = await Task.findOne({ chatRoomId });
    if (!task) return res.status(404).json({ message: 'Chat room not found' });

    const message = await Message.create({
      taskId: task._id,
      chatRoomId,
      senderId: req.user._id,
      senderRole: req.user.role === 'service_provider' ? 'service_provider' : 'customer',
      content,
    });

    const populated = await Message.findById(message._id).populate('senderId', 'name role avatar');

    // Emit via socket
    const io = req.app.get('io');
    io.to(chatRoomId).emit('new_message', populated);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
