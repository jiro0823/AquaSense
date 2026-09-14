import { refreshHealth } from './sensorHealth';
import { sensorReadingService, type SensorReading } from './sensorReadingService';
import { predictionLogService } from './predictionLog.service';

export type TrendDirection = 'INCREASING' | 'DECREASING' | 'STABLE';
export type PredictiveRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNAVAILABLE';

interface Snapshot {
  temperature: number;
  ph: number;
  turbidity: number;
  dissolvedOxygen: number;
  ammonia: number | null;
}

interface TrendMeta {
  slope: number;
  direction: TrendDirection;
}

interface DataQuality {
  score: number;
  sampleCount: number;
  windowMinutes: number;
  newestSampleAgeMinutes: number | null;
  measuredAmmoniaRatio: number;
  notes: string[];
}

export interface PredictiveAnalyticsResult {
  generatedAt: string;
  modelVersion: string;
  horizonMinutes: number;
  analysisStatus: 'AVAILABLE' | 'INSUFFICIENT_VALID_SENSOR_DATA';
  calibration: 'REQUIRED';
  riskScore: number | null;
  riskLevel: PredictiveRiskLevel;
  predictedIssue: string;
  warningCard: {
    riskLevel: PredictiveRiskLevel;
    predictedIssue: string;
    cause: string;
    action: string;
    confidence: number;
    estimatedUnsafeInMinutes: number | null;
  };
  movingAverage: Snapshot | null;
  latest: Snapshot | null;
  dataQuality: DataQuality;
  trends: {
    temperature: TrendMeta;
    ph: TrendMeta;
    turbidity: TrendMeta;
    dissolvedOxygen: TrendMeta;
    ammonia: TrendMeta;
  } | null;
}

type MetricKey = keyof Snapshot;

const MODEL_VERSION = 'rules-v3.0.0-sensor-health';
const MOVING_AVERAGE_WINDOW = 5;
const MIN_RELIABLE_SAMPLES = 6;
const IDEAL = {
  temperature: { low: 20, high: 30, criticalLow: 15, criticalHigh: 35 },
  ph: { low: 6.5, high: 8.5, criticalLow: 6.0, criticalHigh: 9.0 },
  dissolvedOxygen: { ideal: 5, warning: 4, critical: 3, emergency: 2 },
  turbidity: { ideal: 50, warning: 70, critical: 100 },
  ammonia: { ideal: 1, warning: 2, critical: 5, emergency: 7.5 },
};
const WEIGHTS: Record<MetricKey, number> = {
  dissolvedOxygen: 0.34,
  ammonia: 0,
  temperature: 0.18,
  ph: 0.14,
  turbidity: 0.1,
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const round = (value: number, decimals: number = 3): number => Number(value.toFixed(decimals));

const avg = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

const movingAverage = (values: number[]): number => avg(values.slice(-Math.min(MOVING_AVERAGE_WINDOW, values.length)));

const direction = (slopePerMinute: number, stableBand: number): TrendDirection => {
  if (Math.abs(slopePerMinute) <= stableBand) {
    return 'STABLE';
  }
  return slopePerMinute > 0 ? 'INCREASING' : 'DECREASING';
};

const linearSlopePerMinute = (points: Array<{ value: number; timestamp: Date }>): number => {
  if (points.length < 2) {
    return 0;
  }

  const start = points[0].timestamp.getTime();
  const xs = points.map((point) => (point.timestamp.getTime() - start) / 60000);
  const ys = points.map((point) => point.value);
  const meanX = avg(xs);
  const meanY = avg(ys);
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);

  if (denominator === 0) {
    return 0;
  }

  const numerator = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0);
  return numerator / denominator;
};

const normalizeReading = (reading: SensorReading): Snapshot & { timestamp: Date; hasMeasuredAmmonia: boolean } => {
  const hasMeasuredAmmonia = Number.isFinite(reading.ammonia) && reading.ammonia !== null;
  return {
    temperature: reading.temperature!,
    ph: reading.ph!,
    turbidity: reading.turbidity!,
    dissolvedOxygen: reading.do!,
    ammonia: reading.ammonia,
    timestamp: reading.timestamp,
    hasMeasuredAmmonia,
  };
};

const scoreAbove = (value: number, ideal: number, warning: number, critical: number, emergency: number = critical): number => {
  if (value <= ideal) return 5;
  if (value <= warning) return 20 + ((value - ideal) / (warning - ideal)) * 20;
  if (value <= critical) return 45 + ((value - warning) / (critical - warning)) * 30;
  if (value <= emergency || emergency === critical) return 85;
  return 85 + clamp(((value - critical) / (emergency - critical)) * 15, 0, 15);
};

const scoreBelow = (value: number, ideal: number, warning: number, critical: number, emergency: number): number => {
  if (value >= ideal) return 5;
  if (value >= warning) return 20 + ((ideal - value) / (ideal - warning)) * 20;
  if (value >= critical) return 45 + ((warning - value) / (warning - critical)) * 30;
  if (value >= emergency) return 80 + ((critical - value) / (critical - emergency)) * 15;
  return 98;
};

const scoreTemperature = (value: number): number => {
  if (value >= IDEAL.temperature.low && value <= IDEAL.temperature.high) return 5;
  if (value < IDEAL.temperature.low) {
    return scoreBelow(value, IDEAL.temperature.low, 18, IDEAL.temperature.criticalLow, 10);
  }
  return scoreAbove(value, IDEAL.temperature.high, 32, IDEAL.temperature.criticalHigh, 38);
};

const scorePh = (value: number): number => {
  if (value >= IDEAL.ph.low && value <= IDEAL.ph.high) return 5;
  if (value < IDEAL.ph.low) {
    return scoreBelow(value, IDEAL.ph.low, 6.2, IDEAL.ph.criticalLow, 5.5);
  }
  return scoreAbove(value, IDEAL.ph.high, 8.8, IDEAL.ph.criticalHigh, 9.5);
};

const scoreSnapshot = (snapshot: Snapshot): Record<MetricKey, number> => ({
  temperature: scoreTemperature(snapshot.temperature),
  ph: scorePh(snapshot.ph),
  turbidity: scoreAbove(snapshot.turbidity, IDEAL.turbidity.ideal, IDEAL.turbidity.warning, IDEAL.turbidity.critical, 150),
  dissolvedOxygen: scoreBelow(
    snapshot.dissolvedOxygen,
    IDEAL.dissolvedOxygen.ideal,
    IDEAL.dissolvedOxygen.warning,
    IDEAL.dissolvedOxygen.critical,
    IDEAL.dissolvedOxygen.emergency
  ),
  ammonia: 0, // No commissioned NH3-N toxicity policy.
});

const trendPenalty = (trends: Record<MetricKey, TrendMeta>): number => {
  const penalties = [
    trends.dissolvedOxygen.direction === 'DECREASING' ? Math.min(12, Math.abs(trends.dissolvedOxygen.slope) * 18) : 0,
    trends.temperature.direction === 'INCREASING' ? Math.min(8, trends.temperature.slope * 10) : 0,
    trends.ph.direction !== 'STABLE' ? Math.min(6, Math.abs(trends.ph.slope) * 25) : 0,
    trends.turbidity.direction === 'INCREASING' ? Math.min(6, trends.turbidity.slope * 0.35) : 0,
  ];
  return penalties.reduce((sum, value) => sum + value, 0);
};

const riskLevel = (riskScore: number): PredictiveRiskLevel => {
  if (riskScore < 25) return 'LOW';
  if (riskScore < 50) return 'MODERATE';
  if (riskScore < 75) return 'HIGH';
  return 'CRITICAL';
};

const etaToThreshold = (current: number, slopePerMinute: number, unsafeThreshold: number, mode: 'above' | 'below'): number | null => {
  if (mode === 'above' && slopePerMinute <= 0) return null;
  if (mode === 'below' && slopePerMinute >= 0) return null;

  const minutes = (unsafeThreshold - current) / slopePerMinute;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  return Math.ceil(minutes);
};

const estimateUnsafeMinutes = (latest: Snapshot, trends: Record<MetricKey, TrendMeta>): number | null => {
  const estimates = [
    etaToThreshold(latest.dissolvedOxygen, trends.dissolvedOxygen.slope, IDEAL.dissolvedOxygen.critical, 'below'),
    etaToThreshold(latest.temperature, trends.temperature.slope, IDEAL.temperature.criticalHigh, 'above'),
    etaToThreshold(latest.ph, trends.ph.slope, IDEAL.ph.criticalHigh, 'above'),
    etaToThreshold(latest.ph, trends.ph.slope, IDEAL.ph.criticalLow, 'below'),
    etaToThreshold(latest.turbidity, trends.turbidity.slope, IDEAL.turbidity.critical, 'above'),
  ].filter((value): value is number => value !== null);

  return estimates.length > 0 ? Math.min(...estimates) : null;
};

const calculateDataQuality = (
  readings: Array<Snapshot & { timestamp: Date; hasMeasuredAmmonia: boolean }>,
  requestedWindowMinutes: number
): DataQuality => {
  const notes: string[] = ['PRELIMINARY: source sensors require formal calibration'];
  const sampleCount = readings.length;
  const measuredAmmoniaRatio = sampleCount > 0 ? readings.filter((reading) => reading.hasMeasuredAmmonia).length / sampleCount : 0;
  const newest = readings[readings.length - 1];
  const oldest = readings[0];
  const newestSampleAgeMinutes = newest ? Math.max(0, (Date.now() - newest.timestamp.getTime()) / 60000) : null;
  const observedWindowMinutes = newest && oldest ? Math.max(0, (newest.timestamp.getTime() - oldest.timestamp.getTime()) / 60000) : 0;

  let score = 100;
  if (sampleCount < MIN_RELIABLE_SAMPLES) {
    score -= (MIN_RELIABLE_SAMPLES - sampleCount) * 10;
    notes.push(`Only ${sampleCount} sample(s); trend confidence is limited`);
  }
  if (observedWindowMinutes < requestedWindowMinutes * 0.35) {
    score -= 15;
    notes.push('Observed window is short for the requested horizon');
  }
  if (newestSampleAgeMinutes !== null && newestSampleAgeMinutes > 10) {
    score -= Math.min(25, newestSampleAgeMinutes);
    notes.push('Newest sample is stale');
  }
  if (measuredAmmoniaRatio < 0.5) {

    notes.push('Actual NH3-N requires measured TAN; ammonia is excluded from risk scoring');
  }

  return {
    score: Math.round(clamp(score, 20, 100)),
    sampleCount,
    windowMinutes: Math.round(observedWindowMinutes),
    newestSampleAgeMinutes: newestSampleAgeMinutes === null ? null : Math.round(newestSampleAgeMinutes),
    measuredAmmoniaRatio: round(measuredAmmoniaRatio, 2),
    notes,
  };
};

const buildTrend = (
  readings: Array<Snapshot & { timestamp: Date }>,
  metric: MetricKey,
  stableBand: number
): TrendMeta => {
  const slope = linearSlopePerMinute(readings.map((reading) => ({ value: reading[metric]!, timestamp: reading.timestamp })));
  return {
    slope: round(slope, 4),
    direction: direction(slope, stableBand),
  };
};

const buildCause = (scores: Record<MetricKey, number>, trends: Record<MetricKey, TrendMeta>): string => {
  const causes = [
    scores.dissolvedOxygen >= 40 ? 'low dissolved oxygen' : null,
    scores.temperature >= 40 ? 'temperature outside safe range' : null,
    scores.ph >= 40 ? 'pH outside safe range' : null,
    scores.turbidity >= 40 ? 'high turbidity' : null,
    trends.dissolvedOxygen.direction === 'DECREASING' ? 'DO trending down' : null,
  ].filter((cause): cause is string => cause !== null);

  return causes.length > 0 ? Array.from(new Set(causes)).join(' + ') : 'No critical trend shifts detected';
};

const issueFor = (level: PredictiveRiskLevel): string => {
  if (level === 'CRITICAL') return 'Unsafe water condition likely very soon';
  if (level === 'HIGH') return 'Water quality degradation likely';
  if (level === 'MODERATE') return 'Early stress indicators detected';
  return 'Water quality is currently stable';
};

const actionFor = (level: PredictiveRiskLevel, scores: Record<MetricKey, number>): string => {
  if (level === 'CRITICAL') return 'Start aeration, inspect stock, and prepare immediate water correction';
  if (scores.dissolvedOxygen >= 40) return 'Increase aeration and monitor dissolved oxygen closely';
  if (scores.turbidity >= 40) return 'Inspect filtration, reduce feeding, and prepare partial water exchange';
  if (scores.ph >= 40) return 'Check pH calibration and correct alkalinity gradually';
  if (level === 'HIGH') return 'Inspect tank and prepare corrective action';
  if (level === 'MODERATE') return 'Increase monitoring frequency and inspect tank';
  return 'Continue routine monitoring';
};

class PredictiveAnalyticsService {
  async getWarningCard(minutes: number = 60): Promise<PredictiveAnalyticsResult> {
    const horizonMinutes = clamp(Math.round(minutes || 60), 15, 1440);
    const readingsDesc = await sensorReadingService.getReadingsByTimeRange(horizonMinutes);
    // Do not infer oxygen emergencies from legacy/default placeholders, or use
    // older measurements to imply that a currently missing sensor is healthy.
<<<<<<< Updated upstream
    const usableReadings = readingsDesc[0]?.doMeasured === false ? [] : readingsDesc.filter((reading) => reading.doMeasured !== false);
=======
    const currentReading = await sensorReadingService.getLatestReading();
    const usable = (r: SensorReading) => r.doMeasured && r.do !== null && r.temperature !== null && r.ph !== null && r.turbidity !== null && r.turbidityUnit === 'NTU' && !!r.sensorHealth &&
      ['temperature','ph','turbidity'].every(n => r.sensorHealth[n as 'temperature'|'ph'|'turbidity'].valid);
    const currentValid = currentReading && usable(currentReading) && Object.values(refreshHealth(currentReading.sensorHealth)).filter(s=>['temperature','ph','turbidity'].includes(s.name)).every(s=>s.valid);
    const usableReadings = currentValid ? readingsDesc.filter(r=>r.deviceId===currentReading!.deviceId && usable(r)) : [];
>>>>>>> Stashed changes
    const readings = [...usableReadings].reverse().map(normalizeReading);
    const dataQuality = calculateDataQuality(readings, horizonMinutes);

    if (readings.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        modelVersion: MODEL_VERSION,
        horizonMinutes,
        analysisStatus:'INSUFFICIENT_VALID_SENSOR_DATA', calibration:'REQUIRED',
        riskScore: null,
        riskLevel: 'UNAVAILABLE',
        predictedIssue: 'INSUFFICIENT VALID SENSOR DATA',
        warningCard: {
          riskLevel: 'UNAVAILABLE',
          predictedIssue: 'INSUFFICIENT VALID SENSOR DATA',
          cause: 'Valid fresh temperature, pH, measured oxygen and turbidity in NTU are required',
          action: 'Wait for sensor stream and monitor dashboard',
          confidence: 0,
          estimatedUnsafeInMinutes: null,
        },
        movingAverage: null,
        latest: null,
        dataQuality,
        trends: null,
      };
    }

    const latestRaw = readings[readings.length - 1];
    const latest: Snapshot = {
      temperature: latestRaw.temperature,
      ph: latestRaw.ph,
      turbidity: latestRaw.turbidity,
      dissolvedOxygen: latestRaw.dissolvedOxygen,
      ammonia: latestRaw.ammonia,
    };

    const movingAvg: Snapshot = {
      temperature: round(movingAverage(readings.map((reading) => reading.temperature))),
      ph: round(movingAverage(readings.map((reading) => reading.ph))),
      turbidity: round(movingAverage(readings.map((reading) => reading.turbidity))),
      dissolvedOxygen: round(movingAverage(readings.map((reading) => reading.dissolvedOxygen))),
      ammonia: null,
    };

    const trends: Record<MetricKey, TrendMeta> = {
      temperature: buildTrend(readings, 'temperature', 0.02),
      ph: buildTrend(readings, 'ph', 0.005),
      turbidity: buildTrend(readings, 'turbidity', 0.1),
      dissolvedOxygen: buildTrend(readings, 'dissolvedOxygen', 0.01),
      ammonia: {slope:0,direction:'STABLE'},
    };

    const latestScores = scoreSnapshot(latest);
    const averageScores = scoreSnapshot(movingAvg);
    const combinedScores = Object.fromEntries(
      (Object.keys(WEIGHTS) as MetricKey[]).map((key) => [key, latestScores[key] * 0.6 + averageScores[key] * 0.4])
    ) as Record<MetricKey, number>;

    const baseRisk = (Object.keys(WEIGHTS) as MetricKey[]).reduce((sum, key) => sum + combinedScores[key] * WEIGHTS[key], 0);
    const riskScore = round(clamp(baseRisk / Object.values(WEIGHTS).reduce((a,b)=>a+b,0) + trendPenalty(trends), 0, 100), 2);
    const level = riskLevel(riskScore);
    const predictedIssue = issueFor(level);
    const estimatedUnsafeInMinutes = estimateUnsafeMinutes(latest, trends);
    const confidence = Math.round(
      clamp(dataQuality.score * 0.72 + Math.min(20, readings.length * 1.5) + (estimatedUnsafeInMinutes !== null ? 5 : 0), 10, 95)
    );

    return {
      analysisStatus:'AVAILABLE', calibration:'REQUIRED',
      generatedAt: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
      horizonMinutes,
      riskScore,
      riskLevel: level,
      predictedIssue,
      warningCard: {
        riskLevel: level,
        predictedIssue,
        cause: buildCause(combinedScores, trends) + '; preliminary, calibration required',
        action: actionFor(level, combinedScores),
        confidence,
        estimatedUnsafeInMinutes,
      },
      latest,
      movingAverage: movingAvg,
      dataQuality,
      trends,
    };
  }

  async persistCurrentPrediction(minutes: number = 60, triggeredAlertId?: string): Promise<PredictiveAnalyticsResult> {
    const prediction = await this.getWarningCard(minutes);
    if (prediction.latest) {
      await predictionLogService.createLog({
        riskScore: prediction.riskScore!,
        riskLevel: prediction.riskLevel as Exclude<PredictiveRiskLevel,'UNAVAILABLE'>,
        predictedIssue: prediction.predictedIssue,
        etaMinutes: prediction.warningCard.estimatedUnsafeInMinutes,
        triggeredAlertId: triggeredAlertId || null,
      });
    }
    return prediction;
  }
}

export const predictiveAnalyticsService = new PredictiveAnalyticsService();
