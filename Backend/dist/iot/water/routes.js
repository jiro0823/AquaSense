"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Water Quality Routes
 * API endpoints for water monitoring
 */
const express_1 = require("express");
const waterController_1 = require("./controllers/waterController");
const router = (0, express_1.Router)();
/**
 * Water Quality Monitoring Routes
 * Base path: /api/v1/water
 */
// Readings endpoints
router.post('/readings', waterController_1.addReading); // Add new reading
router.get('/readings/latest', waterController_1.getLatestReading); // Get latest
router.get('/readings', waterController_1.getReadingsByTimeRange); // Get by time range
router.get('/ingest-status', waterController_1.getIngestStatus); // ESP32 ingest status
// Statistics endpoint
router.get('/statistics', waterController_1.getStatistics); // Get statistics
// Alerts endpoint
router.get('/alerts', waterController_1.getAlerts); // Get alerts
// Thresholds endpoints
router.get('/thresholds', waterController_1.getThresholds); // Get thresholds
router.put('/thresholds', waterController_1.updateThresholds); // Update thresholds
// Dashboard endpoint (combined data)
router.get('/dashboard', waterController_1.getDashboardData); // Get all dashboard data
exports.default = router;
//# sourceMappingURL=routes.js.map