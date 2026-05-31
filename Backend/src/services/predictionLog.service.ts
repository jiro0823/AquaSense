import { PredictionLog as PredictionLogModel } from '../database/models/PredictionLog';

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

  async getRecentLogs(limit: number = 60): Promise<PredictionLogRecord[]> {
    const records = await PredictionLogModel.findAll({
      order: [['createdAt', 'ASC']],
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
