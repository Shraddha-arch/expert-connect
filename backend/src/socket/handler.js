const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Task = require('../models/Task');

module.exports = (io) => {
  // Middleware: authenticate socket connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${user.name} (${user.role})`);

    // Update user's online status and socketId
    await User.findByIdAndUpdate(user._id, { socketId: socket.id, isOnline: true });

    // Join role-specific rooms
    if (user.role === 'admin') socket.join('admin_room');
    if (user.role === 'customer') socket.join(`customer_${user._id}`);
    if (user.role === 'service_provider') {
      socket.join(`provider_${user._id}`);
      socket.join('providers_online'); // all-providers broadcast room
    }

    // JOIN CHAT ROOM
    socket.on('join_room', async ({ chatRoomId }) => {
      socket.join(chatRoomId);
      console.log(`${user.name} joined room: ${chatRoomId}`);
    });

    // LEAVE CHAT ROOM
    socket.on('leave_room', ({ chatRoomId }) => {
      socket.leave(chatRoomId);
    });

    // SEND MESSAGE
    socket.on('send_message', async ({ chatRoomId, content, taskId }) => {
      try {
        if (!content || !chatRoomId) return;

        const task = await Task.findOne({ chatRoomId });
        if (!task) return;

        const message = await Message.create({
          taskId: task._id,
          chatRoomId,
          senderId: user._id,
          senderRole: user.role === 'service_provider' ? 'service_provider' : 'customer',
          content,
          type: 'text',
        });

        const populated = await Message.findById(message._id).populate('senderId', 'name role avatar');

        io.to(chatRoomId).emit('new_message', populated);
        io.to('admin_room').emit('new_message_admin', { chatRoomId, message: populated });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // TYPING INDICATOR
    socket.on('typing', ({ chatRoomId }) => {
      socket.to(chatRoomId).emit('user_typing', { userId: user._id, name: user.name });
    });

    socket.on('stop_typing', ({ chatRoomId }) => {
      socket.to(chatRoomId).emit('user_stop_typing', { userId: user._id });
    });

    // PROVIDER AVAILABILITY TOGGLE
    socket.on('set_availability', async ({ isAvailable }) => {
      await User.findByIdAndUpdate(user._id, { isAvailable });
      socket.emit('availability_updated', { isAvailable });
    });

    // DISCONNECT
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${user.name}`);
      await User.findByIdAndUpdate(user._id, { isOnline: false, socketId: null });
    });
  });
};
