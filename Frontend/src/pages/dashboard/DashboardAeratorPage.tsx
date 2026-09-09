import React, { useEffect, useMemo, useState } from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';

type AeratorMode = 'manual' | 'automatic';
type AeratorPower = 'ON' | 'OFF';
type Tone = 'emerald' | 'amber' | 'cyan' | 'rose' | 'gray';

interface AeratorState {
  mode: AeratorMode;
  power: AeratorPower;
  lastChangedAt: string | null;
}

const STORAGE_KEY = 'aeratorState';

const toneStyles: Record<Tone, { bg: string; text: string; dot: string; pillBg: string; pillText: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', pillBg: 'bg-emerald-100', pillText: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', pillBg: 'bg-amber-100', pillText: 'text-amber-700' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', dot: 'bg-cyan-500', pillBg: 'bg-cyan-100', pillText: 'text-cyan-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500', pillBg: 'bg-rose-100', pillText: 'text-rose-700' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', pillBg: 'bg-gray-100', pillText: 'text-gray-600' },
};

const Pill = ({ label, tone }: { label: string; tone: Tone }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${toneStyles[tone].pillBg} ${toneStyles[tone].pillText}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${toneStyles[tone].dot}`} />
    {label}
  </span>
);

const MetricTile = ({ label, value, detail, tone, icon }: { label: string; value: string; detail?: string; tone: Tone; icon: React.ReactNode }) => (
  <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-2.5 flex flex-col gap-1 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 truncate">{label}</span>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${toneStyles[tone].bg} ${toneStyles[tone].text}`}>{icon}</span>
    </div>
    <p className={`text-base font-bold leading-tight truncate ${toneStyles[tone].text}`}>{value}</p>
    {detail && <p className="text-[9px] text-gray-400 leading-snug line-clamp-2">{detail}</p>}
  </div>
);

const loadAeratorState = (): AeratorState => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<AeratorState>;
    return {
      mode: saved.mode || 'automatic',
      power: saved.power || 'OFF',
      lastChangedAt: saved.lastChangedAt || null,
    };
  } catch {
    return { mode: 'automatic', power: 'OFF', lastChangedAt: null };
  }
};

const DashboardAeratorPage: React.FC = () => {
  const { latestReading, statistics } = useDashboardData();
  const [state, setState] = useState<AeratorState>(loadAeratorState);
  const currentDo = latestReading?.do ?? statistics?.do.current ?? 0;
  const shouldRunAutomatically = state.mode === 'automatic' && currentDo > 0 && currentDo < 5;
  const effectivePower: AeratorPower = state.mode === 'automatic' ? (shouldRunAutomatically ? 'ON' : 'OFF') : state.power;

  const oxygenStatus = useMemo(() => {
    if (currentDo === 0) return { label: 'No DO data', tone: 'gray' as const, detail: 'Waiting for dissolved oxygen reading.' };
    if (currentDo < 3) return { label: 'Critical oxygen', tone: 'rose' as const, detail: 'Aerator should run continuously until oxygen recovers.' };
    if (currentDo < 5) return { label: 'Low oxygen', tone: 'amber' as const, detail: 'Automatic mode will turn the aerator on.' };
    return { label: 'Oxygen stable', tone: 'emerald' as const, detail: 'Automatic mode can keep the aerator on standby.' };
  }, [currentDo]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setMode = (mode: AeratorMode) => {
    setState((current) => ({ ...current, mode, lastChangedAt: new Date().toISOString() }));
  };

  const setPower = (power: AeratorPower) => {
    setState((current) => ({ ...current, mode: 'manual', power, lastChangedAt: new Date().toISOString() }));
  };

  return (
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0">
      <header className="shrink-0 flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-2xl p-3">
        <div className="bg-cyan-50 p-2 rounded-lg flex-shrink-0">
          <span className="text-cyan-600"><DashboardIcon name="aerator" /></span>
        </div>
        <div>
          <h1 className="text-base lg:text-lg font-bold tracking-tight text-gray-900">Aerator</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manual control and oxygen-based automatic mode</p>
        </div>
      </header>

      <section className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <MetricTile label="Aerator State" value={effectivePower} detail={state.mode === 'automatic' ? 'Based on dissolved oxygen' : 'Manual command selected'} tone={effectivePower === 'ON' ? 'emerald' : 'gray'} icon={<DashboardIcon name="aerator" />} />
        <MetricTile label="Mode" value={state.mode === 'automatic' ? 'Auto' : 'Manual'} detail={state.lastChangedAt ? `Changed ${new Date(state.lastChangedAt).toLocaleString()}` : 'Default mode'} tone={state.mode === 'automatic' ? 'cyan' : 'amber'} icon={<DashboardIcon name="settings" />} />
        <MetricTile label="Dissolved Oxygen" value={currentDo ? `${currentDo.toFixed(2)} mg/L` : '--'} detail={oxygenStatus.detail} tone={oxygenStatus.tone} icon={<DashboardIcon name="pulse" />} />
      </section>

      <section className="shrink-0 grid grid-cols-1 xl:grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Manual Control
            </h3>
            <Pill label={state.mode === 'manual' ? 'Active' : 'Standby'} tone={state.mode === 'manual' ? 'amber' : 'gray'} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setPower('ON')} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
              Turn ON
            </button>
            <button onClick={() => setPower('OFF')} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors">
              Turn OFF
            </button>
          </div>
          <p className="mt-2.5 text-[10px] text-gray-400">Manual commands override automatic behavior until automatic mode is enabled again.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Automatic Mode
            </h3>
            <Pill label={state.mode === 'automatic' ? 'Enabled' : 'Disabled'} tone={state.mode === 'automatic' ? 'emerald' : 'gray'} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setMode('automatic')} className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-700 transition-colors">
              Auto ON
            </button>
            <button onClick={() => setMode('manual')} className="rounded-lg bg-gray-500 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-600 transition-colors">
              Auto OFF
            </button>
          </div>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-900">Automation rule</p>
              <Pill label={oxygenStatus.label} tone={oxygenStatus.tone} />
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">Run aerator when dissolved oxygen drops below 5.00 mg/L. Treat below 3.00 mg/L as critical.</p>
          </div>
        </div>
      </section>

      <section className="lg:flex-1 lg:min-h-0 rounded-xl border border-gray-200 bg-white shadow-sm p-3">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Aerator Details
        </h3>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <p className="text-xs font-semibold text-gray-900">Control Source</p>
            <p className="mt-1 text-[10px] text-gray-500 leading-relaxed">
              {state.mode === 'automatic' ? 'Automatic mode is deciding from dissolved oxygen.' : 'Manual mode is using the farmer command.'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <p className="text-xs font-semibold text-gray-900">Oxygen Threshold</p>
            <p className="mt-1 text-[10px] text-gray-500 leading-relaxed">Auto ON below 5.00 mg/L. Critical condition below 3.00 mg/L.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <p className="text-xs font-semibold text-gray-900">Last Change</p>
            <p className="mt-1 text-[10px] text-gray-500 leading-relaxed">
              {state.lastChangedAt ? new Date(state.lastChangedAt).toLocaleString() : 'No farmer command recorded yet.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardAeratorPage;
