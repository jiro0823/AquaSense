import { SensorHealthPanel, AmmoniaSpeciationCard } from '../../components/WaterQuality/SensorHealthPanel';
import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import type { WaterQualityStats } from '../../types/water';

type ParameterKey = 'temperature' | 'ph' | 'do' | 'turbidity' | 'ammonia';

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
  { key: 'temperature', label: 'Temperature', unit: 'C', color: '#f59e0b', normal: (value) => value >= 24 && value <= 32, normalLabel: 'Normal', warnLabel: 'Needs attention' },
  { key: 'ph', label: 'pH Level', unit: '', color: '#3b82f6', normal: (value) => value >= 6.5 && value <= 8.5, normalLabel: 'Normal', warnLabel: 'Needs attention' },
  { key: 'do', label: 'Dissolved Oxygen', unit: 'mg/L', color: '#22c55e', normal: (value) => value >= 5, normalLabel: 'Normal', warnLabel: 'Needs attention' },
  { key: 'turbidity', label: 'Turbidity', unit: 'NTU', color: '#a855f7', normal: (value) => value < 25, normalLabel: 'Normal', warnLabel: 'Needs attention' },
  { key: 'ammonia', label: 'NH3 fraction of TAN', unit: '%', color: '#ef4444', normal: () => false, normalLabel: 'Preliminary', warnLabel: 'TAN required' },
  { key: 'riskScore', label: 'Mortality Risk Score', unit: '%', color: '#ef4444', normal: (value) => value <= 25, normalLabel: 'Low Risk', warnLabel: 'Elevated' },
];

const formatValue = (value: number|null, unit: string) => value === null ? '--' : `${value.toFixed(unit === '' ? 2 : 1)}${unit ? ` ${unit}` : ''}`;

const DashboardParametersPage: React.FC = () => {
  const { statistics, chartData, predictiveWarning, latestReading } = useDashboardData();

  const currentRiskScore = predictiveWarning?.riskScore ?? null;

  const riskChartData = useMemo(() => {
    return chartData.slice(-20).map((point) => ({
      ...point,
      riskScore: null,
    }));
  }, [chartData, currentRiskScore]);

  const riskStats: CardStats = useMemo(() => {
    const values: number[] = []; // No historical predictions were supplied; do not fabricate a trend.
    if (!values.length) return { current: currentRiskScore, average: currentRiskScore, min: currentRiskScore, max: currentRiskScore };
    return {
      current: currentRiskScore,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [riskChartData, currentRiskScore]);

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      <header className="shrink-0 flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-2xl p-3">
        <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
          <span className="text-blue-600"><DashboardIcon name="chart" /></span>
        </div>
        <div>
          <h1 className="text-base lg:text-lg font-bold tracking-tight text-gray-900">Parameters</h1>
          <p className="text-xs text-gray-500 mt-0.5">Detailed sensor evidence from the latest monitoring window</p>
        </div>
      </header>

      <SensorHealthPanel reading={latestReading} />
      {statistics ? (
        <section className="lg:flex-1 lg:min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-2.5">
          {parameterCards.map((item) => {
            const isRisk = item.key === 'riskScore';
<<<<<<< Updated upstream
=======
            if(item.key==='ammonia') return <AmmoniaSpeciationCard key={item.key} reading={latestReading} />;
            if(isRisk && currentRiskScore===null) return <div key={item.key} className="rounded-xl bg-white p-4 text-xs">Mortality risk: INSUFFICIENT VALID SENSOR DATA</div>;
            if(item.key==='turbidity' && latestReading?.turbidityUnit!=='NTU') return <div key={item.key} className="rounded-xl bg-white p-4 text-xs">Turbidity: {latestReading?.turbidity ?? '--'} raw ADC. NTU conversion requires formal calibration.</div>;
>>>>>>> Stashed changes
            if (item.key === 'do' && latestReading?.doMeasured === false) {
              return <div key={item.key} className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
                <h3 className="font-semibold text-gray-900">Dissolved Oxygen</h3>
                <p className="mt-2">Not measured. Connect a calibrated oxygen sensor to enable oxygen alerts.</p>
              </div>;
            }
            const stats: CardStats = isRisk ? riskStats : (statistics[item.key as ParameterKey] as WaterQualityStats[ParameterKey]);
            const isNormal = stats.current!==null && item.normal(stats.current);
            const chart = isRisk ? riskChartData : chartData.slice(-20);

            return (
              <div key={item.key} className="rounded-xl border border-gray-200 bg-white shadow-sm p-2 flex flex-col min-h-[180px] lg:min-h-0">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                    <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.label}</span>
                  </h3>
                  <span className="text-xs font-bold text-gray-900 shrink-0">{formatValue(stats.current, item.unit)}</span>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2 shrink-0">
                  <p className="text-[9px] text-gray-400 truncate">
                    Avg {formatValue(stats.average, item.unit)} · Min {formatValue(stats.min, item.unit)} · Max {formatValue(stats.max, item.unit)}
                  </p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0 ${isNormal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <span className={`h-1 w-1 rounded-full ${isNormal ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {isNormal ? item.normalLabel : item.warnLabel}
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
