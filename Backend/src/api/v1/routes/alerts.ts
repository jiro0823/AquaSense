/**
 * Alert management routes
 */
import { Router } from 'express';
import {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  resendAlert,
} from '../controllers/alertsController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';

const router = Router();

router.get('/alerts', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getAlerts);
router.get('/alerts/:id', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getAlertById);
router.post('/alerts/:id/ack', authenticateToken, requireRole(['admin', 'farmer']), acknowledgeAlert);
router.patch('/alerts/:id/resolve', authenticateToken, requireRole(['admin', 'farmer']), resolveAlert);
router.post('/alerts/:id/resend', authenticateToken, requireRole(['admin', 'farmer']), resendAlert);

export default router;
