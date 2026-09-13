/**
 * Sensor ingestion controller - receives ESP32 payloads
 */
import { Response } from 'express';
import { sendError, sendSuccess } from '../../../utils/response';
import { logger } from '../../../utils/logger';
import { sensorReadingService } from '../../../services/sensorReadingService';
import type { DeviceAuthenticatedRequest } from '../../../middleware/deviceAuthMiddleware';
import { waterAlertNotificationService } from '../../../services/waterAlertNotification.service';

interface SensorPayload {
  deviceId?: string;
  temperature?: number;
  ph?: number;
  dissolvedOxygen?: number;
  turbidity?: number;
  ammonia?: number;
}

const parseNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

/**
 * POST /api/v1/sensors/data
 */
export const ingestSensorData = async (req: DeviceAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const payload = req.body as SensorPayload;
    const deviceId = payload.deviceId;

    if (!deviceId) {
      sendError(res, 400, 'Missing required field: deviceId');
      return;
    }

    const temperature = parseNumber(payload.temperature);
    const ph = parseNumber(payload.ph);
    const dissolvedOxygen = parseNumber(payload.dissolvedOxygen);
    const turbidity = parseNumber(payload.turbidity);
    const ammonia = parseNumber(payload.ammonia ?? 0);

    if (temperature === null || ph === null || dissolvedOxygen === null || turbidity === null || ammonia === null) {
      sendError(res, 400, 'Invalid sensor values');
      return;
    }

    await sensorReadingService.addSensorReading(
      deviceId,
      temperature,
      ph,
      dissolvedOxygen,
      turbidity,
      ammonia,
      deviceId,
      new Date()
    );

    const notificationResult = await waterAlertNotificationService.processReading({
      deviceId,
      temperature,
      ph,
      dissolvedOxygen,
      turbidity,
      ammonia,
    });

    logger.info('[ESP32] Sensor payload processed', {
      deviceId,
      alertsCreated: notificationResult.alertsCreated,
      smsSent: notificationResult.smsSentCount,
    });

    sendSuccess(res, 200, 'Sensor data processed', {
      alertsCreated: notificationResult.alertsCreated,
    });
  } catch (error) {
    logger.error('Failed to ingest sensor data', error);
    sendError(res, 500, 'Failed to process sensor data');
  }
};
