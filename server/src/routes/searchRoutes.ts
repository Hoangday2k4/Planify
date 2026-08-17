import { Router } from 'express';
import { globalSearch } from '../controllers/searchController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.get('/', authenticateJWT as any, globalSearch);

export default router;
