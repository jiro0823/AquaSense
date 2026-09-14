/**
 * Water Quality Controllers
 * API endpoints for water quality monitoring
 */
import { Request, Response } from 'express';
import { parseOrp } from '../../../services/sensorValues';
import { waterQualityService } from '../services/waterQualityService';
import type { WaterQualityStats } from '../types';
import { sendSuccess, sendError } from '../../../utils/response';
import { logger } from '../../../utils/logger';
import { config } from '../../../config/config';
import { sensorReadingService } from '../../../services/sensorReadingService';
import { predictiveAnalyticsService } from '../../../services/predictiveAnalytics.service';
import { predictionLogService } from '../../../services/predictionLog.service';
import { smsLogService } from '../../../services/smsLogService';
import { alertService } from '../../../services/alert.service';
import { waterAlertNotificationService } from '../../../services/waterAlertNotification.service';

const mapDbStatsToWaterStats = async (minutes: number): Promise<WaterQualityStats> => {
  const dbStats = await sensorReadingService.getStatistics(minutes);

  return {
    timestamp: new Date(),
    orp: dbStats.orp,
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
    ammonia: {
      current: dbStats.ammonia.current,
      average: dbStats.ammonia.average,
      min: dbStats.ammonia.min,
      max: dbStats.ammonia.max,
    },
    healthScore: dbStats.healthScore,
  };
};

type IngestMeta = {
  lastReceivedAt: string | null;
  lastSourceIp: string | null;
  lastLocation: string | null;
};

const ingestMeta: IngestMeta = {
  lastReceivedAt: null,
  lastSourceIp: null,
  lastLocation: null,
};

/**
 * Add new water quality reading
 * POST /api/v1/water/readings
 */
export const addReading = async (req: Request, res: Response): Promise<void> => {
  try {
<<<<<<< Updated upstream
    const { deviceId, temperature, ph, do: dissolvedOxygen, turbidity, location, ammonia } = req.body;

    if (temperature === undefined || ph === undefined || dissolvedOxygen === undefined || turbidity === undefined) {
      sendError(res, 400, 'Missing required parameters: temperature, ph, do, turbidity');
      return;
    }

    const tempValue = parseFloat(temperature);
    const phValue = parseFloat(ph);
    const doValue = parseFloat(dissolvedOxygen);
    const turbidityValue = parseFloat(turbidity);
    const ammoniaValue = ammonia !== undefined ? parseFloat(ammonia) : 0;

    if (
      !Number.isFinite(tempValue) ||
      !Number.isFinite(phValue) ||
      !Number.isFinite(doValue) ||
      !Number.isFinite(turbidityValue) ||
      !Number.isFinite(ammoniaValue)
    ) {
      sendError(res, 400, 'Invalid sensor values');
      return;
    }

    const stored = await sensorReadingService.addSensorReading(
      deviceId || 'unknown-device',
      tempValue,
      phValue,
      doValue,
      turbidityValue,
      ammoniaValue,
      location || 'Unknown',
      new Date(),
      true,
      parseOrp(req.body.orp)
    );
    const reading = stored || {
      temperature: tempValue,
      ph: phValue,
      do: doValue,
      turbidity: turbidityValue,
      ammonia: ammoniaValue,
      location: location || 'Unknown',
      timestamp: new Date(),
    };

=======
    const deviceId = req.body.deviceId || 'unknown-device';
    const reading = await sensorReadingService.ingest(deviceId, req.body);
>>>>>>> Stashed changes
    ingestMeta.lastReceivedAt = new Date(reading.timestamp).toISOString();
    ingestMeta.lastSourceIp = req.ip || null;
    ingestMeta.lastLocation = reading.location || null;

    logger.info('[ESP32][HTTP] Reading received', {
      sourceIp: ingestMeta.lastSourceIp,
      temperature: reading.temperature,
      ph: reading.ph,
      do: reading.do,
      turbidity: reading.turbidity,
      ammonia: reading.ammonia,
      location: ingestMeta.lastLocation,
    });

    await waterAlertNotificationService.processReading({ ...reading, dissolvedOxygen: reading.do, dissolvedOxygenMeasured: reading.doMeasured });

    sendSuccess(res, 201, 'Reading added successfully', reading);
  } catch (error) {
    sendError(res, 500, 'Failed to add reading', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const getIngestStatus = (_req: Request, res: Response): void => {
  const baseUrl = `http://${config.server.host}:${config.server.port}`;
  sendSuccess(res, 200, 'Ingest status', {
    expectedPostUrl: `${baseUrl}/api/v1/water/readings`,
    lastReceivedAt: ingestMeta.lastReceivedAt,
    lastSourceIp: ingestMeta.lastSourceIp,
    lastLocation: ingestMeta.lastLocation,
  });
};

export const getLatestReading = async (_req: Request, res: Response): Promise<void> => {
  try {
    const reading = await sensorReadingService.getLatestReading();
    if (!reading) {
      sendError(res, 404, 'No readings available yet');
      return;
    }
    sendSuccess(res, 200, 'Latest reading retrieved', reading);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch latest reading', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const getReadingsByTimeRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const minutes = parseInt(req.query.minutes as string, 10) || 60;
    const readings = await sensorReadingService.getReadingsByTimeRange(minutes);
    if (readings.length === 0) {
      sendError(res, 404, 'No readings found for the specified time range');
      return;
    }
    sendSuccess(res, 200, `${readings.length} readings retrieved`, readings);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch readings', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const getStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const minutes = parseInt(req.query.minutes as string, 10) || 60;
    const stats = await mapDbStatsToWaterStats(minutes);
    sendSuccess(res, 200, 'Statistics calculated', stats);
  } catch (error) {
    sendError(res, 500, 'Failed to calculate statistics', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const getAlerts = (req: Request, res: Response): void => {
  void (async () => {
    try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const alerts = await alertService.getAlerts(limit);
    sendSuccess(res, 200, 'Alerts retrieved', alerts);
    } catch (error) {
    sendError(res, 500, 'Failed to fetch alerts', error instanceof Error ? error.message : 'Unknown error');
    }
  })();
};

export const getThresholds = (_req: Request, res: Response): void => {
  try {
    const thresholds = waterQualityService.getThresholds();
    sendSuccess(res, 200, 'Thresholds retrieved', thresholds);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch thresholds', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const updateThresholds = (req: Request, res: Response): void => {
  try {
    waterQualityService.setThresholds(req.body);
    const thresholds = waterQualityService.getThresholds();
    sendSuccess(res, 200, 'Thresholds updated', thresholds);
  } catch (error) {
    sendError(res, 500, 'Failed to update thresholds', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const getDashboardData = async (_req: Request, res: Response): Promise<void> => {
  try {
    const latest = await sensorReadingService.getLatestReading();
    const stats = await mapDbStatsToWaterStats(60);
    const alerts = await alertService.getAlerts(10);
    const thresholds = waterQualityService.getThresholds();
    const predictive = await predictiveAnalyticsService.getWarningCard(60);
    const predictionHistory = await predictionLogService.getRecentLogs(30);
    const smsLogs = await smsLogService.getRecentLogs(15);

    const dashboardData = {
      latest,
      stats,
      recentAlerts: alerts,
      thresholds,
      predictiveWarning: predictive,
      predictionHistory,
      smsLogs,
      timestamp: new Date(),
    };

    sendSuccess(res, 200, 'Dashboard data retrieved', dashboardData);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch dashboard data', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const getPredictiveWarning = async (req: Request, res: Response): Promise<void> => {
  try {
    const minutes = parseInt(req.query.minutes as string, 10) || 60;
    const predictiveWarning = await predictiveAnalyticsService.getWarningCard(minutes);
    sendSuccess(res, 200, 'Predictive warning generated', predictiveWarning);
  } catch (error) {
    sendError(res, 500, 'Failed to generate predictive warning', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const getPredictionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 60;
    const logs = await predictionLogService.getRecentLogs(limit);
    sendSuccess(res, 200, 'Prediction history retrieved', logs);
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve prediction history', error instanceof Error ? error.message : 'Unknown error');
  }
};
