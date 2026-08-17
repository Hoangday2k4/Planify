import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';

// Kiểm tra trùng lịch
const checkConflict = async (userId: string, startTime: Date, endTime: Date, excludeEventId?: string) => {
  const conflict = await prisma.event.findFirst({
    where: {
      userId,
      id: excludeEventId ? { not: excludeEventId } : undefined,
      startTime: { lt: endTime },
      endTime: { gt: startTime }
    }
  });
  return conflict;
};

export const getEvents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { start, end } = req.query;

    let events;

    if (start && end) {
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);

      events = await prisma.event.findMany({
        where: {
          userId,
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
          category: true,
          reminders: true,
          tags: true
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
        // Nếu không phải sự kiện lặp
        if (!event.repeatRule || event.repeatRule === 'NONE') {
          expandedEvents.push(event);
          continue;
        }

        // Đẩy sự kiện gốc nếu nó nằm trong khoảng truy vấn
        if (event.startTime >= queryStart && event.endTime <= queryEnd) {
          expandedEvents.push(event);
        }

        const startMs = event.startTime.getTime();
        const endMs = event.endTime.getTime();
        const durationMs = endMs - startMs;

        let currentStart = new Date(event.startTime);

        while (currentStart.getTime() <= queryEnd.getTime()) {
          // Đi tới mốc lặp tiếp theo
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

          // Nếu lần lặp ảo này nằm trong khoảng truy vấn
          if (nextStart.getTime() >= queryStart.getTime() && nextStart.getTime() <= queryEnd.getTime()) {
            expandedEvents.push({
              ...event,
              id: `${event.id}_${nextStart.getTime()}`, // ID ảo
              startTime: nextStart,
              endTime: nextEnd,
              isRecurringClone: true
            });
          }
        }
      }

      return res.status(200).json(expandedEvents);
    } else {
      events = await prisma.event.findMany({
        where: { userId },
        include: {
          category: true,
          reminders: true,
          tags: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });
      return res.status(200).json(events);
    }
  } catch (error: any) {
    console.error('Lỗi lấy danh sách sự kiện:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const getEventById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        category: true,
        reminders: true,
        tags: true
      }
    });

    if (!event || event.userId !== userId) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    res.status(200).json(event);
  } catch (error: any) {
    console.error('Lỗi lấy chi tiết sự kiện:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const createEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { title, description, startTime, endTime, location, priority, categoryId, repeatRule, color, status, reminders, tagIds } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ message: 'Tiêu đề, thời gian bắt đầu và kết thúc là bắt buộc.' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });
    }

    // 1. Kiểm tra trùng lịch
    const conflict = await checkConflict(userId, start, end);
    if (conflict) {
      return res.status(409).json({ 
        message: 'Trùng lịch với một sự kiện khác diễn ra vào thời điểm này.',
        conflictEvent: {
          id: conflict.id,
          title: conflict.title,
          startTime: conflict.startTime,
          endTime: conflict.endTime
        }
      });
    }

    // 2. Tạo sự kiện
    const event = await prisma.event.create({
      data: {
        userId,
        title,
        description,
        startTime: start,
        endTime: end,
        location,
        priority: priority || 'MEDIUM',
        categoryId: categoryId || null,
        repeatRule: repeatRule || 'NONE',
        color: color || '#3b82f6',
        status: status || 'CONFIRMED',
        reminders: reminders && reminders.length > 0 ? {
          create: reminders.map((r: any) => ({
            minutesBefore: r.minutesBefore || 15,
            type: r.type || 'NOTIFICATION'
          }))
        } : undefined,
        tags: tagIds && tagIds.length > 0 ? {
          connect: tagIds.map((tid: string) => ({ id: tid }))
        } : undefined
      },
      include: {
        reminders: true,
        tags: true,
        category: true
      }
    });

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Lỗi tạo sự kiện:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const updateEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const id = req.params.id as string;
    const { title, description, startTime, endTime, location, priority, categoryId, repeatRule, color, status, reminders, tagIds } = req.body;

    const existingEvent = await prisma.event.findUnique({
      where: { id }
    });

    if (!existingEvent || existingEvent.userId !== userId) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện cần cập nhật.' });
    }

    const start = startTime ? new Date(startTime) : existingEvent.startTime;
    const end = endTime ? new Date(endTime) : existingEvent.endTime;

    if (start >= end) {
      return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });
    }

    // 1. Kiểm tra trùng lịch (loại trừ sự kiện hiện tại)
    if (startTime || endTime) {
      const conflict = await checkConflict(userId, start, end, id);
      if (conflict) {
        return res.status(409).json({ 
          message: 'Thời gian mới trùng lịch với sự kiện khác.',
          conflictEvent: {
            id: conflict.id,
            title: conflict.title,
            startTime: conflict.startTime,
            endTime: conflict.endTime
          }
        });
      }
    }

    // 2. Cập nhật reminders nếu được truyền lên
    if (reminders) {
      // Xóa tất cả reminders cũ
      await prisma.reminder.deleteMany({
        where: { eventId: id }
      });
    }

    // 3. Cập nhật thông tin sự kiện
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title,
        description,
        startTime: start,
        endTime: end,
        location,
        priority,
        categoryId: categoryId || null,
        repeatRule,
        color,
        status,
        reminders: reminders && reminders.length > 0 ? {
          create: reminders.map((r: any) => ({
            minutesBefore: r.minutesBefore || 15,
            type: r.type || 'NOTIFICATION'
          }))
        } : undefined,
        tags: tagIds !== undefined ? {
          set: tagIds.map((tid: string) => ({ id: tid }))
        } : undefined
      },
      include: {
        reminders: true,
        category: true,
        tags: true
      }
    });

    res.status(200).json(updatedEvent);
  } catch (error: any) {
    console.error('Lỗi cập nhật sự kiện:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const deleteEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const id = req.params.id as string;

    const existingEvent = await prisma.event.findUnique({
      where: { id }
    });

    if (!existingEvent || existingEvent.userId !== userId) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    }

    await prisma.event.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Xóa sự kiện thành công.' });
  } catch (error: any) {
    console.error('Lỗi xóa sự kiện:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};
