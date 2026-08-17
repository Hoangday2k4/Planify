import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';

export const globalSearch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const query = (req.query.q as string || '').trim();

    if (!query) {
      return res.status(200).json({ events: [], tasks: [] });
    }

    // Quét các Event khớp tiêu đề hoặc mô tả
    const events = await prisma.event.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query } },
          { description: { contains: query } }
        ]
      },
      include: {
        category: true,
        tags: true
      },
      take: 15,
      orderBy: { startTime: 'asc' }
    });

    // Quét các Task khớp tiêu đề hoặc mô tả
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query } },
          { description: { contains: query } }
        ]
      },
      include: {
        category: true,
        subtasks: true,
        tags: true
      },
      take: 15,
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ events, tasks });
  } catch (error: any) {
    console.error('Lỗi tìm kiếm toàn văn:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};
