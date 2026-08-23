import { Router } from 'express';
import { getCategories, createCategory, deleteCategory } from '../controllers/categoryController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT as any, getCategories);
router.post('/', authenticateJWT as any, createCategory);
router.delete('/:id', authenticateJWT as any, deleteCategory);

export default router;
