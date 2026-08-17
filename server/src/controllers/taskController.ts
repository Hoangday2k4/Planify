import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';
import { logActivity } from '../services/activityLogger';
import { broadcastToTask, sendNotification, broadcastToUsers } from '../services/socket';

// Helper: Tự động cập nhật tiến độ (progress) và trạng thái (status) của Task
const updateTaskProgress = async (taskId: string) => {
  const subtasks = await prisma.subtask.findMany({
    where: { taskId }
  });

  if (subtasks.length === 0) {
    return;
  }

  const existingTask = await prisma.task.findUnique({
    where: { id: taskId }
  });
  if (!existingTask) return;

  const completedCount = subtasks.filter(s => s.isCompleted).length;
  const progress = Math.round((completedCount / subtasks.length) * 100);

  let status = existingTask.status;
  if (progress === 0) {
    status = 'PENDING';
  } else if (progress > 0 && progress < 100) {
    status = 'IN_PROGRESS';
  } else if (progress === 100) {
    if (existingTask.status !== 'COMPLETED') {
      status = 'IN_PROGRESS';
    }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { progress, status }
  });
};

const broadcastTaskUpdate = async (taskId: string) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: {
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            assignedUser: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        category: true,
        tags: true,
        attachments: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                email: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            email: true
          }
        }
      }
    });
    if (task) {
      broadcastToTask(taskId, 'task_updated', task);

      const recipientIds = new Set<string>();
      recipientIds.add(task.userId);
      task.members.forEach((m) => recipientIds.add(m.userId));
      broadcastToUsers(Array.from(recipientIds), 'task_updated', task);
    }
  } catch (err) {
    console.error('Lỗi khi phát thông báo cập nhật task:', err);
  }
};

// Helper: Kiểm tra xem user có quyền xem dự án (hoặc là chủ dự án, hoặc là thành viên dự án)
const canViewTask = async (taskId: string, userId: string): Promise<boolean> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId }
  });
  if (!task) return false;
  if (task.userId === userId) return true;

  const member = await prisma.taskMember.findUnique({
    where: {
      taskId_userId: { taskId, userId }
    }
  });
  return !!member;
};

// Helper: Kiểm tra xem user có quyền chỉnh sửa dự án (hoặc là chủ dự án, hoặc là thành viên có quyền EDITOR)
const canEditTask = async (taskId: string, userId: string): Promise<boolean> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId }
  });
  if (!task) return false;
  if (task.userId === userId) return true;

  const member = await prisma.taskMember.findUnique({
    where: {
      taskId_userId: { taskId, userId }
    }
  });
  return member?.role === 'EDITOR';
};

export const getTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        category: true,
        attachments: true,
        subtasks: {
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            assignedUser: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        tags: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                email: true,
                phone: true,
                role: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            email: true,
            phone: true,
            role: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // PENDING -> IN_PROGRESS -> COMPLETED
        { deadline: 'asc' }
      ]
    });

    res.status(200).json(tasks);
  } catch (error: any) {
    console.error('Lỗi lấy danh sách công việc:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { title, description, deadline, priority, categoryId, subtasks, tagIds } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Tiêu đề công việc là bắt buộc.' });
    }

    // Tự xác định isPersonal dựa trên tên danh mục
    let isPersonal = true;
    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (category && category.name !== 'Cá nhân') {
        isPersonal = false;
      }
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title,
        description,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        progress: 0,
        categoryId: categoryId || null,
        isPersonal,
        subtasks: subtasks && subtasks.length > 0 ? {
          create: subtasks.map((s: string) => ({
            title: s,
            isCompleted: false
          }))
        } : undefined,
        tags: tagIds && tagIds.length > 0 ? {
          connect: tagIds.map((tid: string) => ({ id: tid }))
        } : undefined
      },
      include: {
        subtasks: true,
        tags: true,
        attachments: true,
        category: true,
        members: true
      }
    });

    await logActivity(userId, 'CREATE_TASK', `đã tạo dự án mới "${task.title}"`, task.id);
    res.status(201).json(task);
  } catch (error: any) {
    console.error('Lỗi tạo công việc:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const id = req.params.id as string;
    const { title, description, deadline, priority, status, progress, categoryId, tagIds } = req.body;

    const existingTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!existingTask) {
      return res.status(404).json({ message: 'Không tìm thấy công việc.' });
    }

    // Sửa dự án: Chỉ chủ dự án hoặc thành viên có quyền EDITOR mới được phép
    const hasEditPermission = await canEditTask(id, userId);
    if (!hasEditPermission) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa dự án này.' });
    }

    let updatedProgress = progress !== undefined ? progress : existingTask.progress;
    if (status === 'COMPLETED') {
      if (existingTask.userId !== userId) {
        return res.status(403).json({ message: 'Chỉ chủ dự án mới được phép hoàn thành dự án.' });
      }

      // Kiểm tra xem dự án đã được phân công hay chưa
      const membersCount = await prisma.taskMember.count({
        where: { taskId: id }
      });
      if (membersCount === 0) {
        return res.status(400).json({ message: 'Dự án chưa phân công (chưa có người làm) thì không thể hoàn thành.' });
      }

      const incompleteSubtasks = await prisma.subtask.findMany({
        where: {
          taskId: id,
          isCompleted: false
        }
      });
      if (incompleteSubtasks.length > 0) {
        return res.status(400).json({ message: 'Chỉ có thể hoàn thành dự án khi tất cả công việc con đã được hoàn thành.' });
      }
      updatedProgress = 100;
    } else if (status === 'PENDING') {
      updatedProgress = 0;
      await prisma.subtask.updateMany({
        where: { taskId: id },
        data: { isCompleted: false }
      });
    }

    let isPersonal = existingTask.isPersonal;
    if (categoryId !== undefined) {
      if (categoryId) {
        const category = await prisma.category.findUnique({ where: { id: categoryId } });
        isPersonal = !category || category.name === 'Cá nhân';
      } else {
        isPersonal = true;
      }
    }

    if (isPersonal) {
      await prisma.taskMember.deleteMany({
        where: { taskId: id }
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : existingTask.deadline,
        priority: priority !== undefined ? priority : existingTask.priority,
        status: status !== undefined ? status : existingTask.status,
        progress: updatedProgress,
        categoryId: categoryId !== undefined ? (categoryId || null) : existingTask.categoryId,
        isPersonal,
        tags: tagIds !== undefined ? {
          set: tagIds.map((tid: string) => ({ id: tid }))
        } : undefined
      },
      include: {
        subtasks: {
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            assignedUser: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        category: true,
        tags: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Nếu có subtasks, tự động tính toán lại để tránh mâu thuẫn dữ liệu
    await updateTaskProgress(id);

    // Lấy lại dữ liệu sau khi tự động cập nhật
    const finalTask = await prisma.task.findUnique({
      where: { id },
      include: {
        subtasks: {
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            assignedUser: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        category: true,
        tags: true,
        attachments: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                email: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            email: true
          }
        }
      }
    });

    await logActivity(userId, 'UPDATE_TASK', `đã cập nhật thông tin dự án`, updatedTask.id);

    if (status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      try {
        const creatorId = existingTask.userId;
        const members = await prisma.taskMember.findMany({
          where: { taskId: id }
        });

        const recipientIds = new Set<string>();
        recipientIds.add(creatorId);
        members.forEach((m) => {
          recipientIds.add(m.userId);
        });

        const performerName = req.user?.username || 'Thành viên';
        const notificationTitle = 'Dự án đã hoàn thành';

        for (const recipientId of recipientIds) {
          let notificationContent = '';
          if (recipientId === userId) {
            notificationContent = `Bạn đã đánh dấu hoàn thành dự án <b>"${existingTask.title}"</b>. (ID: ${id})`;
          } else {
            notificationContent = `<b>${performerName}</b> đã đánh dấu hoàn thành dự án <b>"${existingTask.title}"</b>. (ID: ${id})`;
          }
          await sendNotification(recipientId, notificationTitle, notificationContent);
        }
      } catch (err) {
        console.error('Lỗi khi gửi thông báo hoàn thành dự án:', err);
      }
    }

    if (finalTask) {
      broadcastToTask(updatedTask.id, 'task_updated', finalTask);

      const recipientIds = new Set<string>();
      recipientIds.add(finalTask.userId);
      finalTask.members.forEach((m) => recipientIds.add(m.userId));
      broadcastToUsers(Array.from(recipientIds), 'task_updated', finalTask);
    }
    res.status(200).json(finalTask);
  } catch (error: any) {
    console.error('Lỗi cập nhật công việc:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.', error: error.message });
  }
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const id = req.params.id as string;

    const existingTask = await prisma.task.findUnique({
      where: { id }
    });

    if (!existingTask) {
      return res.status(404).json({ message: 'Không tìm thấy công việc.' });
    }

    // Xóa dự án: Chỉ chủ dự án (người tạo) mới được phép xóa
    if (existingTask.userId !== userId) {
      return res.status(403).json({ message: 'Chỉ chủ dự án mới có quyền xóa dự án này.' });
    }

    await logActivity(userId, 'DELETE_TASK', `đã xóa dự án "${existingTask.title}"`, id);

    try {
      const members = await prisma.taskMember.findMany({
        where: { taskId: id }
      });

      const performerName = req.user?.username || 'Chủ dự án';
      const notificationTitle = 'Dự án đã giải thể';
      const notificationContent = `Dự án <b>"${existingTask.title}"</b> đã bị giải thể bởi <b>${performerName}</b>.`;

      const recipientIds = new Set<string>();
      recipientIds.add(existingTask.userId);
      members.forEach((m) => recipientIds.add(m.userId));

      broadcastToUsers(Array.from(recipientIds), 'task_deleted', id);

      for (const rid of recipientIds) {
        let content = '';
        if (rid === userId) {
          content = `Bạn đã giải thể dự án <b>"${existingTask.title}"</b>.`;
        } else {
          content = `Dự án <b>"${existingTask.title}"</b> đã bị giải thể bởi <b>${performerName}</b>.`;
        }
        await sendNotification(rid, notificationTitle, content);
      }
    } catch (err) {
      console.error('Lỗi gửi thông báo giải thể dự án:', err);
    }

    await prisma.task.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Xóa công việc thành công.' });
  } catch (error: any) {
    console.error('Lỗi xóa công việc:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

// --- Subtask API ---

export const createSubtask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;
    const { title, assignedUserId } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Tiêu đề công việc con là bắt buộc.' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });
    if (!task) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }
    const isOwner = task.userId === userId;
    const hasEditPermission = await canEditTask(taskId, userId);

    if (!isOwner && !hasEditPermission) {
      return res.status(403).json({ message: 'Bạn không có quyền thêm công việc con vào dự án này.' });
    }

    let finalAssignedUserId = assignedUserId || null;
    if (!isOwner) {
      finalAssignedUserId = userId;
    }

    const subtask = await prisma.subtask.create({
      data: {
        taskId,
        title,
        isCompleted: false,
        assignedUserId: finalAssignedUserId,
        createdById: userId
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    // Cập nhật lại tiến độ công việc chính
    await updateTaskProgress(taskId);

    await logActivity(userId, 'CREATE_SUBTASK', `đã thêm công việc con mới "${subtask.title}"`, taskId);

    await broadcastTaskUpdate(taskId);

    try {
      const creatorId = task.userId;
      const members = await prisma.taskMember.findMany({
        where: { taskId }
      });

      const recipientIds = new Set<string>();
      recipientIds.add(creatorId);
      members.forEach((m) => {
        recipientIds.add(m.userId);
      });

      const performerName = req.user?.username || 'Thành viên';
      const notificationTitle = 'Công việc con mới';

      for (const recipientId of recipientIds) {
        let content = '';
        if (recipientId === userId) {
          content = `Bạn đã thêm công việc mới <b>"${subtask.title}"</b> trong dự án <b>"${task.title}"</b>. (ID: ${taskId})`;
        } else {
          content = `<b>${performerName}</b> đã thêm công việc mới <b>"${subtask.title}"</b> trong dự án <b>"${task.title}"</b>. (ID: ${taskId})`;
        }
        await sendNotification(recipientId, notificationTitle, content);
      }
    } catch (err) {
      console.error('Lỗi gửi thông báo thêm công việc con:', err);
    }

    res.status(201).json(subtask);
  } catch (error: any) {
    console.error('Lỗi tạo công việc con:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const toggleSubtask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const subtaskId = req.params.subtaskId as string;
    const { isCompleted, assignedUserId } = req.body || {};

    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: { 
        task: true,
        assignedUser: true
      }
    }) as any;

    if (!subtask) {
      return res.status(404).json({ message: 'Không tìm thấy công việc con.' });
    }

    const hasEditPermission = await canEditTask(subtask.taskId, userId);
    if (!hasEditPermission) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa công việc con trong dự án này.' });
    }

    // Chỉ chủ dự án mới có quyền phân công người thực hiện
    if (assignedUserId !== undefined && subtask.task.userId !== userId) {
      return res.status(403).json({ message: 'Chỉ chủ dự án mới có quyền phân công người thực hiện công việc con.' });
    }

    // Tài khoản có quyền sửa chỉ cho phép tick hoàn thành đối với các subtask được phân công hoặc do chính họ tạo
    const isOwner = subtask.task.userId === userId;
    const isAssignee = subtask.assignedUserId === userId;
    const isCreator = subtask.createdById === userId;
    const canToggle = isOwner || (hasEditPermission && (isAssignee || isCreator));
    if (!canToggle) {
      return res.status(403).json({ message: 'Bạn chỉ được phép thay đổi trạng thái của công việc con được phân công cho chính bạn hoặc do bạn tạo ra.' });
    }

    const updatedSubtask = await prisma.subtask.update({
      where: { id: subtaskId },
      data: {
        isCompleted: isCompleted !== undefined ? isCompleted : (assignedUserId !== undefined ? subtask.isCompleted : !subtask.isCompleted),
        assignedUserId: assignedUserId !== undefined ? (assignedUserId || null) : subtask.assignedUserId
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    // Cập nhật lại tiến độ công việc chính
    await updateTaskProgress(subtask.taskId);

    // Ghi log hoạt động
    if (isCompleted !== undefined && isCompleted !== subtask.isCompleted) {
      await logActivity(userId, isCompleted ? 'COMPLETE_SUBTASK' : 'INCOMPLETE_SUBTASK', `đã đánh dấu ${isCompleted ? 'hoàn thành' : 'chưa hoàn thành'} công việc con "${subtask.title}"`, subtask.taskId);
    }
    if (assignedUserId !== undefined && assignedUserId !== subtask.assignedUserId) {
      const assignedUser = updatedSubtask.assignedUser ? updatedSubtask.assignedUser.username : 'không ai cả';
      await logActivity(userId, 'ASSIGN_SUBTASK', `đã phân công công việc con "${subtask.title}" cho ${assignedUser}`, subtask.taskId);

      try {
        const performerName = req.user?.username || 'Chủ dự án';
        const creatorId = subtask.task.userId;
        const members = await prisma.taskMember.findMany({
          where: { taskId: subtask.taskId }
        });

        const recipientIds = new Set<string>();
        recipientIds.add(creatorId);
        members.forEach((m) => recipientIds.add(m.userId));
        if (updatedSubtask.assignedUserId) recipientIds.add(updatedSubtask.assignedUserId);
        if (subtask.assignedUserId) recipientIds.add(subtask.assignedUserId);

        for (const rid of recipientIds) {
          let title = 'Cập nhật phân công';
          let content = '';

          if (rid === userId) {
            if (updatedSubtask.assignedUserId) {
              content = `Bạn đã phân công công việc <b>"${subtask.title}"</b> cho <b>${assignedUser}</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
            } else {
              content = `Bạn đã hủy phân công công việc <b>"${subtask.title}"</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
            }
          } else if (rid === updatedSubtask.assignedUserId) {
            title = 'Phân công công việc mới';
            content = `<b>${performerName}</b> đã phân công công việc <b>"${subtask.title}"</b> cho bạn trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
          } else if (rid === subtask.assignedUserId) {
            title = 'Thay đổi phân công';
            content = `<b>${performerName}</b> đã thay đổi phân công công việc <b>"${subtask.title}"</b> của bạn trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
          } else {
            if (updatedSubtask.assignedUserId) {
              content = `<b>${performerName}</b> đã phân công công việc <b>"${subtask.title}"</b> cho <b>${assignedUser}</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
            } else {
              content = `<b>${performerName}</b> đã hủy phân công công việc <b>"${subtask.title}"</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
            }
          }
          await sendNotification(rid, title, content);
        }
      } catch (err) {
        console.error('Lỗi khi gửi thông báo phân công/sửa phân công:', err);
      }
    }

    await broadcastTaskUpdate(subtask.taskId);

    if (updatedSubtask.isCompleted && !subtask.isCompleted) {
      try {
        const creatorId = subtask.task.userId;
        const members = await prisma.taskMember.findMany({
          where: { taskId: subtask.taskId }
        });

        const recipientIds = new Set<string>();
        recipientIds.add(creatorId);
        members.forEach((m) => {
          recipientIds.add(m.userId);
        });

        const performerName = subtask.assignedUser ? subtask.assignedUser.username : (req.user?.username || 'Thành viên');
        const notificationTitle = 'Hoàn thành công việc con';

        for (const recipientId of recipientIds) {
          let content = '';
          if (recipientId === userId) {
            content = `Bạn đã đánh dấu hoàn thành công việc <b>"${subtask.title}"</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
          } else {
            content = `<b>${performerName}</b> đã đánh dấu hoàn thành công việc <b>"${subtask.title}"</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
          }
          await sendNotification(recipientId, notificationTitle, content);
        }
      } catch (err) {
        console.error('Lỗi gửi thông báo hoàn thành công việc con:', err);
      }
    }

    res.status(200).json(updatedSubtask);
  } catch (error: any) {
    console.error('Lỗi thay đổi trạng thái công việc con:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const deleteSubtask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const subtaskId = req.params.subtaskId as string;

    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: { task: true }
    }) as any;

    if (!subtask) {
      return res.status(404).json({ message: 'Không tìm thấy công việc con.' });
    }

    const isOwner = subtask.task.userId === userId;
    const hasEditPermission = await canEditTask(subtask.taskId, userId);
    const isCreator = subtask.createdById === userId;

    if (!isOwner && !(hasEditPermission && isCreator)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa công việc con này (chỉ người tạo hoặc chủ dự án mới được xóa).' });
    }

    await logActivity(userId, 'DELETE_SUBTASK', `đã xóa công việc con "${subtask.title}"`, subtask.taskId);

    await prisma.subtask.delete({
      where: { id: subtaskId }
    });

    // Cập nhật lại tiến độ công việc chính
    await updateTaskProgress(subtask.taskId);

    await broadcastTaskUpdate(subtask.taskId);

    try {
      const creatorId = subtask.task.userId;
      const members = await prisma.taskMember.findMany({
        where: { taskId: subtask.taskId }
      });

      const recipientIds = new Set<string>();
      recipientIds.add(creatorId);
      members.forEach((m) => {
        recipientIds.add(m.userId);
      });

      const performerName = req.user?.username || 'Thành viên';
      const notificationTitle = 'Công việc con bị xóa';

      for (const recipientId of recipientIds) {
        let content = '';
        if (recipientId === userId) {
          content = `Bạn đã xóa công việc con <b>"${subtask.title}"</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
        } else {
          content = `<b>${performerName}</b> đã xóa công việc con <b>"${subtask.title}"</b> trong dự án <b>"${subtask.task.title}"</b>. (ID: ${subtask.taskId})`;
        }
        await sendNotification(recipientId, notificationTitle, content);
      }
    } catch (err) {
      console.error('Lỗi gửi thông báo xóa công việc con:', err);
    }

    res.status(200).json({ message: 'Xóa công việc con thành công.' });
  } catch (error: any) {
    console.error('Lỗi xóa công việc con:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const getComments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;

    const hasViewPermission = await canViewTask(taskId, userId);
    if (!hasViewPermission) {
      return res.status(403).json({ message: 'Bạn không có quyền xem bình luận của dự án này.' });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            username: true,
            avatar: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json(comments);
  } catch (error: any) {
    console.error('Lỗi lấy bình luận:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const createComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Nội dung bình luận là bắt buộc.' });
    }

    const hasViewPermission = await canViewTask(taskId, userId);
    if (!hasViewPermission) {
      return res.status(403).json({ message: 'Bạn không có quyền gửi bình luận vào dự án này.' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        userId
      },
      include: {
        user: {
          select: {
            username: true,
            avatar: true,
            email: true
          }
        }
      }
    });

    await logActivity(userId, 'SEND_CHAT', `đã gửi bình luận thảo luận`, taskId);

    broadcastToTask(taskId, 'new_comment', comment);

    try {
      const taskInfo = await prisma.task.findUnique({
        where: { id: taskId },
        include: { members: true }
      });

      if (taskInfo) {
        const creatorId = taskInfo.userId;
        const recipientIds = new Set<string>();
        if (creatorId !== userId) {
          recipientIds.add(creatorId);
        }
        taskInfo.members.forEach((m) => {
          if (m.userId !== userId) {
            recipientIds.add(m.userId);
          }
        });

        const performerName = req.user?.username || 'Thành viên';
        const notificationTitle = `Bình luận mới: ${taskInfo.title}`;
        const shortContent = content.length > 55 ? `${content.substring(0, 52)}...` : content;
        const notificationContent = `<b>${performerName}</b> đã bình luận trong dự án <b>"${taskInfo.title}"</b>: "${shortContent}" (ID: ${taskId})`;

        for (const recipientId of recipientIds) {
          await sendNotification(recipientId, notificationTitle, notificationContent);
        }
      }
    } catch (err) {
      console.error('Lỗi gửi thông báo bình luận:', err);
    }

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Lỗi tạo bình luận:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

// --- Task Members Management API ---

export const getTaskMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;

    const hasViewPermission = await canViewTask(taskId, userId);
    if (!hasViewPermission) {
      return res.status(403).json({ message: 'Bạn không có quyền xem thành viên của dự án này.' });
    }

    const members = await prisma.taskMember.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            email: true
          }
        }
      }
    });

    res.status(200).json(members);
  } catch (error: any) {
    console.error('Lỗi lấy thành viên dự án:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const addTaskMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;
    const { username, role } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Tên tài khoản là bắt buộc.' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    // Chỉ chủ dự án mới có quyền thêm người
    if (task.userId !== userId) {
      return res.status(403).json({ message: 'Chỉ chủ dự án mới có quyền thêm thành viên.' });
    }

    // Tìm user theo username
    const targetUser = await prisma.user.findUnique({
      where: { username }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản người dùng này.' });
    }

    // Không được tự thêm chính mình
    if (targetUser.id === task.userId) {
      return res.status(400).json({ message: 'Bạn đã là chủ dự án này rồi.' });
    }

    // Kiểm tra xem đã là thành viên chưa
    const existingMember = await prisma.taskMember.findUnique({
      where: {
        taskId_userId: { taskId, userId: targetUser.id }
      }
    });

    if (existingMember) {
      return res.status(400).json({ message: 'Người dùng này đã là thành viên của dự án.' });
    }

    const newMember = await prisma.taskMember.create({
      data: {
        taskId,
        userId: targetUser.id,
        role: role || 'VIEWER'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            email: true
          }
        }
      }
    });

    await logActivity(userId, 'ADD_MEMBER', `đã thêm thành viên "${targetUser.username}" vào dự án với quyền ${role || 'VIEWER'}`, taskId);
    await broadcastTaskUpdate(taskId);

    try {
      const performerName = req.user?.username || 'Chủ dự án';
      const roleLabel = role === 'EDITOR' ? 'Quyền sửa' : 'Chỉ xem';

      const members = await prisma.taskMember.findMany({
        where: { taskId }
      });

      const recipientIds = new Set<string>();
      recipientIds.add(task.userId);
      recipientIds.add(targetUser.id);
      members.forEach((m) => {
        recipientIds.add(m.userId);
      });

      for (const rid of recipientIds) {
        let title = 'Cập nhật thành viên dự án';
        let content = '';
        if (rid === userId) {
          content = `Bạn đã thêm thành viên <b>"${targetUser.username}"</b> vào dự án <b>"${task.title}"</b>. (ID: ${taskId})`;
        } else if (rid === targetUser.id) {
          title = 'Bạn đã được thêm vào dự án mới';
          content = `<b>${performerName}</b> đã thêm bạn vào dự án <b>"${task.title}"</b> với vai trò ${roleLabel}. (ID: ${taskId})`;
        } else {
          content = `<b>${performerName}</b> đã thêm thành viên <b>"${targetUser.username}"</b> vào dự án <b>"${task.title}"</b>. (ID: ${taskId})`;
        }
        await sendNotification(rid, title, content);
      }
    } catch (err) {
      console.error('Lỗi gửi thông báo thêm thành viên:', err);
    }

    res.status(201).json(newMember);
  } catch (error: any) {
    console.error('Lỗi thêm thành viên dự án:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const updateTaskMemberRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;
    const memberId = req.params.memberId as string;
    const { role } = req.body;

    if (!role || !['VIEWER', 'EDITOR'].includes(role)) {
      return res.status(400).json({ message: 'Quyền thành viên không hợp lệ.' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    // Chỉ chủ dự án mới được chỉnh sửa quyền
    if (task.userId !== userId) {
      return res.status(403).json({ message: 'Chỉ chủ dự án mới có quyền thay đổi quyền thành viên.' });
    }

    const member = await prisma.taskMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.taskId !== taskId) {
      return res.status(404).json({ message: 'Không tìm thấy thành viên trong dự án này.' });
    }

    const updated = await prisma.taskMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            email: true
          }
        }
      }
    });

    await logActivity(userId, 'UPDATE_MEMBER_ROLE', `đã cập nhật vai trò của "${updated.user.username}" thành ${role}`, taskId);
    await broadcastTaskUpdate(taskId);

    try {
      const performerName = req.user?.username || 'Chủ dự án';
      const roleLabel = role === 'EDITOR' ? 'Quyền sửa' : 'Chỉ xem';

      // 1. Gửi thông báo cho người sửa (chủ dự án)
      await sendNotification(
        userId,
        'Cập nhật quyền thành viên',
        `Bạn đã cập nhật quyền của thành viên <b>"${updated.user.username}"</b> trong dự án <b>"${task.title}"</b> thành ${roleLabel}. (ID: ${taskId})`
      );

      // 2. Gửi thông báo cho người được sửa (nếu khác người sửa)
      if (updated.userId !== userId) {
        await sendNotification(
          updated.userId,
          'Cập nhật quyền thành viên',
          `<b>${performerName}</b> đã cập nhật quyền của bạn trong dự án <b>"${task.title}"</b> thành ${roleLabel}. (ID: ${taskId})`
        );
      }
    } catch (err) {
      console.error('Lỗi gửi thông báo cập nhật quyền thành viên:', err);
    }

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Lỗi cập nhật quyền thành viên:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const deleteTaskMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;
    const memberId = req.params.memberId as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    // Chỉ chủ dự án mới được xóa thành viên
    if (task.userId !== userId) {
      return res.status(403).json({ message: 'Chỉ chủ dự án mới có quyền xóa thành viên.' });
    }

    const member = await prisma.taskMember.findUnique({
      where: { id: memberId },
      include: { user: true }
    });

    if (!member || member.taskId !== taskId) {
      return res.status(404).json({ message: 'Không tìm thấy thành viên trong dự án này.' });
    }

    await logActivity(userId, 'REMOVE_MEMBER', `đã xóa thành viên "${member.user.username}" khỏi dự án`, taskId);

    // Xóa phân công công việc của người này
    await prisma.subtask.updateMany({
      where: {
        taskId,
        assignedUserId: member.userId
      },
      data: {
        assignedUserId: null
      }
    });

    await prisma.taskMember.delete({
      where: { id: memberId }
    });

    await broadcastTaskUpdate(taskId);

    res.status(200).json({ message: 'Đã xóa thành viên khỏi dự án thành công.' });
  } catch (error: any) {
    console.error('Lỗi xóa thành viên dự án:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const getTaskActivityLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        members: true
      }
    });

    if (!task) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    const isOwner = task.userId === userId;
    const isMember = task.members.some((m) => m.userId === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Bạn không có quyền xem nhật ký hoạt động của dự án này.' });
    }

    const logs = await prisma.activityLog.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(logs);
  } catch (error: any) {
    console.error('Lỗi lấy nhật ký hoạt động:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};
