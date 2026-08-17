import prisma from '../src/services/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Start seeding...');

  // Xóa sạch dữ liệu cũ
  await prisma.subtask.deleteMany({});
  await prisma.reminder.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});

  // Cài đặt mật khẩu mã hóa
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Tạo User mẫu
  const user1 = await prisma.user.create({
    data: {
      username: 'hoang',
      email: 'hoang@example.com',
      password: hashedPassword,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      phone: '0912345678',
      role: 'USER',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('Created Users:', { user1: user1.username, admin: adminUser.username });

  // Tạo Categories mặc định
  const catWork = await prisma.category.create({
    data: { name: 'Công việc', color: '#ef4444' }, // Red
  });

  const catStudy = await prisma.category.create({
    data: { name: 'Học tập', color: '#3b82f6' }, // Blue
  });

  const catPersonal = await prisma.category.create({
    data: { name: 'Cá nhân', color: '#10b981' }, // Green
  });

  const catFamily = await prisma.category.create({
    data: { name: 'Gia đình', color: '#f59e0b' }, // Orange
  });

  console.log('Created Categories');

  // Tạo Events mẫu cho user1
  const today = new Date();
  
  // Sự kiện họp 9:00 hôm nay
  const event1Start = new Date(today);
  event1Start.setHours(9, 0, 0, 0);
  const event1End = new Date(today);
  event1End.setHours(10, 0, 0, 0);

  const event1 = await prisma.event.create({
    data: {
      userId: user1.id,
      title: 'Họp với nhóm dự án',
      description: 'Review tiến độ API backend và thiết kế UI frontend',
      startTime: event1Start,
      endTime: event1End,
      location: 'Phòng họp 1 / Zoom',
      priority: 'HIGH',
      categoryId: catWork.id,
      color: catWork.color,
      status: 'CONFIRMED',
    },
  });

  // Sự kiện học AI 18:00 hôm nay
  const event2Start = new Date(today);
  event2Start.setHours(18, 0, 0, 0);
  const event2End = new Date(today);
  event2End.setHours(20, 0, 0, 0);

  const event2 = await prisma.event.create({
    data: {
      userId: user1.id,
      title: 'Học AI nâng cao',
      description: 'Học về Prompt Engineering và LLM Agent',
      startTime: event2Start,
      endTime: event2End,
      location: 'Online (Coursera)',
      priority: 'MEDIUM',
      categoryId: catStudy.id,
      color: catStudy.color,
      status: 'CONFIRMED',
    },
  });

  // Tạo Reminder cho sự kiện
  await prisma.reminder.create({
    data: {
      eventId: event1.id,
      minutesBefore: 15,
      type: 'NOTIFICATION',
    },
  });

  await prisma.reminder.create({
    data: {
      eventId: event2.id,
      minutesBefore: 30,
      type: 'EMAIL',
    },
  });

  console.log('Created Events and Reminders');

  // Tạo Tasks mẫu cho user1
  const task1 = await prisma.task.create({
    data: {
      userId: user1.id,
      title: 'Đồ án Web Quản lý Lập lịch',
      description: 'Hoàn thiện đồ án môn học Công nghệ Web',
      deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // Hạn trong 5 ngày tới
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      progress: 50,
      categoryId: catStudy.id,
    },
  });

  // Subtasks cho task1
  await prisma.subtask.createMany({
    data: [
      { taskId: task1.id, title: 'Database design', isCompleted: true },
      { taskId: task1.id, title: 'Build REST APIs', isCompleted: true },
      { taskId: task1.id, title: 'Frontend UI Implementation', isCompleted: false },
      { taskId: task1.id, title: 'Testing & Bug fixing', isCompleted: false },
    ],
  });

  const task2 = await prisma.task.create({
    data: {
      userId: user1.id,
      title: 'Báo cáo môn CNPM',
      description: 'Làm slide thuyết trình và file báo cáo PDF',
      deadline: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Hạn ngày mai
      priority: 'HIGH',
      status: 'PENDING',
      progress: 0,
      categoryId: catStudy.id,
    },
  });

  await prisma.subtask.create({
    data: { taskId: task2.id, title: 'Viết nội dung chương 1 và 2', isCompleted: false },
  });

  console.log('Created Tasks and Subtasks');

  // Tạo Notification mẫu cho user1
  await prisma.notification.createMany({
    data: [
      {
        userId: user1.id,
        title: 'Hệ thống',
        content: 'Chào mừng bạn đã tham gia ứng dụng Quản lý Lập lịch!',
        isRead: false,
      },
      {
        userId: user1.id,
        title: 'Nhắc nhở công việc',
        content: 'Deadline "Báo cáo môn CNPM" đang cận kề (còn 1 ngày).',
        isRead: false,
      },
    ],
  });

  console.log('Created Notifications');
  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
