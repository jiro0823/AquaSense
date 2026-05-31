/**
 * Water Quality Monitoring Types
 */

export interface WaterQualityReading {
  id: string;
  timestamp: Date;
  temperature: number; // Celsius (0-50)
  ph: number; // pH level (0-14)
  do: number; // Dissolved Oxygen (0-14 mg/L)
  turbidity: number; // Turbidity (0-1000 NTU)
  ammonia: number; // Ammonia (0-10 ppm)
  location: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface WaterQualityThresholds {
  temperature: {
    min: number;
    max: number;
    warning: number;
  };
  ph: {
    min: number;
    max: number;
    optimal: {
      min: number;
      max: number;
    };
  };
  do: {
    min: number;
    critical: number;
    optimal: number;
  };
  turbidity: {
    max: number;
    warning: number;
  };
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
  healthScore: number; // 0-100
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
