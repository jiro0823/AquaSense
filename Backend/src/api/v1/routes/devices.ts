import { Router } from 'express';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';
import { validateBody, registerDeviceSchema } from '../../../middleware/validate';
import { deactivateDevice, listDevices, registerDevice } from '../controllers/deviceController';

const router = Router();

router.get('/devices', authenticateToken, requireRole(['admin', 'farmer']), listDevices);
router.post('/devices', authenticateToken, requireRole(['admin', 'farmer']), validateBody(registerDeviceSchema), registerDevice);
router.patch('/devices/:deviceId/deactivate', authenticateToken, requireRole(['admin', 'farmer']), deactivateDevice);

export default router;
