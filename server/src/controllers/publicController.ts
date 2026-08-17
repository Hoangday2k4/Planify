import { Request, Response } from 'express';
import prisma from '../services/prisma';

export const getPublicEvents = async (req: Request, res: Response) => {
  try {
    const shareToken = req.params.shareToken as string;
    const { start, end } = req.query;

    if (!shareToken) {
      return res.status(400).json({ message: 'Thiếu mã chia sẻ.' });
    }

    const user = await prisma.user.findUnique({
      where: { shareToken }
    });

    if (!user) {
      return res.status(404).json({ message: 'Lịch biểu không tồn tại hoặc đã bị tắt chia sẻ.' });
    }

    // Kiểm tra và tự động dọn dẹp nếu token đã hết hạn
    if (user.shareExpiresAt && new Date() > user.shareExpiresAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { shareToken: null, shareExpiresAt: null }
      });
      return res.status(404).json({ message: 'Lịch biểu không tồn tại hoặc đã bị tắt chia sẻ.' });
    }

    let events: any[];

    if (start && end) {
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);

      events = await prisma.event.findMany({
        where: {
          userId: user.id,
          OR: [
            // Sự kiện thường nằm trong khoảng truy vấn
            {
              OR: [
                { repeatRule: null },
                { repeatRule: 'NONE' }
              ],
              startTime: { gte: startDate },
              endTime: { lte: endDate }
            },
            // Sự kiện lặp có ngày bắt đầu trước hoặc bằng ngày kết thúc truy vấn
            {
              NOT: [
                { repeatRule: null },
                { repeatRule: 'NONE' }
              ],
              startTime: { lte: endDate }
            }
          ]
        },
        include: {
          category: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      // Sinh sự kiện ảo lặp lại
      const expandedEvents: any[] = [];
      const queryStart = new Date(start as string);
      const queryEnd = new Date(end as string);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      for (const event of events) {
        if (!event.repeatRule || event.repeatRule === 'NONE') {
          expandedEvents.push({
            id: event.id,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            description: event.description,
            color: event.color,
            category: event.category
          });
          continue;
        }

        // Chỉ đưa sự kiện gốc vào nếu bắt đầu trước hoặc trong ngày hôm nay
        if (event.startTime >= queryStart && event.endTime <= queryEnd && event.startTime <= todayEnd) {
          expandedEvents.push({
            id: event.id,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            description: event.description,
            color: event.color,
            category: event.category
          });
        }

        const startMs = event.startTime.getTime();
        const endMs = event.endTime.getTime();
        const durationMs = endMs - startMs;

        let currentStart = new Date(event.startTime);

        while (currentStart.getTime() <= queryEnd.getTime()) {
          if (event.repeatRule === 'DAILY') {
            currentStart.setDate(currentStart.getDate() + 1);
          } else if (event.repeatRule === 'WEEKLY') {
            currentStart.setDate(currentStart.getDate() + 7);
          } else if (event.repeatRule === 'MONTHLY') {
            currentStart.setMonth(currentStart.getMonth() + 1);
          } else {
            break;
          }

          const nextStart = new Date(currentStart);
          const nextEnd = new Date(nextStart.getTime() + durationMs);

          // Chỉ sinh các sự kiện lặp ảo có ngày bắt đầu trước hoặc bằng ngày hôm nay
          if (nextStart.getTime() > todayEnd.getTime()) {
            break; // Các mốc lặp sau chắc chắn cũng lớn hơn ngày hôm nay
          }

          if (nextStart.getTime() >= queryStart.getTime() && nextStart.getTime() <= queryEnd.getTime()) {
            expandedEvents.push({
              id: `${event.id}_${nextStart.getTime()}`,
              title: event.title,
              startTime: nextStart,
              endTime: nextEnd,
              location: event.location,
              description: event.description,
              color: event.color,
              category: event.category,
              isRecurringClone: true
            });
          }
        }
      }

      return res.status(200).json({
        events: expandedEvents,
        user: {
          username: user.username
        }
      });
    } else {
      events = await prisma.event.findMany({
        where: { userId: user.id },
        include: {
          category: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      const basicEvents = events.map(e => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        description: e.description,
        color: e.color,
        category: e.category
      }));

      return res.status(200).json({
        events: basicEvents,
        user: {
          username: user.username
        }
      });
    }
  } catch (error: any) {
    console.error('Lỗi lấy lịch biểu công khai:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};
