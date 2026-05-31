/**
 * Alerts controller - manage alerts and SMS resend
 */
import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../utils/response';
import { logger } from '../../../utils/logger';
import { alertService } from '../../../services/alert.service';
import { smsService } from '../../../services/sms.service';
import { smsLogService } from '../../../services/smsLogService';
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

    const sendResult = await smsService.sendSms(recipient, smsMessage);
    const sentAt = new Date();

    await smsLogService.createLog({
      alertId: alert.id,
      deviceId: alert.deviceId,
      category: alert.category,
      severity: alert.severity,
      recipient,
      provider: config.sms.provider,
      providerResponse: sendResult.response,
      success: sendResult.success,
      retryCount: sendResult.retryCount,
      sentAt,
    });

    if (sendResult.success) {
      await alertService.markSmsSent(alert.id, sentAt);
    }

    sendSuccess(res, 200, 'Alert resent', {
      success: sendResult.success,
    });
  } catch (error) {
    logger.error('Failed to resend alert SMS', error);
    sendError(res, 500, 'Failed to resend alert');
  }
};
