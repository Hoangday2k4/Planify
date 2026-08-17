import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';
import { logActivity } from '../services/activityLogger';
import { broadcastToTask, sendNotification, broadcastToUsers } from '../services/socket';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.use(authenticateJWT as any);

router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id!;
    const file = req.file;
    const { taskId, eventId, commentId } = req.body;

    if (!file) {
      return res.status(400).json({ message: 'Vui lòng chọn một tệp tin để tải lên.' });
    }

    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { members: true }
      });
      if (!task) {
        return res.status(404).json({ message: 'Không tìm thấy dự án.' });
      }
      const isOwner = task.userId === userId;
      const isEditor = task.members.some(m => m.userId === userId && m.role === 'EDITOR');
      if (!isOwner && !isEditor) {
        // Xóa file tạm vừa upload lên nếu không có quyền
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(403).json({ message: 'Bạn không có quyền tải tài liệu lên dự án này (chỉ xem).' });
      }
    }

    const filePath = `/uploads/${file.filename}`;

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        taskId: taskId || null,
        eventId: eventId || null,
        commentId: commentId || null,
        userId
      },
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    });

    if (taskId) {
      await logActivity(userId, 'UPLOAD_FILE', `đã tải lên tài liệu đính kèm "${file.originalname}"`, taskId);
      
      const updatedTask = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          subtasks: {
            include: {
              assignedUser: {
                select: { id: true, username: true, avatar: true }
              }
            }
          },
          category: true,
          tags: true,
          attachments: true,
          members: {
            include: {
              user: {
                select: { id: true, username: true, avatar: true, email: true }
              }
            }
          },
          user: {
            select: { id: true, username: true, avatar: true, email: true }
          }
        }
      });
      if (updatedTask) {
        broadcastToTask(taskId, 'task_updated', updatedTask);
        // Phát realtime đến room cá nhân từng thành viên để đồng bộ
        const recipientIds = new Set<string>();
        recipientIds.add(updatedTask.userId);
        updatedTask.members.forEach((m) => recipientIds.add(m.userId));
        broadcastToUsers(Array.from(recipientIds), 'task_updated', updatedTask);

        // Gửi thông báo đến toàn bộ thành viên
        try {
          const performerName = req.user?.username || 'Thành viên';
          const notificationTitle = 'Tài liệu đính kèm mới';

          for (const recipientId of recipientIds) {
            let content = '';
            if (recipientId === userId) {
              content = `Bạn đã tải lên tài liệu đính kèm <b>"${file.originalname}"</b> trong dự án <b>"${updatedTask.title}"</b>. (ID: ${taskId})`;
            } else {
              content = `<b>${performerName}</b> đã tải lên tài liệu đính kèm <b>"${file.originalname}"</b> trong dự án <b>"${updatedTask.title}"</b>. (ID: ${taskId})`;
            }
            await sendNotification(recipientId, notificationTitle, content);
          }
        } catch (err) {
          console.error('Lỗi gửi thông báo thêm tài liệu:', err);
        }
      }
    }

    res.status(201).json(attachment);
  } catch (error: any) {
    console.error('Lỗi tải file lên:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server trong quá trình tải file lên.' });
  }
});

// DELETE /attachments/:id - Xóa tài liệu tham khảo kèm phân quyền và thông báo
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id!;
    const id = req.params.id as string;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            members: true
          }
        }
      }
    }) as any;

    if (!attachment) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu đính kèm.' });
    }

    let canDelete = false;
    let taskTitle = '';
    let taskId = '';
    let creatorId = '';
    let members: any[] = [];

    if (attachment.task) {
      taskTitle = attachment.task.title;
      taskId = attachment.task.id;
      creatorId = attachment.task.userId;
      members = attachment.task.members;

      const isOwner = attachment.task.userId === userId;
      const isEditor = attachment.task.members.some((m: any) => m.userId === userId && m.role === 'EDITOR');
      const isCreatorOfAttachment = attachment.userId === userId;

      if (isOwner) {
        canDelete = true;
      } else if (isEditor && isCreatorOfAttachment) {
        canDelete = true;
      }
    } else {
      if (attachment.userId === userId) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa tài liệu đính kèm này.' });
    }

    // Xóa file vật lý
    const absolutePath = path.join(__dirname, '../..', attachment.filePath);
    if (fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (err) {
        console.error('Lỗi khi xóa file vật lý:', err);
      }
    }

    // Xóa record DB
    await prisma.attachment.delete({
      where: { id }
    });

    // Thông báo và cập nhật task
    if (taskId) {
      await logActivity(userId, 'DELETE_FILE', `đã xóa tài liệu đính kèm "${attachment.fileName}"`, taskId);

      const recipientIds = new Set<string>();
      recipientIds.add(creatorId);
      members.forEach((m: any) => recipientIds.add(m.userId));

      try {
        const performerName = req.user?.username || 'Thành viên';
        const notificationTitle = 'Tài liệu đính kèm bị xóa';

        for (const recipientId of recipientIds) {
          let content = '';
          if (recipientId === userId) {
            content = `Bạn đã xóa tài liệu đính kèm <b>"${attachment.fileName}"</b> trong dự án <b>"${taskTitle}"</b>. (ID: ${taskId})`;
          } else {
            content = `<b>${performerName}</b> đã xóa tài liệu đính kèm <b>"${attachment.fileName}"</b> trong dự án <b>"${taskTitle}"</b>. (ID: ${taskId})`;
          }
          await sendNotification(recipientId, notificationTitle, content);
        }
      } catch (err) {
        console.error('Lỗi gửi thông báo xóa tài liệu:', err);
      }

      // Phát socket cập nhật task
      const updatedTask = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          subtasks: {
            include: {
              assignedUser: {
                select: { id: true, username: true, avatar: true }
              }
            }
          },
          category: true,
          tags: true,
          attachments: true,
          members: {
            include: {
              user: {
                select: { id: true, username: true, avatar: true, email: true }
              }
            }
          },
          user: {
            select: { id: true, username: true, avatar: true, email: true }
          }
        }
      });
      if (updatedTask) {
        broadcastToTask(taskId, 'task_updated', updatedTask);
        broadcastToUsers(Array.from(recipientIds), 'task_updated', updatedTask);
      }
    }

    res.status(200).json({ message: 'Xóa tài liệu đính kèm thành công.' });
  } catch (error: any) {
    console.error('Lỗi khi xóa tài liệu đính kèm:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
});

export default router;
