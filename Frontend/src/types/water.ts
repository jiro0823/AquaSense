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
  healthScore: number;
}

export interface HealthAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  parameter: 'temperature' | 'ph' | 'do' | 'turbidity';
  message: string;
  value: number;
  threshold: number;
}
