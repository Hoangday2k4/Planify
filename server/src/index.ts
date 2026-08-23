import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import categoryRoutes from './routes/categoryRoutes';
import eventRoutes from './routes/eventRoutes';
import taskRoutes from './routes/taskRoutes';
import notificationRoutes from './routes/notificationRoutes';
import tagRoutes from './routes/tagRoutes';
import searchRoutes from './routes/searchRoutes';
import publicRoutes from './routes/publicRoutes';
import attachmentRoutes from './routes/attachmentRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://planify-frontend-nine.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
  ],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/attachments', attachmentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { setIo } from './services/socket';
import { startReminderCron } from './services/reminderCron';
import { startBackgroundWorker } from './services/worker';

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    credentials: true
  }
});

setIo(io);

io.on('connection', (socket) => {
  socket.on('join_task', (taskId) => {
    socket.join(`task_${taskId}`);
  });

  socket.on('leave_task', (taskId) => {
    socket.leave(`task_${taskId}`);
  });

  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('leave_user', (userId) => {
    socket.leave(`user_${userId}`);
  });
});

// Start server
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  startReminderCron();
  startBackgroundWorker();
});
