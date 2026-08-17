import { Server } from 'socket.io';
import prisma from './prisma';

let io: Server | null = null;

export const setIo = (socketIoInstance: Server) => {
  io = socketIoInstance;
};

export const getIo = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet.');
  }
  return io;
};

export const broadcastToTask = (taskId: string, eventName: string, data: any) => {
  if (io) {
    io.to(`task_${taskId}`).emit(eventName, data);
  }
};

export const broadcastToUsers = (userIds: string[], eventName: string, data: any) => {
  if (io) {
    userIds.forEach((uid) => {
      io!.to(`user_${uid}`).emit(eventName, data);
    });
  }
};

export const sendNotification = async (userId: string, title: string, content: string) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        content,
        isRead: false
      }
    });

    if (io) {
      io.to(`user_${userId}`).emit('new_notification', notification);
    }
    return notification;
  } catch (error) {
    console.error('Lỗi khi gửi thông báo:', error);
  }
};
