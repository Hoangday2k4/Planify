import { Router } from 'express';
import { getNotifications, markAsRead, clearReadNotifications } from '../controllers/notificationController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT as any);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.delete('/read', clearReadNotifications);

export default router;
