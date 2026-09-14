import type { HealthSummary, Speciation } from './sensorHealth';
/**
 * Water Quality Types
 * Frontend type definitions for water quality monitoring
 */

export interface WaterQualityReading {
  id: string;
  timestamp: Date;
<<<<<<< Updated upstream
  temperature: number;
  ph: number;
  do: number;
  doMeasured?: boolean;
  turbidity: number;
  ammonia: number;
=======
  createdAt?: Date;
  temperature: number | null;
  ph: number | null;
  do: number | null;
  doMeasured?: boolean;
  waterQuality?: Record<string,string>;
  sensorHealth?: HealthSummary;
  speciation?: Speciation;
  orp?: number|null;
  turbidityUnit?: string;
  turbidity: number | null;
  ammonia: number | null;
>>>>>>> Stashed changes
  location: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface WaterQualityStats {
  timestamp: Date;
  temperature: {
    current: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  ph: {
    current: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  do: {
    current: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  turbidity: {
    current: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  ammonia: {
    current: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  healthScore: number | null;
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
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNAVAILABLE';
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
  analysisStatus?: 'AVAILABLE' | 'INSUFFICIENT_VALID_SENSOR_DATA';
  riskScore: number|null;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNAVAILABLE';
  predictedIssue: string;
  warningCard: PredictiveWarningCard;
  latest: {
    temperature: number | null;
    ph: number | null;
    turbidity: number | null;
    dissolvedOxygen: number;
    ammonia: number | null;
  } | null;
  movingAverage: {
    temperature: number | null;
    ph: number | null;
    turbidity: number | null;
    dissolvedOxygen: number;
    ammonia: number | null;
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
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNAVAILABLE';
  predictedIssue: string;
  etaMinutes: number | null;
  createdAt: string;
}

export type { SmsDeliveryStatus, SmsLogEntry } from './sms';
