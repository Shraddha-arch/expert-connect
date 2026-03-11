require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const socketHandler = require('./src/socket/handler');

// Allow multiple comma-separated origins (e.g. Vercel + localhost)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

async function startServer() {
  // Use real MongoDB if MONGODB_URI is set, otherwise fall back to in-memory (local dev)
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
  } else {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    console.log('✅ In-memory MongoDB started (local dev)');
  }

  // Seed demo users if DB is empty
  await require('./src/config/seed')();

  const app = express();
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  app.set('io', io);

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());

  app.use('/api/auth',    require('./src/routes/auth'));
  app.use('/api/admin',   require('./src/routes/admin'));
  app.use('/api/tasks',   require('./src/routes/task'));
  app.use('/api/chat',    require('./src/routes/chat'));
  app.use('/api/payment', require('./src/routes/payment'));

  socketHandler(io);

  app.get('/health', (req, res) => res.json({ status: 'OK', env: process.env.NODE_ENV || 'development' }));

  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    if (!process.env.MONGODB_URI) {
      console.log('\n--- Demo Login Credentials ---');
      console.log('Admin:    admin@expertconnect.com / admin123');
      console.log('Provider: lawyer@expertconnect.com / provider123');
      console.log('Customer: customer@expertconnect.com / customer123\n');
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
