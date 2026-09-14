import { Router } from 'express';
import { googleLogin, devLogin, getMe } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/google', googleLogin);
router.post('/dev-login', devLogin);
router.get('/me', requireAuth, getMe);

export default router;
