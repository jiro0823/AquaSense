"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardData = exports.updateThresholds = exports.getThresholds = exports.getAlerts = exports.getStatistics = exports.getReadingsByTimeRange = exports.getLatestReading = exports.getIngestStatus = exports.addReading = void 0;
const waterQualityService_1 = require("../services/waterQualityService");
const response_1 = require("../../../utils/response");
const logger_1 = require("../../../utils/logger");
const config_1 = require("../../../config/config");
const sensorReadingService_1 = require("../../../services/sensorReadingService");
const calculateHealthScore = (temperature, ph, dissolvedOxygen, turbidity) => {
    let score = 100;
    if (temperature < 15 || temperature > 35) {
        score -= 20;
    }
    else if (temperature > 30) {
        score -= 10;
    }
    if (ph < 6.5 || ph > 8.5) {
        score -= 25;
    }
    else if (ph < 7.0 || ph > 8.0) {
        score -= 10;
    }
    if (dissolvedOxygen < 3) {
        score -= 30;
    }
    else if (dissolvedOxygen < 5) {
        score -= 15;
    }
    else if (dissolvedOxygen < 8) {
        score -= 5;
    }
    if (turbidity > 100) {
        score -= 20;
    }
    else if (turbidity > 50) {
        score -= 10;
    }
    return Math.max(0, score);
};
const mapDbStatsToWaterStats = async (minutes) => {
    const dbStats = await sensorReadingService_1.sensorReadingService.getStatistics(minutes);
    return {
        timestamp: new Date(),
        temperature: {
            current: dbStats.temperature.current,
            average: dbStats.temperature.average,
            min: dbStats.temperature.min,
            max: dbStats.temperature.max,
        },
        ph: {
            current: dbStats.ph.current,
            average: dbStats.ph.average,
            min: dbStats.ph.min,
            max: dbStats.ph.max,
        },
        do: {
            current: dbStats.do.current,
            average: dbStats.do.average,
            min: dbStats.do.min,
            max: dbStats.do.max,
        },
        turbidity: {
            current: dbStats.turbidity.current,
            average: dbStats.turbidity.average,
            min: dbStats.turbidity.min,
            max: dbStats.turbidity.max,
        },
        healthScore: calculateHealthScore(dbStats.temperature.current, dbStats.ph.current, dbStats.do.current, dbStats.turbidity.current),
    };
};
const ingestMeta = {
    lastReceivedAt: null,
    lastSourceIp: null,
    lastLocation: null,
};
/**
 * Add new water quality reading
 * POST /api/v1/water/readings
 */
const addReading = async (_req, res) => {
    try {
        const { temperature, ph, do: dissolvedOxygen, turbidity, location } = _req.body;
        // Validation
        if (temperature === undefined || ph === undefined || dissolvedOxygen === undefined || turbidity === undefined) {
            (0, response_1.sendError)(res, 400, 'Missing required parameters: temperature, ph, do, turbidity');
            return;
        }
        const reading = waterQualityService_1.waterQualityService.addReading({
            temperature: parseFloat(temperature),
            ph: parseFloat(ph),
            do: parseFloat(dissolvedOxygen),
            turbidity: parseFloat(turbidity),
            location: location || 'Unknown',
            timestamp: new Date(),
        });
        await sensorReadingService_1.sensorReadingService.addSensorReading(reading.temperature, reading.ph, reading.do, reading.turbidity, reading.location, new Date(reading.timestamp));
        ingestMeta.lastReceivedAt = new Date(reading.timestamp).toISOString();
        ingestMeta.lastSourceIp = _req.ip || null;
        ingestMeta.lastLocation = reading.location || null;
        logger_1.logger.info('[ESP32][HTTP] Reading received', {
            sourceIp: ingestMeta.lastSourceIp,
            temperature: reading.temperature,
            ph: reading.ph,
            do: reading.do,
            turbidity: reading.turbidity,
            location: ingestMeta.lastLocation,
        });
        (0, response_1.sendSuccess)(res, 201, 'Reading added successfully', reading);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to add reading', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.addReading = addReading;
/**
 * Ingest status and expected ESP32 URL
 * GET /api/v1/water/ingest-status
 */
const getIngestStatus = (_req, res) => {
    const baseUrl = `http://${config_1.config.server.host}:${config_1.config.server.port}`;
    (0, response_1.sendSuccess)(res, 200, 'Ingest status', {
        expectedPostUrl: `${baseUrl}/api/v1/water/readings`,
        lastReceivedAt: ingestMeta.lastReceivedAt,
        lastSourceIp: ingestMeta.lastSourceIp,
        lastLocation: ingestMeta.lastLocation,
    });
};
exports.getIngestStatus = getIngestStatus;
/**
 * Get latest reading
 * GET /api/v1/water/readings/latest
 */
const getLatestReading = async (_req, res) => {
    try {
        const reading = await sensorReadingService_1.sensorReadingService.getLatestReading();
        if (!reading) {
            (0, response_1.sendError)(res, 404, 'No readings available yet');
            return;
        }
        (0, response_1.sendSuccess)(res, 200, 'Latest reading retrieved', reading);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to fetch latest reading', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.getLatestReading = getLatestReading;
/**
 * Get readings within time range
 * GET /api/v1/water/readings?minutes=60
 */
const getReadingsByTimeRange = async (req, res) => {
    try {
        const minutes = parseInt(req.query.minutes) || 60;
        const readings = await sensorReadingService_1.sensorReadingService.getReadingsByTimeRange(minutes);
        if (readings.length === 0) {
            (0, response_1.sendError)(res, 404, 'No readings found for the specified time range');
            return;
        }
        (0, response_1.sendSuccess)(res, 200, `${readings.length} readings retrieved`, readings);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to fetch readings', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.getReadingsByTimeRange = getReadingsByTimeRange;
/**
 * Get statistics
 * GET /api/v1/water/statistics?minutes=60
 */
const getStatistics = async (req, res) => {
    try {
        const minutes = parseInt(req.query.minutes) || 60;
        const stats = await mapDbStatsToWaterStats(minutes);
        (0, response_1.sendSuccess)(res, 200, 'Statistics calculated', stats);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to calculate statistics', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.getStatistics = getStatistics;
/**
 * Get alerts
 * GET /api/v1/water/alerts?limit=50
 */
const getAlerts = (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const alerts = waterQualityService_1.waterQualityService.getAlerts(limit);
        (0, response_1.sendSuccess)(res, 200, 'Alerts retrieved', alerts);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to fetch alerts', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.getAlerts = getAlerts;
/**
 * Get thresholds
 * GET /api/v1/water/thresholds
 */
const getThresholds = (_req, res) => {
    try {
        const thresholds = waterQualityService_1.waterQualityService.getThresholds();
        (0, response_1.sendSuccess)(res, 200, 'Thresholds retrieved', thresholds);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to fetch thresholds', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.getThresholds = getThresholds;
/**
 * Update thresholds
 * PUT /api/v1/water/thresholds
 */
const updateThresholds = (req, res) => {
    try {
        waterQualityService_1.waterQualityService.setThresholds(req.body);
        const thresholds = waterQualityService_1.waterQualityService.getThresholds();
        (0, response_1.sendSuccess)(res, 200, 'Thresholds updated', thresholds);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to update thresholds', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.updateThresholds = updateThresholds;
/**
 * Get dashboard data (combined view)
 * GET /api/v1/water/dashboard
 */
const getDashboardData = async (_req, res) => {
    try {
        const latest = await sensorReadingService_1.sensorReadingService.getLatestReading();
        const stats = await mapDbStatsToWaterStats(60);
        const alerts = waterQualityService_1.waterQualityService.getAlerts(10);
        const thresholds = waterQualityService_1.waterQualityService.getThresholds();
        const dashboardData = {
            latest,
            stats,
            recentAlerts: alerts,
            thresholds,
            timestamp: new Date(),
        };
        (0, response_1.sendSuccess)(res, 200, 'Dashboard data retrieved', dashboardData);
    }
    catch (error) {
        (0, response_1.sendError)(res, 500, 'Failed to fetch dashboard data', error instanceof Error ? error.message : 'Unknown error');
    }
};
exports.getDashboardData = getDashboardData;
//# sourceMappingURL=waterController.js.map