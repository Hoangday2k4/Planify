import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../services/prisma';

export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Lấy categories hệ thống (userId = null) và categories của riêng user này
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: userId }
        ]
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json(categories);
  } catch (error: any) {
    console.error('Lỗi lấy danh mục:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Tên danh mục là bắt buộc.' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        color: color || '#3b82f6',
        userId
      }
    });

    res.status(201).json(category);
  } catch (error: any) {
    console.error('Lỗi tạo danh mục:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};

export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id as string;

    const category = await prisma.category.findUnique({
      where: { id }
    });

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
    }

    if (category.userId !== userId) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa danh mục này.' });
    }

    await prisma.category.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Xóa danh mục thành công.' });
  } catch (error: any) {
    console.error('Lỗi xóa danh mục:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra trên server.' });
  }
};
