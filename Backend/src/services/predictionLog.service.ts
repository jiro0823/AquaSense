import { PredictionLog as PredictionLogModel } from '../database/models/PredictionLog';
import { Alert } from '../database/models/Alert';
import { Op } from 'sequelize';

export interface PredictionLogRecord {
  id: string;
  riskScore: number;
  riskLevel: string;
  predictedIssue: string;
  etaMinutes: number | null;
  triggeredAlertId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class PredictionLogService {
  async createLog(input: {
    riskScore: number;
    riskLevel: string;
    predictedIssue: string;
    etaMinutes: number | null;
    triggeredAlertId?: string | null;
  }): Promise<PredictionLogRecord> {
    const record = await PredictionLogModel.create(input);
    return this.mapRecord(record);
  }

  async getRecentLogs(limit: number = 60, deviceIds?: string[]): Promise<PredictionLogRecord[]> {
    if (deviceIds?.length === 0) return [];
    let triggeredAlertIds: string[] | undefined;
    if (deviceIds) {
      const alerts = await Alert.findAll({ where: { deviceId: { [Op.in]: deviceIds } }, attributes: ['id'] });
      triggeredAlertIds = alerts.map((alert) => alert.id);
      if (triggeredAlertIds.length === 0) return [];
    }
    const records = await PredictionLogModel.findAll({
      where: triggeredAlertIds ? { triggeredAlertId: { [Op.in]: triggeredAlertIds } } : undefined,
      order: [['createdAt', 'DESC']],
      limit,
    });
    return records.map((record) => this.mapRecord(record));
  }

  private mapRecord(record: PredictionLogModel): PredictionLogRecord {
    return {
      id: record.id,
      riskScore: record.riskScore,
      riskLevel: record.riskLevel,
      predictedIssue: record.predictedIssue,
      etaMinutes: record.etaMinutes,
      triggeredAlertId: record.triggeredAlertId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export const predictionLogService = new PredictionLogService();
