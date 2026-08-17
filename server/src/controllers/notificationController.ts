import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Dọn dẹp ngầm thông báo ngày hôm trước trong DB để giải phóng dung lượng
    prisma.notification.deleteMany({
      where: {
        userId,
        createdAt: { lt: startOfToday }
      }
    }).catch(err => console.error('Lỗi dọn dẹp thông báo cũ:', err));

    // 2. Chỉ lấy thông báo từ đầu ngày hôm nay (lọc bỏ các vết nhắc nhở chỉ gửi qua email)
    const notifications = await prisma.notification.findMany({
      where: { 
        userId,
        createdAt: { gte: startOfToday },
        NOT: {
          content: {
            contains: '[EMAIL_ONLY]'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(notifications);
  } catch (error: any) {
    console.error('Lỗi lấy thông báo:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const id = req.params.id as string;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Lỗi đánh dấu đã đọc thông báo:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const clearReadNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;

    await prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true
      }
    });

    res.status(200).json({ message: 'Đã xóa tất cả thông báo đã đọc thành công.' });
  } catch (error: any) {
    console.error('Lỗi xóa toàn bộ thông báo đã đọc:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};
