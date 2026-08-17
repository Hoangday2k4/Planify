import { Router } from 'express';
import { getTags, createTag, deleteTag } from '../controllers/tagController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT as any, getTags);
router.post('/', authenticateJWT as any, createTag);
router.delete('/:id', authenticateJWT as any, deleteTag);

export default router;
