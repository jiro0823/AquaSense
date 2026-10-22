import { SensorHealthPanel, AmmoniaSpeciationCard } from '../../components/WaterQuality/SensorHealthPanel';
import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import type { WaterQualityStats } from '../../types/water';
import { TanMeasurementEntryForm } from '../../components/WaterQuality/TanMeasurementEntryForm';
import { currentWaterSensorValue } from '../../components/WaterQuality/sensorDisplay';

type ParameterKey = 'temperature' | 'ph' | 'orp' | 'turbidity' | 'ammonia';

type CardStats = { current: number|null; average: number|null; min: number|null; max: number|null };

type CardConfig = {
  key: ParameterKey | 'riskScore';
  label: string;
  unit: string;
  color: string;
  normal: (value: number) => boolean;
  normalLabel: string;
  warnLabel: string;
};

const parameterCards: CardConfig[] = [
  { key: 'temperature', label: 'Temperature (growth guidance 26-29 °C)', unit: 'C', color: '#f59e0b', normal: (value) => value >= 26 && value <= 29, normalLabel: 'Within guidance', warnLabel: 'Outside guidance' },
  { key: 'ph', label: 'pH Level (culture guidance 7-8.5)', unit: '', color: '#3b82f6', normal: (value) => value >= 7 && value <= 8.5, normalLabel: 'Within guidance', warnLabel: 'Outside guidance' },
  { key: 'orp', label: 'ORP / Redox (reported; uncalibrated)', unit: 'mV', color: '#22c55e', normal: () => false, normalLabel: 'Not classified', warnLabel: 'Not classified' },
  { key: 'turbidity', label: 'Turbidity', unit: 'NTU', color: '#a855f7', normal: () => false, normalLabel: 'Unclassified', warnLabel: 'Unclassified' },
  { key: 'ammonia', label: 'NH3 fraction of TAN', unit: '%', color: '#ef4444', normal: () => false, normalLabel: 'Preliminary', warnLabel: 'TAN required' },
  { key: 'riskScore', label: 'Risk Model Status', unit: '', color: '#6b7280', normal: () => false, normalLabel: 'Unavailable', warnLabel: 'Unavailable' },
];

const formatValue = (value: number|null, unit: string) => value === null ? '--' : `${value.toFixed(unit === '' ? 2 : 1)}${unit ? ` ${unit}` : ''}`;

const DashboardParametersPage: React.FC = () => {
  const { statistics, chartData, predictiveWarning, latestReading, error, latestTanMeasurement, tanLoading, tanError, addTanMeasurement } = useDashboardData();

  const riskModelValidated = predictiveWarning?.modelStatus === 'READY'
    && predictiveWarning.validationStatus === 'VALIDATED'
    && predictiveWarning.analysisStatus === 'AVAILABLE'
    && Number.isFinite(predictiveWarning.riskScore);
  const currentRiskScore = riskModelValidated ? predictiveWarning?.riskScore ?? null : null;
  const currentRiskLevel = riskModelValidated ? predictiveWarning?.warningCard?.riskLevel ?? 'UNAVAILABLE' : 'UNAVAILABLE';

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      <header className="shrink-0 flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-2xl p-3">
        <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
          <span className="text-blue-600"><DashboardIcon name="chart" /></span>
        </div>
        <div>
          <h1 className="text-base lg:text-lg font-bold tracking-tight text-gray-900">Parameters</h1>
          <p className="text-xs text-gray-500 mt-0.5">Detailed sensor evidence from the latest monitoring window{statistics?.stale ? ' · Live statistics stale while disconnected' : ''}</p>
        </div>
      </header>

      {error && <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Connection state: {error}</div>}
      {tanLoading && !latestTanMeasurement && <div role="status" className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">Loading TAN history…</div>}
      {tanError && <div role="alert" className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">TAN history unavailable: {tanError}</div>}
      <SensorHealthPanel reading={latestReading} />
      <TanMeasurementEntryForm onSaved={addTanMeasurement} />
      {statistics ? (
        <section className="lg:flex-1 lg:min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-2.5">
          {parameterCards.map((item) => {
            const isRisk = item.key === 'riskScore';
            if(item.key==='ammonia') return <AmmoniaSpeciationCard key={item.key} measurement={latestTanMeasurement} />;
            if (isRisk) {
              return (
                <div key={item.key} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</h3>
                  <span className="text-xl font-bold text-gray-900">{currentRiskLevel}</span>
                  <p className="text-xs text-gray-500">
                    {currentRiskScore === null
                      ? 'No validated, commissioned risk model; no score is available.'
                      : `Validated model index: ${currentRiskScore.toFixed(2)} / 100.`}
                  </p>
                </div>
              );
            }
            if(item.key==='turbidity' && latestReading?.turbidityUnit!=='NTU') return <div key={item.key} className="rounded-xl bg-white p-4 text-xs">Turbidity: {latestReading?.turbidityUnit==='raw_adc' ? `${latestReading.sensorHealth?.turbidity.rawAdc ?? '--'} raw ADC. NTU conversion requires formal calibration.` : 'Unit unavailable; turbidity value is not interpreted or charted.'}</div>;
            const sensorStats: WaterQualityStats[ParameterKey] = statistics[item.key as ParameterKey];
            const stats: CardStats = { ...sensorStats, current: currentWaterSensorValue(latestReading, item.key as 'temperature'|'ph'|'orp'|'turbidity') };
            const sensorName = item.key === 'temperature' || item.key === 'ph' || item.key === 'orp' || item.key === 'turbidity' ? item.key : null;
            const health = sensorName ? latestReading?.sensorHealth?.[sensorName] : null;
            const isNormal = stats.current!==null && item.normal(stats.current);
            const sensorStatus = statistics.stale ? 'STALE' : !latestReading ? 'UNAVAILABLE' : !health ? 'UNKNOWN' :
              !health.valid || health.measurementValid===false ? (health.health==='STALE' ? 'STALE' : 'UNAVAILABLE') :
              health.health==='UNSTABLE' || health.stability==='UNSTABLE' ? 'UNSTABLE' :
              health.calibration!=='CALIBRATED' ? 'CALIBRATION REQUIRED' : isNormal ? item.normalLabel : item.warnLabel;
            const statusLabel = item.key==='turbidity' && sensorStatus===item.normalLabel ? 'UNCLASSIFIED · NO SPECIES NTU LIMIT' : sensorStatus;
            const statusQualified = !['STALE','UNAVAILABLE','UNKNOWN','UNSTABLE','CALIBRATION REQUIRED'].includes(statusLabel) && !statusLabel.startsWith('UNCLASSIFIED');
            const chart = chartData.filter(point=>item.key!=='turbidity' || point.turbidityUnit===latestReading?.turbidityUnit).slice(-20);
            const currentLabel = item.key==='orp' && stats.current!==null && health?.valid!==true
              ? `Reported ${formatValue(stats.current, item.unit)} · unverified`
              : formatValue(stats.current, item.unit);

            return (
              <div key={item.key} className="rounded-xl border border-gray-200 bg-white shadow-sm p-2 flex flex-col min-h-[180px] lg:min-h-0">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                    <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.label}</span>
                  </h3>
                  <span className="text-xs font-bold text-gray-900 shrink-0">{currentLabel}</span>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2 shrink-0">
                  <p className="text-[9px] text-gray-400 truncate">
                    Avg {formatValue(stats.average, item.unit)} · Min {formatValue(stats.min, item.unit)} · Max {formatValue(stats.max, item.unit)}
                  </p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0 ${statusQualified && isNormal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <span className={`h-1 w-1 rounded-full ${statusQualified && isNormal ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {statusLabel}
                  </span>
                </div>

                <div className="flex-1 min-h-0 mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`${item.key}-gradient`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={item.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={item.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 9 }} tickMargin={4} minTickGap={20} />
                      <YAxis stroke="#9ca3af" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', color: '#111827', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Area
                        type="monotone"
                        dataKey={item.key}
                        stroke={item.color}
                        fill={`url(#${item.key}-gradient)`}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: item.color }}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center text-gray-500">Loading sensor data...</div>
      )}
    </div>
  );
};

export default DashboardParametersPage;
