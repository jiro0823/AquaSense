import { Response } from 'express';
import { sendError, sendSuccess } from '../../../utils/response';
import { feedingService } from '../../../services/feedingService';
import { DeviceStopPendingError } from '../../../services/hardwareControlLock';
import { logger } from '../../../utils/logger';
import type { FeedingCommandAction } from '../../../database/models/FeedingCommand';
import type { AuthenticatedRequest } from '../../../middleware/authMiddleware';
import { deviceService } from '../../../services/device.service';
import type { DeviceAuthenticatedRequest } from '../../../middleware/deviceAuthMiddleware';
import { auditLogService } from '../../../services/auditLog.service';
import { mqttService } from '../../../services/mqttService';
import { config } from '../../../config/config';
import { ackCanonical, verifyCanonical, type SignedHardwareAck } from '../../../services/hardwareProtocol';
import { hardwareService } from '../../../services/hardwareService';

const DEFAULT_DEVICE_ID = config.feeding.deviceId;
const FEEDING_TIMEZONE = config.feeding.timezone;

const parseAction = (raw: unknown): FeedingCommandAction | null => {
  if (typeof raw !== 'string') return null;
  const normalized = raw.toUpperCase();
  if (normalized === 'ON' || normalized === 'OFF' || normalized === 'TRIGGER') {
    return normalized;
  }
  return null;
};

export const getSchedules = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    const schedules = await feedingService.listSchedules(req.userId);
    sendSuccess(res, 200, 'Feeding schedules retrieved', schedules);
  } catch (error) {
    logger.error('Failed to list feeding schedules', error);
    sendError(res, 500, 'Failed to list feeding schedules');
  }
};

export const createSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    const { date, time, enabled, label } = req.body as { date?: string; time?: string; enabled?: boolean; label?: string };
    if (!time) {
      sendError(res, 400, 'time is required (HH:mm)');
      return;
    }
    const schedule = await feedingService.createSchedule({ userId: req.userId, date: date || null, time, enabled, label });
    sendSuccess(res, 201, 'Feeding schedule created', schedule);
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : 'Invalid schedule input');
  }
};

export const updateSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    const updated = await feedingService.updateSchedule(req.params.id, { ...req.body, userId: req.userId });
    if (!updated) {
      sendError(res, 404, 'Feeding schedule not found');
      return;
    }
    sendSuccess(res, 200, 'Feeding schedule updated', updated);
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : 'Invalid schedule input');
  }
};

export const deleteSchedule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    const deleted = await feedingService.deleteSchedule(req.params.id, req.userId);
    if (!deleted) {
      sendError(res, 404, 'Feeding schedule not found');
      return;
    }
    sendSuccess(res, 200, 'Feeding schedule deleted');
  } catch (error) {
    logger.error('Failed to delete feeding schedule', error);
    sendError(res, 500, 'Failed to delete feeding schedule');
  }
};

export const triggerManualCommand = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!config.mqtt.actuatorCommandsEnabled) {
      sendError(res, 503, 'Actuator commands are disabled in this MQTT profile');
      return;
    }
    if (!req.userId) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    const action = parseAction(req.body?.action);
    const deviceId = req.body?.deviceId || DEFAULT_DEVICE_ID;
    if (!action) {
      sendError(res, 400, 'action is required and must be ON, OFF, or TRIGGER');
      return;
    }
    const ownsDevice = await deviceService.verifyOwnership(req.userId, deviceId);
    if (!ownsDevice) {
      sendError(res, 403, 'Device does not belong to authenticated user');
      return;
    }
    const command = await feedingService.queueManualCommand(req.userId, deviceId, action, {
      requestedBy: 'dashboard',
      requestedAt: new Date().toISOString(),
    });
    const published = await mqttService.dispatchHardwareCommand({ id: command.id, deviceId, source: 'feeding', action,
      expiresAt: new Date(command.createdAt.getTime() + 120_000) });
    await auditLogService.createLog({
      userId: req.userId,
      deviceId,
      action: 'FEEDING_MANUAL_COMMAND',
      status: 'SUCCESS',
      ipAddress: req.ip,
      metadata: { action, commandId: command.id },
    });
    sendSuccess(res, 202, 'Manual feed command queued; awaiting device acknowledgment',
      { commandId: command.id, status: 'PENDING_DEVICE_ACK', published });
  } catch (error) {
    if (error instanceof DeviceStopPendingError) {
      sendError(res, 409, error.message);
      return;
    }
    logger.error('Failed to queue manual feeding command', error);
    sendError(res, 500, 'Failed to queue manual feeding command');
  }
};

export const getFeedingState = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      sendError(res, 401, 'Unauthorized');
      return;
    }
    const deviceId = (req.query.deviceId as string) || DEFAULT_DEVICE_ID;
    const ownsDevice = await deviceService.verifyOwnership(req.userId, deviceId);
    if (!ownsDevice) {
      sendError(res, 403, 'Device does not belong to authenticated user');
      return;
    }
    const state = await feedingService.getState(req.userId, deviceId);
    sendSuccess(res, 200, 'Feeding state retrieved', state);
  } catch (error) {
    logger.error('Failed to get feeding state', error);
    sendError(res, 500, 'Failed to get feeding state');
  }
};

export const deviceSync = async (req: DeviceAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId || (req.body?.deviceId as string | undefined);
    const ownerUserId = req.deviceOwnerUserId;
    if (!deviceId || !ownerUserId) {
      sendError(res, 403, 'Device is not authorized for sync');
      return;
    }

    const schedules = await feedingService.listSchedules(ownerUserId);

    sendSuccess(res, 200, 'Feeding config synced', {
      timezone: FEEDING_TIMEZONE,
      ntpServers: ['pool.ntp.org', 'time.nist.gov', 'asia.pool.ntp.org'],
      schedules: schedules.filter((item) => item.enabled).map((item) => ({
        id: item.id,
        date: item.date,
        time: item.time,
        label: item.label,
      })),
      serverTimeIso: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to sync feeding config for device', error);
    sendError(res, 500, 'Failed to sync feeding config');
  }
};

export const deviceAck = async (req: DeviceAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ack = req.body as SignedHardwareAck;
    const authDeviceId = req.deviceId;
    const ownerUserId = req.deviceOwnerUserId;
    if (!authDeviceId || !ownerUserId) {
      sendError(res, 403, 'Device is not authorized for acknowledge');
      return;
    }
    if (ack.deviceId !== authDeviceId || ack.source !== 'feeding') {
      sendError(res, 403, 'deviceId mismatch for authenticated device');
      return;
    }
    const key = Object.prototype.hasOwnProperty.call(config.device.keys, authDeviceId)
      ? config.device.keys[authDeviceId] : undefined;
    if (!key || !verifyCanonical(ackCanonical(ack), ack.signature, key)) {
      sendError(res, 401, 'Invalid device acknowledgment signature');
      return;
    }
    const accepted = await hardwareService.acceptMqttAck(ownerUserId, ack);
    if (!accepted) {
      sendError(res, 409, 'Acknowledgment does not match a pending, unexpired feeding command');
      return;
    }
    await auditLogService.createLog({
      userId: ownerUserId,
      deviceId: authDeviceId,
      action: 'FEEDING_DEVICE_ACK',
      status: 'SUCCESS',
      ipAddress: req.ip,
      metadata: { commandId: ack.id, result: ack.result },
    });
    sendSuccess(res, 200, 'Command acknowledged');
  } catch (error) {
    logger.error('Failed to acknowledge feeding command', error);
    sendError(res, 500, 'Failed to acknowledge command');
  }
};
