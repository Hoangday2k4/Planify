import { Router } from 'express';
import { register, login, getMe, updateProfile, changePassword, toggleShareToken, forgotPassword, uploadAvatar } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimiter';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.get('/me', authenticateJWT as any, getMe);
router.put('/profile', authenticateJWT as any, updateProfile);
router.post('/upload-avatar', authenticateJWT as any, upload.single('avatar'), uploadAvatar);
router.put('/profile/share-token', authenticateJWT as any, toggleShareToken);
router.put('/change-password', authenticateJWT as any, authRateLimiter, changePassword);

export default router;
