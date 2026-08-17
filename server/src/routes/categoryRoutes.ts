import { Router } from 'express';
import { getCategories, createCategory } from '../controllers/categoryController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT as any, getCategories);
router.post('/', authenticateJWT as any, createCategory);

export default router;
