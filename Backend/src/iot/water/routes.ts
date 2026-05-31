/**
 * Water Quality Routes
 * API endpoints for water monitoring
 */
import { Router } from 'express';
import {
  addReading,
  getLatestReading,
  getReadingsByTimeRange,
  getStatistics,
  getAlerts,
  getThresholds,
  updateThresholds,
  getDashboardData,
  getIngestStatus,
  getPredictiveWarning,
  getPredictionHistory,
} from './controllers/waterController';
import { validateBody, waterReadingSchema } from '../../middleware/validate';
import { authenticateDevice } from '../../middleware/deviceAuthMiddleware';
import { authenticateToken, requireRole } from '../../middleware/authMiddleware';

const router = Router();

/**
 * Water Quality Monitoring Routes
 * Base path: /api/v1/water
 */

// Readings endpoints
router.post('/readings', validateBody(waterReadingSchema), authenticateDevice, addReading); // Add new reading
router.get('/readings/latest', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getLatestReading); // Get latest
router.get('/readings', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getReadingsByTimeRange); // Get by time range
router.get('/ingest-status', authenticateToken, requireRole(['admin', 'farmer']), getIngestStatus); // ESP32 ingest status

// Statistics endpoint
router.get('/statistics', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getStatistics); // Get statistics

// Alerts endpoint
router.get('/alerts', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getAlerts); // Get alerts

// Thresholds endpoints
router.get('/thresholds', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getThresholds); // Get thresholds
router.put('/thresholds', authenticateToken, requireRole(['admin', 'farmer']), updateThresholds); // Update thresholds

// Dashboard endpoint (combined data)
router.get('/dashboard', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getDashboardData); // Get all dashboard data
router.get('/predictive-warning', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getPredictiveWarning); // Trend-based early warning card
router.get('/predictions', authenticateToken, requireRole(['admin', 'farmer', 'guest']), getPredictionHistory); // Prediction history for evidence graph

export default router;
