import cron from 'node-cron';
import prisma from './prisma';
import { createJob } from './queue';

export const startReminderCron = () => {
  console.log('[Reminder Cron] Đã khởi chạy cron job quét nhắc nhở lịch biểu.');

  // Quét mỗi phút: '* * * * *'
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // === 1. QUÉT NHẮC NHỞ SỰ KIỆN LỊCH BIỂU ===
      const reminders = await prisma.reminder.findMany({
        where: {
          event: {
            OR: [
              // 1. Sự kiện lặp lại (luôn lấy để kiểm tra các mốc lặp ở tương lai)
              {
                repeatRule: {
                  not: null
                },
                NOT: {
                  repeatRule: 'NONE'
                }
              },
              // 2. Sự kiện thường: Chỉ lấy các sự kiện chưa kết thúc và bắt đầu trong vòng 24 tiếng tới
              {
                OR: [
                  { repeatRule: null },
                  { repeatRule: 'NONE' }
                ],
                startTime: {
                  lte: new Date(now.getTime() + 24 * 60 * 60 * 1000)
                },
                endTime: {
                  gte: now
                }
              }
            ]
          }
        },
        include: {
          event: {
            include: {
              user: true
            }
          }
        }
      });

      for (const r of reminders) {
        const event = r.event;
        const isRecurring = event.repeatRule && event.repeatRule !== 'NONE';

        if (isRecurring) {
          // Tính thời gian ảo cho ngày hôm nay
          const nowLocal = new Date();
          
          // Kiểm tra chu kỳ lặp
          let matchesPattern = false;
          const origStart = new Date(event.startTime);
          
          if (event.repeatRule === 'DAILY') {
            matchesPattern = nowLocal >= origStart;
          } else if (event.repeatRule === 'WEEKLY') {
            matchesPattern = nowLocal >= origStart && nowLocal.getDay() === origStart.getDay();
          } else if (event.repeatRule === 'MONTHLY') {
            matchesPattern = nowLocal >= origStart && nowLocal.getDate() === origStart.getDate();
          }

          if (matchesPattern) {
            // Dựng mốc thời gian ảo cho hôm nay
            const virtualStart = new Date(nowLocal);
            virtualStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds(), origStart.getMilliseconds());
            
            const origEnd = new Date(event.endTime);
            const durationMs = origEnd.getTime() - origStart.getTime();
            const virtualEnd = new Date(virtualStart.getTime() + durationMs);

            const triggerTime = new Date(virtualStart.getTime() - r.minutesBefore * 60 * 1000);

            if (now >= triggerTime && now < virtualEnd) {
              // Kiểm tra xem hôm nay đã gửi thông báo cho sự kiện này chưa
              const startOfToday = new Date(nowLocal);
              startOfToday.setHours(0, 0, 0, 0);

              const notificationExists = await prisma.notification.findFirst({
                where: {
                  userId: event.userId,
                  createdAt: { gte: startOfToday },
                  content: {
                    contains: `[Event ID: ${event.id}]`
                  }
                }
              });

              if (!notificationExists) {
                // Tạo thông báo lưu vết
                if (r.type === 'EMAIL') {
                  await prisma.notification.create({
                    data: {
                      userId: event.userId,
                      title: 'Nhắc nhở sự kiện sắp bắt đầu (Email)',
                      content: `Sự kiện "${event.title}" sẽ diễn ra sau ${r.minutesBefore} phút. [EMAIL_ONLY] [Event ID: ${event.id}]`,
                      isRead: true
                    }
                  });
                } else {
                  await prisma.notification.create({
                    data: {
                      userId: event.userId,
                      title: 'Nhắc nhở sự kiện sắp bắt đầu',
                      content: `Sự kiện "${event.title}" sẽ diễn ra sau ${r.minutesBefore} phút (lúc ${virtualStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). [Event ID: ${event.id}]`,
                      isRead: false
                    }
                  });
                }

                // Gửi email
                if (r.type === 'EMAIL' && event.user.email) {
                  const subject = `[Planify] Nhắc nhở sự kiện: ${event.title}`;
                  const body = `Xin chào ${event.user.username},\n\nSự kiện "${event.title}" của bạn sẽ bắt đầu sau ${r.minutesBefore} phút (lúc ${virtualStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ngày ${virtualStart.toLocaleDateString()}).\nĐịa điểm: ${event.location || 'Không có'}\nMô tả: ${event.description || 'Không có'}\n\nChúc bạn hoàn thành tốt công việc!`;
                  
                  await createJob('SEND_EMAIL', { to: event.user.email, subject, text: body });
                }

                console.log(`[Reminder Cron] Đã kích hoạt và gửi nhắc nhở LẶP LẠI cho sự kiện: "${event.title}"`);
              }
            }
          }
        } else {
          // Sự kiện không lặp lại: chạy logic cũ và XÓA reminder
          const origStart = new Date(event.startTime);
          const origEnd = new Date(event.endTime);
          const triggerTime = new Date(origStart.getTime() - r.minutesBefore * 60 * 1000);

          if (now >= triggerTime && now < origEnd) {
            if (r.type === 'EMAIL') {
              await prisma.notification.create({
                data: {
                  userId: event.userId,
                  title: 'Nhắc nhở sự kiện sắp bắt đầu (Email)',
                  content: `Sự kiện "${event.title}" sẽ diễn ra sau ${r.minutesBefore} phút. [EMAIL_ONLY] [Event ID: ${event.id}]`,
                  isRead: true
                }
              });
            } else {
              await prisma.notification.create({
                data: {
                  userId: event.userId,
                  title: 'Nhắc nhở sự kiện sắp bắt đầu',
                  content: `Sự kiện "${event.title}" sẽ diễn ra sau ${r.minutesBefore} phút (lúc ${origStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). [Event ID: ${event.id}]`,
                  isRead: false
                }
              });
            }

            if (r.type === 'EMAIL' && event.user.email) {
              const subject = `[Planify] Nhắc nhở sự kiện: ${event.title}`;
              const body = `Xin chào ${event.user.username},\n\nSự kiện "${event.title}" của bạn sẽ bắt đầu sau ${r.minutesBefore} phút (lúc ${origStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ngày ${origStart.toLocaleDateString()}).\nĐịa điểm: ${event.location || 'Không có'}\nMô tả: ${event.description || 'Không có'}\n\nChúc bạn hoàn thành tốt công việc!`;
              
              await createJob('SEND_EMAIL', { to: event.user.email, subject, text: body });
            }

            await prisma.reminder.delete({
              where: { id: r.id }
            });

            console.log(`[Reminder Cron] Đã kích hoạt và gửi nhắc nhở cho sự kiện thường: "${event.title}"`);
          }
        }
      }

      // === 2. QUÉT NHẮC NHỞ CÔNG VIỆC SẮP ĐẾN HẠN CHÓT (24 TIẾNG) ===
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const tasks = await prisma.task.findMany({
        where: {
          status: { not: 'COMPLETED' },
          deadline: {
            gte: startOfToday,
            lte: endOfToday
          }
        },
        include: {
          user: true
        }
      });

      for (const task of tasks) {
        if (!task.deadline) continue;
        
        // Thời điểm kích hoạt: 00:00 của ngày deadline (12 tiếng trước ngày đến hạn)
        const triggerTime = new Date(task.deadline);
        triggerTime.setHours(0, 0, 0, 0);

        // Kích hoạt khi thời gian hiện tại vượt qua triggerTime và chưa qua deadline
        if (now >= triggerTime && now < task.deadline) {
          // Kiểm tra xem đã gửi thông báo cho task này chưa
          const notificationExists = await prisma.notification.findFirst({
            where: {
              userId: task.userId,
              content: {
                contains: `(ID: ${task.id})`
              }
            }
          });

          if (!notificationExists) {
            const deadlineTimeStr = new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const deadlineDateStr = new Date(task.deadline).toLocaleDateString();

            // 1. Tạo thông báo hệ thống (Web)
            await prisma.notification.create({
              data: {
                userId: task.userId,
                title: 'Nhắc nhở: Hôm nay là hạn chót công việc',
                content: `Công việc "${task.title}" (ID: ${task.id}) đến hạn chót vào hôm nay (lúc ${deadlineTimeStr} ngày ${deadlineDateStr}).`,
                isRead: false
              }
            });

            // 2. Gửi Email nhắc nhở
            if (task.user.email) {
              const subject = `[Planify] Nhắc nhở: Hôm nay là hạn chót công việc: ${task.title}`;
              const body = `Xin chào ${task.user.username},\n\nCông việc "${task.title}" của bạn đến hạn chót vào ngày hôm nay (lúc ${deadlineTimeStr} ngày ${deadlineDateStr}).\n\nMô tả công việc: ${task.description || 'Không có'}\n\nVui lòng hoàn thành công việc đúng hạn!\n\nTrân trọng,\nPlanify Team`;
              
              await createJob('SEND_EMAIL', { to: task.user.email, subject, text: body });
            }

            console.log(`[Reminder Cron] Đã gửi thông báo nhắc nhở hạn chót ngày hôm nay cho công việc: "${task.title}"`);
          }
        }
      }

    } catch (error) {
      console.error('[Reminder Cron] Gặp lỗi khi chạy job:', error);
    }
  });
};
