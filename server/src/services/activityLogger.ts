import prisma from './prisma';

export const logActivity = async (
  userId: string,
  action: string,
  details: string,
  taskId?: string,
  eventId?: string
) => {
  try {
    const log = await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
        taskId: taskId || null,
        eventId: eventId || null
      }
    });
    return log;
  } catch (error) {
    console.error('[Activity Logger] Lỗi khi ghi nhận nhật ký hoạt động:', error);
  }
};
