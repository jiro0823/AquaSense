import type { WaterQualityReading } from '../../types/water';

export interface DiagnosticChartPoint {
  deviceId?: string;
  rawPhAdc: number | null;
  provisionalPh: number | null;
  rawTurbidityAdc: number | null;
  provisionalTurbidity: number | null;
  rawOrpAdc: number | null;
  provisionalOrp: number | null;
}

const finiteOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const verifiedDiagnosticValue = (reading: WaterQualityReading, name: 'ph' | 'turbidity' | 'orp'): number | null => {
  const provisional = reading.sensorHealth?.[name].provisional;
  return provisional?.status === 'UNVERIFIED' ? finiteOrNull(provisional.value) : null;
};

export const toDiagnosticChartPoint = (reading: WaterQualityReading): DiagnosticChartPoint => ({
  deviceId: reading.deviceId,
  rawPhAdc: finiteOrNull(reading.sensorHealth?.ph.rawAdc),
  provisionalPh: verifiedDiagnosticValue(reading, 'ph'),
  rawTurbidityAdc: finiteOrNull(reading.sensorHealth?.turbidity.rawAdc),
  provisionalTurbidity: verifiedDiagnosticValue(reading, 'turbidity'),
  rawOrpAdc: finiteOrNull(reading.sensorHealth?.orp.rawAdc),
  provisionalOrp: verifiedDiagnosticValue(reading, 'orp'),
});

export const readingsForDevice = (readings: WaterQualityReading[], deviceId?: string): WaterQualityReading[] =>
  deviceId ? readings.filter((reading) => reading.deviceId === deviceId) : readings;
