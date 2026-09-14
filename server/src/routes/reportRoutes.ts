import { Router } from 'express';
import multer from 'multer';
import {
  uploadReport,
  getUploadHistory,
  downloadSampleTemplate,
} from '../controllers/reportController';
import { requireAuth, requireRole } from '../middleware/authMiddleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

const router = Router();

// Allow 2C Team and Admin to upload reports
router.post(
  '/upload',
  requireAuth,
  requireRole(['TWO_C_TEAM', 'ADMIN']),
  upload.single('file'),
  uploadReport
);

router.get('/history', requireAuth, getUploadHistory);
router.get('/sample-template', downloadSampleTemplate);

export default router;
