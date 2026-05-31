import { smsLogService } from './smsLogService';
import type { AlertSeverity } from './ruleEngine.service';

const severityRank: Record<AlertSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
  EMERGENCY: 3,
};

class CooldownService {
  private readonly standardCooldownMinutes = 15;
  private readonly emergencyCooldownMinutes = 5;

  async shouldSendSms(deviceId: string, category: string, severity: AlertSeverity): Promise<boolean> {
    const latestLog = await smsLogService.getLatestLog(deviceId, category);
    if (!latestLog) {
      return true;
    }

    const cooldownMinutes = severity === 'EMERGENCY' ? this.emergencyCooldownMinutes : this.standardCooldownMinutes;
    const cutoff = Date.now() - cooldownMinutes * 60 * 1000;

    if (latestLog.sentAt.getTime() < cutoff) {
      return true;
    }

    const lastSeverity = latestLog.severity as AlertSeverity;
    return severityRank[severity] > severityRank[lastSeverity];
  }
}

export const cooldownService = new CooldownService();
