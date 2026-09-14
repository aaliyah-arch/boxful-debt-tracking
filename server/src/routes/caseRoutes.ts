import { Router } from 'express';
import {
  listCases,
  getCase,
  update2C,
  updateFA,
  closeCase,
  exportCases,
} from '../controllers/caseController';
import { requireAuth, requireRole } from '../middleware/authMiddleware';

const router = Router();

router.get('/', requireAuth, listCases);
router.get('/export', requireAuth, exportCases);
router.get('/:id', requireAuth, getCase);

// 2C update
router.patch('/:id/2c', requireAuth, requireRole(['TWO_C_TEAM', 'ADMIN']), update2C);

// FA update
router.patch('/:id/fa', requireAuth, requireRole(['FA_TEAM', 'ADMIN']), updateFA);

// Close / Reopen case (2C, FA, Admin)
router.patch('/:id/close', requireAuth, requireRole(['TWO_C_TEAM', 'FA_TEAM', 'ADMIN']), closeCase);

export default router;
