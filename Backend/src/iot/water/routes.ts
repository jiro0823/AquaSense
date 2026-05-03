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
} from './controllers/waterController';

const router = Router();

/**
 * Water Quality Monitoring Routes
 * Base path: /api/v1/water
 */

// Readings endpoints
router.post('/readings', addReading); // Add new reading
router.get('/readings/latest', getLatestReading); // Get latest
router.get('/readings', getReadingsByTimeRange); // Get by time range
router.get('/ingest-status', getIngestStatus); // ESP32 ingest status

// Statistics endpoint
router.get('/statistics', getStatistics); // Get statistics

// Alerts endpoint
router.get('/alerts', getAlerts); // Get alerts

// Thresholds endpoints
router.get('/thresholds', getThresholds); // Get thresholds
router.put('/thresholds', updateThresholds); // Update thresholds

// Dashboard endpoint (combined data)
router.get('/dashboard', getDashboardData); // Get all dashboard data

export default router;
