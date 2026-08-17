import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';

export const getTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' }
    });

    res.status(200).json(tags);
  } catch (error: any) {
    console.error('Lỗi lấy nhãn dán:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const createTag = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tên nhãn dán là bắt buộc.' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Không được phép.' });
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || '#3b82f6',
        userId
      }
    });

    res.status(201).json(tag);
  } catch (error: any) {
    console.error('Lỗi tạo nhãn dán:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const deleteTag = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    const tag = await prisma.tag.findFirst({
      where: { id, userId }
    });

    if (!tag) {
      return res.status(404).json({ message: 'Không tìm thấy nhãn dán.' });
    }

    await prisma.tag.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Xóa nhãn dán thành công.' });
  } catch (error: any) {
    console.error('Lỗi xóa nhãn dán:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};
