// Technical diagnostics, deliberately separate from husbandry thresholds.
export const SENSOR_NAMES = ['temperature', 'ph', 'turbidity', 'orp'] as const;
export type SensorName = typeof SENSOR_NAMES[number];
export type HealthState = 'VALID' | 'INVALID' | 'SENSOR_ERROR' | 'MISSING' | 'STALE' | 'UNSTABLE' | 'SATURATED' | 'POSSIBLY_STUCK';
export interface SensorHealth {
  name: SensorName; value: number | null; rawAdc: number | null; voltage: number | null;
  adcMinimum: number|null; adcMaximum: number|null; adcLast: number|null; clippedSamples: number|null;
  unit: string; timestamp: string | null; health: HealthState; valid: boolean;
  stability: 'COLLECTING' | 'STABLE' | 'UNSTABLE'; calibration: 'REQUIRED' | 'CALIBRATED';
  reason: string; readyForCalibration: boolean; communication: boolean;
  adcRange: 'PASS' | 'WARNING' | 'UNKNOWN'; stuckDurationMs: number;
  window: { count: number; min: number | null; max: number | null; average: number | null; range: number | null; standardDeviation: number | null };
}
export type HealthSummary = Record<SensorName, SensorHealth>;
export const HEALTH_CONFIG = { staleMs: 15000, tanMaxAgeMs: 3600000, windowSize: 20, minSamples: 6, windowMs: 150000, stuckMs: 600000, railSamples: 3 };
const noise = { temperature: 1, ph: 0.3, turbidity: 150, orp: 50 }; // Diagnostic ranges, not calibration coefficients.
export function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return null;
  const result = Number(value); return Number.isFinite(result) ? result : null;
}
export function timestampMs(value: unknown): number {
  return value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
}
type Sample = { value: number; at: number };
type Track = { samples: Sample[]; lastAt: number; anchor: number; unchangedSince: number; rails: number; railSide: number };
export class SensorValidator {
  private tracks = new Map<string, Track>();
  constructor(private config = HEALTH_CONFIG) {}
  validate(device: string, name: SensorName, input: unknown, timestamp: unknown, diagnostics: any = {}, now = Date.now(), unit?: string): SensorHealth {
    const value = numeric(input), at = timestampMs(timestamp);
    const rawAdc = numeric(diagnostics?.rawAdc), voltage = numeric(diagnostics?.voltage);
    const result: SensorHealth = { name, value, rawAdc, voltage, unit: unit || ({temperature:'C',ph:'pH',turbidity:'unknown',orp:'mV'}[name]),
      adcMinimum:numeric(diagnostics?.adcMinimum),adcMaximum:numeric(diagnostics?.adcMaximum),adcLast:numeric(diagnostics?.adcLast),clippedSamples:numeric(diagnostics?.clippedSamples),
      timestamp: Number.isFinite(at) ? new Date(at).toISOString() : null, health:'VALID', valid:true,
      stability:'COLLECTING', calibration:'REQUIRED', reason:'', readyForCalibration:false, communication:value !== null,
      adcRange:rawAdc === null ? 'UNKNOWN' : 'PASS', stuckDurationMs:0,
      window:{count:0,min:null,max:null,average:null,range:null,standardDeviation:null} };
    const fail = (health: HealthState, reason: string) => { result.health = health; result.valid = false; result.reason = reason; };
    const key = `${device}:${name}`;
    let track = this.tracks.get(key);
    if (!track) { track = {samples:[],lastAt:-Infinity,anchor:NaN,unchangedSince:now,rails:0,railSide:0}; this.tracks.set(key,track); }
    if (input === null || input === undefined) fail('MISSING','No sensor reading supplied');
    else if (value === null) fail('INVALID','Malformed or non-finite reading');
    else if (name === 'temperature' && value === -127) fail('SENSOR_ERROR','DS18B20 disconnected/error reading detected');
    else if ((name === 'temperature' && (value < -55 || value > 125)) || (name === 'ph' && (value < 0 || value > 14)) ||
      (name === 'turbidity' && (value < 0 || (unit === 'raw_adc' && value > 4095))) || (name === 'orp' && (value < -1980 || value > 1320))) fail('INVALID','Outside physical or existing analog conversion capability');
    if (!Number.isFinite(at) || at > now + 2000) fail('INVALID','Invalid or future acquisition timestamp');
    else if (now - at > this.config.staleMs) fail('STALE','No recent sensor reading received');
    if ((diagnostics?.rawAdc != null && rawAdc === null) || (rawAdc !== null && (rawAdc < 0 || rawAdc > 4095)) ||
      (diagnostics?.voltage != null && voltage === null) || (voltage !== null && (voltage < 0 || voltage > 3.3))) fail('INVALID','Malformed or out-of-range ADC/input voltage');
    if (at < track.lastAt && result.valid) fail('STALE','Out-of-order acquisition');
    const freshSample = Number.isFinite(at) && at > track.lastAt && now - at <= this.config.staleMs && at <= now + 2000;
    if (freshSample) {
      if (at - track.lastAt > this.config.staleMs) { track.samples=[]; track.rails=0; track.anchor=NaN; }
      track.lastAt=at;
      const side = rawAdc === null ? 0 : rawAdc <= 8 ? -1 : rawAdc >= 4087 ? 1 : (result.clippedSamples ?? 0)>=8 ? 2 : 0;
      track.rails = side && side === track.railSide ? track.rails+1 : side ? 1 : 0; track.railSide=side;
      if (result.valid && value !== null) {
        track.samples = [...track.samples.filter(s => at-s.at <= this.config.windowMs),{value,at}].slice(-this.config.windowSize);
        const signal = rawAdc ?? value;
        if (!Number.isFinite(track.anchor) || Math.abs(signal-track.anchor) > (rawAdc === null ? 0.001 : 1)) { track.anchor=signal; track.unchangedSince=at; }
        result.stuckDurationMs = at-track.unchangedSince;
      } else { track.samples=[]; track.anchor=NaN; }
    }
    const values = track.samples.map(s=>s.value);
    if (values.length) {
      const min=Math.min(...values),max=Math.max(...values),average=values.reduce((a,b)=>a+b,0)/values.length;
      result.window={count:values.length,min,max,average,range:max-min,standardDeviation:Math.sqrt(values.reduce((s,v)=>s+(v-average)**2,0)/values.length)};
      if (values.length >= this.config.minSamples) result.stability=max-min > noise[name] ? 'UNSTABLE' : 'STABLE';
    }
    if (result.health !== 'STALE' && track.rails >= this.config.railSamples) { fail('SATURATED',`ADC repeatedly near ${track.railSide < 0 ? 'minimum':'maximum'} range`); result.adcRange='WARNING'; }
    // Firmware may detect errors at its faster acquisition rate; it cannot grant validity or calibration.
    if (result.health !== 'STALE' && ['SENSOR_ERROR','SATURATED','INVALID','UNSTABLE','POSSIBLY_STUCK'].includes(diagnostics?.health)) fail(diagnostics.health,`Device reported ${diagnostics.health}`);
    if (result.valid && result.stability === 'UNSTABLE') fail('UNSTABLE','Large recent variation; inspect signal and water conditions');
    if (result.valid && result.stuckDurationMs >= this.config.stuckMs) fail('POSSIBLY_STUCK',`Nearly unchanged for ${result.stuckDurationMs} ms; stable water is also possible`);
    if (result.health==='SENSOR_ERROR') result.communication=false;
    result.readyForCalibration=result.valid && result.stability==='STABLE' && (name==='temperature' || result.adcRange==='PASS');
    if (this.tracks.size > 2048) this.tracks.delete(this.tracks.keys().next().value!);
    return result;
  }
}
export function refreshHealth(summary: HealthSummary, now = Date.now(), staleMs = HEALTH_CONFIG.staleMs): HealthSummary {
  return Object.fromEntries(SENSOR_NAMES.map(name=> { const s=summary[name]; return [name, s.timestamp && now-Date.parse(s.timestamp)>staleMs ? {...s,health:'STALE',valid:false,readyForCalibration:false,reason:'No recent sensor reading received'} : {...s}]; })) as HealthSummary;
}
export interface TanMeasurement { value: number; unit: 'mg/L as N'; source: 'test_kit'|'laboratory'|'external_sensor'|'manual'; validated: true; timestamp: string }
export function ammoniaSpeciation(health: HealthSummary, tan?: unknown, waterType = 'freshwater', now = Date.now()) {
  const sources=refreshHealth(health,now), temperature=sources.temperature, ph=sources.ph;
  const result = { status:'UNAVAILABLE', pKa:null as number|null, fraction:null as number|null, percent:null as number|null,
    tan:null as TanMeasurement|null, nh3N:null as number|null, concentrationUnit:'mg/L as N', confidence:'PRELIMINARY / CALIBRATION REQUIRED',
    sourceCalibration:{temperature:temperature.calibration,ph:ph.calibration}, waterType,
    reason:'Valid and fresh pH and temperature readings are required', concentrationReason:'Actual ammonia concentration requires a valid TAN measurement' };
  const t=tan as TanMeasurement | undefined;
  if (t && typeof t.value==='number' && Number.isFinite(t.value) && t.value>=0 && t.unit==='mg/L as N' && t.validated===true &&
    ['test_kit','laboratory','external_sensor','manual'].includes(t.source) && Number.isFinite(timestampMs(t.timestamp)) &&
    now-timestampMs(t.timestamp)<=HEALTH_CONFIG.tanMaxAgeMs && timestampMs(t.timestamp)<=now+2000) {
    result.tan=t; result.concentrationReason='TAN available; valid source sensors and freshwater conditions are also required';
  }
  if (!temperature.valid || !ph.valid || temperature.value === null || ph.value === null) return result;
  if (waterType !== 'freshwater') return {...result,reason:'Freshwater equation requires freshwater conditions; salinity correction is not implemented'};
  if (temperature.value < 0 || temperature.value > 50) return {...result,reason:'Outside freshwater speciation temperature domain (0–50 C)'};
  result.pKa=0.09018+2729.92/(273.2+temperature.value);
  result.fraction=1/(1+10**(result.pKa-ph.value)); result.percent=result.fraction*100; result.status='AVAILABLE';
  result.reason='Fraction of TAN only; source-sensor accuracy has not been formally verified';
  if (result.tan) {
    result.nh3N=result.tan.value*result.fraction; result.concentrationReason='NH3-N calculated from measured TAN (both mg/L as N)';
  }
  return result;
}
export type AmmoniaSpeciation = ReturnType<typeof ammoniaSpeciation>;
