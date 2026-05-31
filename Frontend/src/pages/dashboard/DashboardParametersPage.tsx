import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardIcon, PageHeader, StatusBadge } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import type { WaterQualityStats } from '../../types/water';

type ParameterKey = 'temperature' | 'ph' | 'do' | 'turbidity' | 'ammonia';

const parameterCards: Array<{
  key: ParameterKey;
  label: string;
  unit: string;
  color: string;
  fill: string;
  normal: (value: number) => boolean;
}> = [
  { key: 'temperature', label: 'Temperature', unit: 'C', color: '#fb923c', fill: '#7c2d12', normal: (value) => value >= 24 && value <= 30 },
  { key: 'ph', label: 'pH Level', unit: '', color: '#a78bfa', fill: '#4c1d95', normal: (value) => value >= 6.5 && value <= 8.5 },
  { key: 'do', label: 'Dissolved Oxygen', unit: 'mg/L', color: '#34d399', fill: '#064e3b', normal: (value) => value >= 5 },
  { key: 'turbidity', label: 'Turbidity', unit: 'NTU', color: '#facc15', fill: '#713f12', normal: (value) => value <= 50 },
  { key: 'ammonia', label: 'Ammonia', unit: 'ppm', color: '#2dd4bf', fill: '#134e4a', normal: (value) => value <= 0.25 },
];

const formatValue = (value: number, unit: string) => `${value.toFixed(unit === '' ? 2 : 1)}${unit ? ` ${unit}` : ''}`;

const DashboardParametersPage: React.FC = () => {
  const { statistics, chartData } = useDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader title="Parameters" subtitle="Detailed sensor evidence from the latest monitoring window" tone="cyan" icon={<DashboardIcon name="chart" />} />

      {statistics ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {parameterCards.map((item) => {
            const stats = statistics[item.key] as WaterQualityStats[ParameterKey];
            const isNormal = item.normal(stats.current);

            return (
              <div key={item.key} className="rounded-xl border border-white/10 bg-[#14151b] p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-300">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </h3>
                    <p className="mt-1 text-2xl font-bold text-white">{formatValue(stats.current, item.unit)}</p>
                  </div>
                  <StatusBadge label={isNormal ? 'Normal' : 'Needs attention'} tone={isNormal ? 'emerald' : 'amber'} />
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-[#101117] p-3 text-xs">
                  <div><p className="text-gray-500">Average</p><p className="font-semibold text-gray-200">{formatValue(stats.average, item.unit)}</p></div>
                  <div><p className="text-gray-500">Min</p><p className="font-semibold text-gray-200">{formatValue(stats.min, item.unit)}</p></div>
                  <div><p className="text-gray-500">Max</p><p className="font-semibold text-gray-200">{formatValue(stats.max, item.unit)}</p></div>
                </div>

                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData.slice(-20)}>
                    <defs>
                      <linearGradient id={`${item.key}-gradient`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={item.color} stopOpacity={0.5} />
                        <stop offset="55%" stopColor={item.fill} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={item.fill} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2c35" vertical={false} />
                    <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#101014', border: '1px solid #2a2c35', borderRadius: '10px', color: '#f3f4f6' }} />
                    <Area
                      type="monotone"
                      dataKey={item.key}
                      stroke={item.color}
                      fill={`url(#${item.key}-gradient)`}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: item.color }}
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#14151b] p-8 text-center text-gray-400">Loading sensor data...</div>
      )}
    </div>
  );
};

export default DashboardParametersPage;
