/**
 * Water Quality Types
 * Frontend type definitions for water quality monitoring
 */

export interface WaterQualityReading {
  id: string;
  timestamp: Date;
  temperature: number;
  ph: number;
  do: number;
  turbidity: number;
  ammonia: number;
  location: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface WaterQualityStats {
  timestamp: Date;
  temperature: {
    current: number;
    average: number;
    min: number;
    max: number;
  };
  ph: {
    current: number;
    average: number;
    min: number;
    max: number;
  };
  do: {
    current: number;
    average: number;
    min: number;
    max: number;
  };
  turbidity: {
    current: number;
    average: number;
    min: number;
    max: number;
  };
  ammonia: {
    current: number;
    average: number;
    min: number;
    max: number;
  };
  healthScore: number;
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY' | 'info' | 'warning' | 'critical';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface HealthAlert {
  id: string;
  deviceId?: string;
  category?: string;
  severity: AlertSeverity;
  currentValue?: number;
  thresholdValue?: number;
  unit?: string;
  action?: string;
  message: string;
  status?: AlertStatus;
  smsSentAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  timestamp?: string | Date;
  parameter?: 'temperature' | 'ph' | 'do' | 'turbidity' | 'ammonia';
  value?: number;
  threshold?: number;
}

export interface PredictiveWarningCard {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  predictedIssue: string;
  cause: string;
  action: string;
  confidence: number;
  estimatedUnsafeInMinutes: number | null;
}

export interface PredictiveAnalyticsResult {
  generatedAt: string;
  modelVersion: string;
  horizonMinutes: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  predictedIssue: string;
  warningCard: PredictiveWarningCard;
  latest: {
    temperature: number;
    ph: number;
    turbidity: number;
    dissolvedOxygen: number;
    ammonia: number;
  } | null;
  movingAverage: {
    temperature: number;
    ph: number;
    turbidity: number;
    dissolvedOxygen: number;
    ammonia: number;
  } | null;
  dataQuality: {
    score: number;
    sampleCount: number;
    windowMinutes: number;
    newestSampleAgeMinutes: number | null;
    measuredAmmoniaRatio: number;
    notes: string[];
  };
  trends: {
    temperature: {
      slope: number;
      direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    };
    ph: {
      slope: number;
      direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    };
    turbidity: {
      slope: number;
      direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    };
    dissolvedOxygen: {
      slope: number;
      direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    };
    ammonia: {
      slope: number;
      direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    };
  } | null;
}

export interface PredictionLog {
  id: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  predictedIssue: string;
  etaMinutes: number | null;
  createdAt: string;
}

export interface SmsLogEntry {
  id: string;
  category: string;
  severity: string;
  recipient: string;
  success: boolean;
  sentAt: string;
}
