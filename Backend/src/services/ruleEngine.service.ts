export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
export type AlertCategory = 'TEMP_HIGH' | 'TEMP_LOW' | 'PH_LOW' | 'PH_HIGH' | 'DO_LOW' | 'TURBIDITY_HIGH' | 'AMMONIA_HIGH';
export type AlertAction =
  | 'DASHBOARD_ONLY'
  | 'WATER_CHANGE'
  | 'WATER_REPLACEMENT'
  | 'AERATOR_ON'
  | 'AERATOR_ON_IMMEDIATE';

export interface RuleAlertResult {
  category: AlertCategory;
  severity: AlertSeverity;
  currentValue: number;
  thresholdValue: number;
  unit: string;
  action: AlertAction;
  message: string;
}

export interface RuleEngineInput {
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  turbidity: number;
  ammonia?: number;
}

export const ruleEngine = (input: RuleEngineInput): RuleAlertResult[] => {
  const alerts: RuleAlertResult[] = [];

  // Temperature
  if (input.temperature < 10) {
    alerts.push({
      category: 'TEMP_LOW',
      severity: 'EMERGENCY',
      currentValue: input.temperature,
      thresholdValue: 10,
      unit: 'C',
      action: 'WATER_CHANGE',
      message: 'Temperature dangerously low',
    });
  } else if (input.temperature < 15) {
    alerts.push({
      category: 'TEMP_LOW',
      severity: 'CRITICAL',
      currentValue: input.temperature,
      thresholdValue: 15,
      unit: 'C',
      action: 'WATER_CHANGE',
      message: 'Temperature critically low',
    });
  } else if (input.temperature > 35) {
    alerts.push({
      category: 'TEMP_HIGH',
      severity: 'EMERGENCY',
      currentValue: input.temperature,
      thresholdValue: 35,
      unit: 'C',
      action: 'WATER_CHANGE',
      message: 'Temperature dangerously high',
    });
  } else if (input.temperature > 32) {
    alerts.push({
      category: 'TEMP_HIGH',
      severity: 'CRITICAL',
      currentValue: input.temperature,
      thresholdValue: 32,
      unit: 'C',
      action: 'WATER_CHANGE',
      message: 'Temperature critically high',
    });
  } else if (input.temperature > 29) {
    alerts.push({
      category: 'TEMP_HIGH',
      severity: 'WARNING',
      currentValue: input.temperature,
      thresholdValue: 29,
      unit: 'C',
      action: 'DASHBOARD_ONLY',
      message: 'Temperature above ideal range',
    });
  }

  // pH Low
  if (input.ph < 6.0) {
    alerts.push({
      category: 'PH_LOW',
      severity: 'CRITICAL',
      currentValue: input.ph,
      thresholdValue: 6.0,
      unit: 'pH',
      action: 'WATER_REPLACEMENT',
      message: 'pH critically low',
    });
  } else if (input.ph < 6.5) {
    alerts.push({
      category: 'PH_LOW',
      severity: 'WARNING',
      currentValue: input.ph,
      thresholdValue: 6.5,
      unit: 'pH',
      action: 'DASHBOARD_ONLY',
      message: 'pH below ideal range',
    });
  }

  // pH High
  if (input.ph > 8.5) {
    alerts.push({
      category: 'PH_HIGH',
      severity: 'CRITICAL',
      currentValue: input.ph,
      thresholdValue: 8.5,
      unit: 'pH',
      action: 'WATER_REPLACEMENT',
      message: 'pH critically high',
    });
  } else if (input.ph > 8.2) {
    alerts.push({
      category: 'PH_HIGH',
      severity: 'WARNING',
      currentValue: input.ph,
      thresholdValue: 8.2,
      unit: 'pH',
      action: 'DASHBOARD_ONLY',
      message: 'pH above ideal range',
    });
  }

  // Dissolved Oxygen
  if (input.dissolvedOxygen < 2) {
    alerts.push({
      category: 'DO_LOW',
      severity: 'EMERGENCY',
      currentValue: input.dissolvedOxygen,
      thresholdValue: 2,
      unit: 'mg/L',
      action: 'AERATOR_ON_IMMEDIATE',
      message: 'Dissolved oxygen dangerously low',
    });
  } else if (input.dissolvedOxygen < 3) {
    alerts.push({
      category: 'DO_LOW',
      severity: 'CRITICAL',
      currentValue: input.dissolvedOxygen,
      thresholdValue: 3,
      unit: 'mg/L',
      action: 'AERATOR_ON_IMMEDIATE',
      message: 'Dissolved oxygen critically low',
    });
  } else if (input.dissolvedOxygen < 5) {
    alerts.push({
      category: 'DO_LOW',
      severity: 'WARNING',
      currentValue: input.dissolvedOxygen,
      thresholdValue: 5,
      unit: 'mg/L',
      action: 'AERATOR_ON',
      message: 'Dissolved oxygen below ideal range',
    });
  }

  // Turbidity
  if (input.turbidity > 100) {
    alerts.push({
      category: 'TURBIDITY_HIGH',
      severity: 'CRITICAL',
      currentValue: input.turbidity,
      thresholdValue: 100,
      unit: 'NTU',
      action: 'WATER_REPLACEMENT',
      message: 'Turbidity critically high',
    });
  } else if (input.turbidity > 70) {
    alerts.push({
      category: 'TURBIDITY_HIGH',
      severity: 'WARNING',
      currentValue: input.turbidity,
      thresholdValue: 70,
      unit: 'NTU',
      action: 'DASHBOARD_ONLY',
      message: 'Turbidity above ideal range',
    });
  }

  // Ammonia
  const ammonia = input.ammonia ?? 0;
  if (ammonia > 7.5) {
    alerts.push({
      category: 'AMMONIA_HIGH',
      severity: 'EMERGENCY',
      currentValue: ammonia,
      thresholdValue: 7.5,
      unit: 'ppm',
      action: 'WATER_REPLACEMENT',
      message: 'Ammonia dangerously high',
    });
  } else if (ammonia > 5) {
    alerts.push({
      category: 'AMMONIA_HIGH',
      severity: 'CRITICAL',
      currentValue: ammonia,
      thresholdValue: 5,
      unit: 'ppm',
      action: 'WATER_REPLACEMENT',
      message: 'Ammonia critically high',
    });
  } else if (ammonia > 2) {
    alerts.push({
      category: 'AMMONIA_HIGH',
      severity: 'WARNING',
      currentValue: ammonia,
      thresholdValue: 2,
      unit: 'ppm',
      action: 'DASHBOARD_ONLY',
      message: 'Ammonia above ideal range',
    });
  }

  return alerts;
};
