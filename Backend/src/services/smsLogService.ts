import { Op } from 'sequelize';
import { SmsLog as SmsLogModel } from '../database/models/SmsLog';

export interface SmsLogEntry {
  id: string;
  alertId: string | null;
  deviceId: string;
  category: string;
  severity: string;
  recipient: string;
  provider: string;
  providerResponse: string;
  success: boolean;
  retryCount: number;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

class SmsLogService {
  async createLog(entry: Omit<SmsLogEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<SmsLogEntry> {
    const record = await SmsLogModel.create(entry);
    return this.mapLog(record);
  }

  async getLatestLog(deviceId: string, category: string): Promise<SmsLogEntry | null> {
    const record = await SmsLogModel.findOne({
      where: {
        deviceId,
        category,
        success: true,
      },
      order: [['sentAt', 'DESC']],
    });

    return record ? this.mapLog(record) : null;
  }

  async getLogsForAlert(alertId: string): Promise<SmsLogEntry[]> {
    const logs = await SmsLogModel.findAll({
      where: {
        alertId: {
          [Op.eq]: alertId,
        },
      },
      order: [['sentAt', 'DESC']],
    });

    return logs.map((log) => this.mapLog(log));
  }

  async getRecentLogs(limit: number = 30): Promise<SmsLogEntry[]> {
    const logs = await SmsLogModel.findAll({
      order: [['sentAt', 'DESC']],
      limit,
    });
    return logs.map((log) => this.mapLog(log));
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) {
      return 'Hidden';
    }
    return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
  }

  private sanitizeProviderResponse(response: string): string {
    try {
      const parsed = JSON.parse(response) as { message?: { recipient?: string } };
      if (parsed.message?.recipient) {
        parsed.message.recipient = this.maskPhone(parsed.message.recipient);
      }
      return JSON.stringify(parsed);
    } catch {
      return response;
    }
  }

  private mapLog(log: SmsLogModel): SmsLogEntry {
    return {
      id: log.id,
      alertId: log.alertId,
      deviceId: log.deviceId,
      category: log.category,
      severity: log.severity,
      recipient: this.maskPhone(log.recipient),
      provider: log.provider,
      providerResponse: this.sanitizeProviderResponse(log.providerResponse),
      success: log.success,
      retryCount: log.retryCount,
      sentAt: log.sentAt,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    };
  }
}

export const smsLogService = new SmsLogService();
