/**
 * Water Quality Controllers
 * API endpoints for water quality monitoring
 */
import { Request, Response } from 'express';
import { waterQualityService } from '../services/waterQualityService';
import { sendSuccess, sendError } from '../../../utils/response';

/**
 * Add new water quality reading
 * POST /api/v1/water/readings
 */
export const addReading = (_req: Request, res: Response): void => {
  try {
    const { temperature, ph, do: dissolvedOxygen, turbidity, location } = _req.body;

    // Validation
    if (temperature === undefined || ph === undefined || dissolvedOxygen === undefined || turbidity === undefined) {
      sendError(res, 400, 'Missing required parameters: temperature, ph, do, turbidity');
      return;
    }

    const reading = waterQualityService.addReading({
      temperature: parseFloat(temperature),
      ph: parseFloat(ph),
      do: parseFloat(dissolvedOxygen),
      turbidity: parseFloat(turbidity),
      location: location || 'Unknown',
      timestamp: new Date(),
    });

    sendSuccess(res, 201, 'Reading added successfully', reading);
  } catch (error) {
    sendError(res, 500, 'Failed to add reading', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Get latest reading
 * GET /api/v1/water/readings/latest
 */
export const getLatestReading = (_req: Request, res: Response): void => {
  try {
    const reading = waterQualityService.getLatestReading();

    if (!reading) {
      sendError(res, 404, 'No readings available yet');
      return;
    }

    sendSuccess(res, 200, 'Latest reading retrieved', reading);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch latest reading', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Get readings within time range
 * GET /api/v1/water/readings?minutes=60
 */
export const getReadingsByTimeRange = (req: Request, res: Response): void => {
  try {
    const minutes = parseInt(req.query.minutes as string) || 60;
    const readings = waterQualityService.getReadingsByTimeRange(minutes);

    if (readings.length === 0) {
      sendError(res, 404, 'No readings found for the specified time range');
      return;
    }

    sendSuccess(res, 200, `${readings.length} readings retrieved`, readings);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch readings', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Get statistics
 * GET /api/v1/water/statistics?minutes=60
 */
export const getStatistics = (req: Request, res: Response): void => {
  try {
    const minutes = parseInt(req.query.minutes as string) || 60;
    const stats = waterQualityService.getStatistics(minutes);

    sendSuccess(res, 200, 'Statistics calculated', stats);
  } catch (error) {
    sendError(res, 500, 'Failed to calculate statistics', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Get alerts
 * GET /api/v1/water/alerts?limit=50
 */
export const getAlerts = (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = waterQualityService.getAlerts(limit);

    sendSuccess(res, 200, 'Alerts retrieved', alerts);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch alerts', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Get thresholds
 * GET /api/v1/water/thresholds
 */
export const getThresholds = (_req: Request, res: Response): void => {
  try {
    const thresholds = waterQualityService.getThresholds();
    sendSuccess(res, 200, 'Thresholds retrieved', thresholds);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch thresholds', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Update thresholds
 * PUT /api/v1/water/thresholds
 */
export const updateThresholds = (req: Request, res: Response): void => {
  try {
    waterQualityService.setThresholds(req.body);
    const thresholds = waterQualityService.getThresholds();

    sendSuccess(res, 200, 'Thresholds updated', thresholds);
  } catch (error) {
    sendError(res, 500, 'Failed to update thresholds', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Get dashboard data (combined view)
 * GET /api/v1/water/dashboard
 */
export const getDashboardData = (_req: Request, res: Response): void => {
  try {
    const latest = waterQualityService.getLatestReading();
    const stats = waterQualityService.getStatistics(60);
    const alerts = waterQualityService.getAlerts(10);
    const thresholds = waterQualityService.getThresholds();

    const dashboardData = {
      latest,
      stats,
      recentAlerts: alerts,
      thresholds,
      timestamp: new Date(),
    };

    sendSuccess(res, 200, 'Dashboard data retrieved', dashboardData);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch dashboard data', error instanceof Error ? error.message : 'Unknown error');
  }
};
