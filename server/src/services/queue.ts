import prisma from './prisma';

export const createJob = async (type: string, payload: any, runAt?: Date) => {
  try {
    const job = await prisma.job.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        runAt: runAt || new Date()
      }
    });
    return job;
  } catch (error) {
    console.error('[Job Queue] Lỗi tạo job:', error);
    throw error;
  }
};
