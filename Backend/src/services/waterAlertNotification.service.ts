import { alertService } from './alert.service';
import { cooldownService } from './cooldown.service';
import { predictiveAnalyticsService } from './predictiveAnalytics.service';
import { ruleEngine, type AlertSeverity, type RuleAlertResult } from './ruleEngine.service';
import { smsService } from './sms.service';
import { smsLogService } from './smsLogService';
import { buildCombinedAlertSmsTemplate, buildPredictiveSmsTemplate } from './smsTemplate.service';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export interface WaterAlertNotificationInput {
  deviceId: string;
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  turbidity: number;
  ammonia?: number;
}

export interface WaterAlertNotificationResult {
  alertsCreated: number;
  smsSentCount: number;
}

const shouldSendSmsForSeverity = (severity: AlertSeverity): boolean => {
  return severity === 'CRITICAL' || severity === 'EMERGENCY';
};

const severityRank: Record<AlertSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
  EMERGENCY: 3,
};

const selectHighestSeverity = (alerts: RuleAlertResult[]): AlertSeverity => {
  return alerts.reduce<AlertSeverity>(
    (highest, alert) => (severityRank[alert.severity] > severityRank[highest] ? alert.severity : highest),
    'INFO'
  );
};

const selectPrimaryAction = (alerts: RuleAlertResult[]): string => {
  const priority = ['AERATOR_ON_IMMEDIATE', 'WATER_CHANGE', 'WATER_REPLACEMENT', 'AERATOR_ON'];
  return priority.find((action) => alerts.some((alert) => alert.action === action)) || alerts[0]?.action || 'DASHBOARD_ONLY';
};

class WaterAlertNotificationService {
  async processReading(input: WaterAlertNotificationInput): Promise<WaterAlertNotificationResult> {
    const alerts = ruleEngine(input);
    let alertsCreated = 0;
    let smsSentCount = 0;
    let triggeredAlertId: string | undefined;
    const smsCandidates: Array<{ alertId: string; alert: RuleAlertResult }> = [];

    for (const alert of alerts) {
      const created = await alertService.createAlert({
        deviceId: input.deviceId,
        category: alert.category,
        severity: alert.severity,
        currentValue: alert.currentValue,
        thresholdValue: alert.thresholdValue,
        unit: alert.unit,
        action: alert.action,
        message: alert.message,
      });

      alertsCreated += 1;
      triggeredAlertId = created.id;

      if (!shouldSendSmsForSeverity(alert.severity)) {
        continue;
      }

      smsCandidates.push({ alertId: created.id, alert });
    }

    if (smsCandidates.length > 0) {
      const sent = await this.sendCombinedRuleAlertSms(input.deviceId, smsCandidates);
      if (sent) {
        smsSentCount += 1;
      }
    }

    const predictive = await predictiveAnalyticsService.persistCurrentPrediction(60, triggeredAlertId);
    const predictiveRiskLevel = predictive.warningCard.riskLevel;
    if (smsCandidates.length === 0 && (predictiveRiskLevel === 'HIGH' || predictiveRiskLevel === 'CRITICAL')) {
      const sent = await this.sendPredictiveSms(input.deviceId, {
        riskLevel: predictiveRiskLevel,
        cause: predictive.warningCard.cause,
        estimatedUnsafeInMinutes: predictive.warningCard.estimatedUnsafeInMinutes,
      });
      if (sent) {
        smsSentCount += 1;
      }
    }

    return {
      alertsCreated,
      smsSentCount,
    };
  }

  async processPredictiveWarning(
    deviceId: string,
    warningCard: {
      riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
      cause: string;
      estimatedUnsafeInMinutes: number | null;
    }
  ): Promise<boolean> {
    if (warningCard.riskLevel !== 'HIGH' && warningCard.riskLevel !== 'CRITICAL') {
      return false;
    }

    return this.sendPredictiveSms(deviceId, {
      riskLevel: warningCard.riskLevel,
      cause: warningCard.cause,
      estimatedUnsafeInMinutes: warningCard.estimatedUnsafeInMinutes,
    });
  }

  private async sendCombinedRuleAlertSms(
    deviceId: string,
    alertsToNotify: Array<{ alertId: string; alert: RuleAlertResult }>
  ): Promise<boolean> {
    const recipient = config.farm.recipientPhone;
    if (!recipient) {
      logger.warn('SMS skipped: FARMER_PHONE not configured', { deviceId });
      return false;
    }

    const alerts = alertsToNotify.map((entry) => entry.alert);
    const severity = selectHighestSeverity(alerts);
    const category = 'WATER_QUALITY_ALERT';
    const shouldSend = await cooldownService.shouldSendSms(deviceId, category, severity);
    if (!shouldSend) {
      logger.info('Rule SMS skipped due to cooldown', { deviceId, category, severity });
      return false;
    }

    const tankName = config.farm.tankName || deviceId;
    const smsMessage = buildCombinedAlertSmsTemplate({
      farmName: config.farm.farmName,
      tankName,
      severity,
      problems: alerts.map((alert) => ({
        message: alert.message,
        value: alert.currentValue,
        unit: alert.unit,
      })),
      action: selectPrimaryAction(alerts),
    });

    const sendResult = await smsService.sendSms(recipient, smsMessage);
    await smsLogService.createLog({
      alertId: alertsToNotify[0]?.alertId ?? null,
      deviceId,
      category,
      severity,
      recipient,
      provider: config.sms.provider,
      providerResponse: sendResult.response,
      success: sendResult.success,
      retryCount: sendResult.retryCount,
      sentAt: new Date(),
    });

    if (sendResult.success) {
      const sentAt = new Date();
      await Promise.all(alertsToNotify.map((entry) => alertService.markSmsSent(entry.alertId, sentAt)));
    }

    return sendResult.success;
  }

  private async sendPredictiveSms(
    deviceId: string,
    warningCard: {
      riskLevel: 'HIGH' | 'CRITICAL';
      cause: string;
      estimatedUnsafeInMinutes: number | null;
    }
  ): Promise<boolean> {
    const recipient = config.farm.recipientPhone;
    if (!recipient) {
      logger.warn('Predictive SMS skipped: FARMER_PHONE not configured', { deviceId });
      return false;
    }

    const category = 'PREDICTIVE_WARNING';
    const severity: AlertSeverity = warningCard.riskLevel === 'CRITICAL' ? 'EMERGENCY' : 'CRITICAL';
    const shouldSend = await cooldownService.shouldSendSms(deviceId, category, severity);
    if (!shouldSend) {
      logger.info('Predictive SMS skipped due to cooldown', { deviceId, category, severity });
      return false;
    }

    const smsMessage = buildPredictiveSmsTemplate({
      farmName: config.farm.farmName,
      tankName: config.farm.tankName || deviceId,
      riskLevel: warningCard.riskLevel,
      cause: warningCard.cause,
      etaMinutes: warningCard.estimatedUnsafeInMinutes,
    });

    const sendResult = await smsService.sendSms(recipient, smsMessage);
    await smsLogService.createLog({
      alertId: null,
      deviceId,
      category,
      severity,
      recipient,
      provider: config.sms.provider,
      providerResponse: sendResult.response,
      success: sendResult.success,
      retryCount: sendResult.retryCount,
      sentAt: new Date(),
    });

    return sendResult.success;
  }
}

export const waterAlertNotificationService = new WaterAlertNotificationService();
