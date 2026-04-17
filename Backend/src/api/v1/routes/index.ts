import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import waterQualityRoutes from '../../../iot/water/routes';

const router = Router();

/**
 * API v1 routes
 * All routes are prefixed with /api/v1
 */

// Health check routes
router.use(healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// Water Quality IoT routes
router.use('/water', waterQualityRoutes);

// Add more route modules here as needed:
// router.use(userRoutes);
// router.use(productRoutes);

export default router;
