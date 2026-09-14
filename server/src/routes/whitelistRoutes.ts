import { Router } from 'express';
import {
  listWhitelist,
  createWhitelist,
  updateWhitelist,
  deleteWhitelist,
  syncWhitelist,
} from '../controllers/whitelistController';
import { requireAuth, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Whitelist management
router.get('/', requireAuth, requireRole(['ADMIN']), listWhitelist);
router.post('/', requireAuth, requireRole(['ADMIN']), createWhitelist);
router.patch('/:id', requireAuth, requireRole(['ADMIN']), updateWhitelist);
router.delete('/:id', requireAuth, requireRole(['ADMIN']), deleteWhitelist);

// Google Sheet / Apps Script Sync (Authorized via ADMIN JWT or x-sync-secret header)
router.post('/sync', syncWhitelist);

export default router;
