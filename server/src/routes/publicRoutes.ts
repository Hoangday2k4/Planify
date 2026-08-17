import { Router } from 'express';
import { getPublicEvents } from '../controllers/publicController';
import prisma from '../services/prisma';

const router = Router();

router.get('/calendar/:shareToken', getPublicEvents);

router.get('/calendar/export/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    const events = await prisma.event.findMany({
      where: { userId }
    });

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        deadline: { not: null }
      },
      include: {
        category: true
      }
    });

    const formatDateToiCal = (date: Date) => {
      const pad = (num: number) => num.toString().padStart(2, '0');
      const d = new Date(date);
      return [
        d.getUTCFullYear(),
        pad(d.getUTCMonth() + 1),
        pad(d.getUTCDate()),
        'T',
        pad(d.getUTCHours()),
        pad(d.getUTCMinutes()),
        pad(d.getUTCSeconds()),
        'Z'
      ].join('');
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Antigravity//Planify Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    const escapeText = (text: string | null) => {
      if (!text) return '';
      return text
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');
    };

    for (const event of events) {
      const stamp = formatDateToiCal(event.createdAt);
      const start = formatDateToiCal(event.startTime);
      const end = formatDateToiCal(event.endTime);
      
      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${event.id}@planify.app`);
      icsContent.push(`DTSTAMP:${stamp}`);
      icsContent.push(`DTSTART:${start}`);
      icsContent.push(`DTEND:${end}`);
      icsContent.push(`SUMMARY:${escapeText(event.title)}`);
      if (event.description) {
        icsContent.push(`DESCRIPTION:${escapeText(event.description)}`);
      }
      if (event.location) {
        icsContent.push(`LOCATION:${escapeText(event.location)}`);
      }
      icsContent.push('END:VEVENT');
    }

    for (const task of tasks) {
      if (!task.deadline) continue;
      const stamp = formatDateToiCal(task.createdAt);
      const start = formatDateToiCal(task.deadline);
      const endTime = new Date(task.deadline.getTime() + 30 * 60 * 1000);
      const end = formatDateToiCal(endTime);
      
      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:task-${task.id}@planify.app`);
      icsContent.push(`DTSTAMP:${stamp}`);
      icsContent.push(`DTSTART:${start}`);
      icsContent.push(`DTEND:${end}`);
      icsContent.push(`SUMMARY:[Công việc] ${escapeText(task.title)}`);
      
      let descParts = [];
      if (task.description) descParts.push(task.description);
      descParts.push(`Trạng thái: ${task.status === 'COMPLETED' ? 'Đã hoàn thành' : task.status === 'IN_PROGRESS' ? 'Đang thực hiện' : 'Chưa bắt đầu'}`);
      descParts.push(`Tiến độ: ${task.progress}%`);
      if (task.category) descParts.push(`Danh mục: ${task.category.name}`);
      
      icsContent.push(`DESCRIPTION:${escapeText(descParts.join(' | '))}`);
      icsContent.push('END:VEVENT');
    }

    icsContent.push('END:VCALENDAR');

    const result = icsContent.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="planify-calendar-${user.username}.ics"`);
    res.status(200).send(result);

  } catch (error) {
    console.error('Lỗi xuất file iCalendar:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
});

export default router;
