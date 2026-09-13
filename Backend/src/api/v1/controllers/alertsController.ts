/**
 * Alerts controller - manage alerts and SMS resend
 */
import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../utils/response';
import { logger } from '../../../utils/logger';
import { alertService } from '../../../services/alert.service';
import { smsNotificationService } from '../../../services/smsNotification.service';
import { buildSmsTemplate } from '../../../services/smsTemplate.service';
import { config } from '../../../config/config';
import type { AlertStatus } from '../../../services/alert.service';
import type { AlertSeverity } from '../../../services/ruleEngine.service';

const parseLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(parsed, 200);
};

export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit);
    const status = req.query.status as AlertStatus | undefined;
    const alerts = await alertService.getAlerts(limit, status);
    sendSuccess(res, 200, 'Alerts retrieved', alerts);
  } catch (error) {
    logger.error('Failed to fetch alerts', error);
    sendError(res, 500, 'Failed to fetch alerts');
  }
};

export const getAlertById = async (req: Request, res: Response): Promise<void> => {
  try {
    const alert = await alertService.getAlertById(req.params.id);
    if (!alert) {
      sendError(res, 404, 'Alert not found');
      return;
    }

    sendSuccess(res, 200, 'Alert retrieved', alert);
  } catch (error) {
    logger.error('Failed to fetch alert', error);
    sendError(res, 500, 'Failed to fetch alert');
  }
};

export const acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await alertService.updateStatus(req.params.id, 'ACKNOWLEDGED');
    if (!updated) {
      sendError(res, 404, 'Alert not found');
      return;
    }

    sendSuccess(res, 200, 'Alert acknowledged', updated);
  } catch (error) {
    logger.error('Failed to acknowledge alert', error);
    sendError(res, 500, 'Failed to acknowledge alert');
  }
};

export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await alertService.updateStatus(req.params.id, 'RESOLVED');
    if (!updated) {
      sendError(res, 404, 'Alert not found');
      return;
    }

    sendSuccess(res, 200, 'Alert resolved', updated);
  } catch (error) {
    logger.error('Failed to resolve alert', error);
    sendError(res, 500, 'Failed to resolve alert');
  }
};

export const resendAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const alert = await alertService.getAlertById(req.params.id);
    if (!alert) {
      sendError(res, 404, 'Alert not found');
      return;
    }

    const recipient = config.farm.recipientPhone;
    if (!recipient) {
      sendError(res, 400, 'FARMER_PHONE is not configured');
      return;
    }

    const tankName = config.farm.tankName || alert.deviceId;
    const smsMessage = buildSmsTemplate({
      farmerName: config.farm.farmerName,
      farmName: config.farm.farmName,
      tankName,
      severity: alert.severity as AlertSeverity,
      problem: alert.message,
      value: alert.currentValue,
      unit: alert.unit,
      action: alert.action,
    });

    const result = await smsNotificationService.send({
      deviceId: alert.deviceId, category: 'WATER_QUALITY_ALERT', severity: alert.severity as AlertSeverity,
      recipient, message: smsMessage, alertIds: [alert.id],
    });
    if (!result) {
      sendError(res, 409, 'A notification is already pending or cooling down');
      return;
    }
    if (!result.accepted) {
      sendError(res, result.status === 'rejected' ? 422 : 502, 'Alert SMS was not confirmed sent', {
        status: result.status, details: JSON.parse(result.response),
      });
      return;
    }
    sendSuccess(res, result.success ? 200 : 202, result.success ? 'Provider reports alert SMS sent' : 'Alert SMS accepted; awaiting provider status', {
      success: result.success, status: result.status, referenceId: result.referenceId,
    });
  } catch (error) {
    logger.error('Failed to resend alert SMS', error);
    sendError(res, 500, 'Failed to resend alert');
  }
};
