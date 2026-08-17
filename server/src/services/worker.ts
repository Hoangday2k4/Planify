import prisma from './prisma';
import { sendEmail } from './mail';

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export const processJobs = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    
    // Tìm các job cần chạy: PENDING hoặc FAILED nhưng chưa quá số lần thử tối đa và đã đến giờ chạy
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'FAILED' }
        ],
        attempts: { lt: prisma.job.fields.maxAttempts },
        runAt: { lte: now }
      },
      orderBy: { createdAt: 'asc' },
      take: 5 // Mỗi lần quét chỉ lấy tối đa 5 job để tránh quá tải
    });

    for (const job of jobs) {
      try {
        // Cập nhật trạng thái sang PROCESSING để khóa job
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'PROCESSING',
            attempts: job.attempts + 1
          }
        });

        // Thực thi job dựa trên loại
        if (job.type === 'SEND_EMAIL') {
          const { to, subject, text, html } = JSON.parse(job.payload);
          await sendEmail(to, subject, text, html);
        }

        // Cập nhật trạng thái thành công
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            error: null
          }
        });
      } catch (err: any) {
        console.error(`[Job Worker] Lỗi thực thi Job ${job.id}:`, err);
        
        // Cập nhật trạng thái thất bại
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: err.message || String(err)
          }
        });
      }
    }
  } catch (error) {
    console.error('[Job Worker] Gặp lỗi khi quét hàng đợi công việc:', error);
  } finally {
    isProcessing = false;
  }
};

export const startBackgroundWorker = () => {
  if (workerInterval) return;

  console.log('[Job Worker] Đã khởi chạy hàng đợi công việc chạy ngầm (PostgreSQL Queue).');
  // Chạy quét mỗi 10 giây
  workerInterval = setInterval(processJobs, 10000);
};

export const stopBackgroundWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Job Worker] Đã dừng hàng đợi công việc chạy ngầm.');
  }
};
