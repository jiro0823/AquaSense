import { Router } from 'express';
import {
  createSchedule,
  deleteSchedule,
  deviceAck,
  deviceSync,
  getFeedingState,
  getSchedules,
  triggerManualCommand,
  updateSchedule,
} from '../controllers/feedingController';
import { authenticateDevice } from '../../../middleware/deviceAuthMiddleware';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';
import { validateBody, feedingManualSchema, feedingScheduleSchema, feedingScheduleUpdateSchema } from '../../../middleware/validate';

const router = Router();

router.get('/feeding/schedules', authenticateToken, requireRole(['admin', 'farmer']), getSchedules);
router.post('/feeding/schedules', authenticateToken, requireRole(['admin', 'farmer']), validateBody(feedingScheduleSchema), createSchedule);
router.put('/feeding/schedules/:id', authenticateToken, requireRole(['admin', 'farmer']), validateBody(feedingScheduleUpdateSchema), updateSchedule);
router.delete('/feeding/schedules/:id', authenticateToken, requireRole(['admin', 'farmer']), deleteSchedule);

router.post('/feeding/manual', authenticateToken, requireRole(['admin', 'farmer']), validateBody(feedingManualSchema), triggerManualCommand);
router.get('/feeding/state', authenticateToken, requireRole(['admin', 'farmer']), getFeedingState);

router.post('/feeding/device/sync', authenticateDevice, deviceSync);
router.post('/feeding/device/ack', authenticateDevice, deviceAck);

export default router;
