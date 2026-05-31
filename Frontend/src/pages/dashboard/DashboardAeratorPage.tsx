import React, { useEffect, useMemo, useState } from 'react';
import { DashboardIcon, MetricCard, PageHeader, Panel, StatusBadge } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';

type AeratorMode = 'manual' | 'automatic';
type AeratorPower = 'ON' | 'OFF';

interface AeratorState {
  mode: AeratorMode;
  power: AeratorPower;
  lastChangedAt: string | null;
}

const STORAGE_KEY = 'aeratorState';

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
    if (currentDo === 0) return { label: 'No DO data', tone: 'slate' as const, detail: 'Waiting for dissolved oxygen reading.' };
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
    <div className="space-y-6">
      <PageHeader title="Aerator" subtitle="Manual control and oxygen-based automatic mode" tone="cyan" icon={<DashboardIcon name="aerator" />} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Aerator State" value={effectivePower} detail={state.mode === 'automatic' ? 'Based on dissolved oxygen' : 'Manual command selected'} tone={effectivePower === 'ON' ? 'emerald' : 'slate'} icon={<DashboardIcon name="aerator" />} />
        <MetricCard label="Mode" value={state.mode === 'automatic' ? 'Auto' : 'Manual'} detail={state.lastChangedAt ? `Changed ${new Date(state.lastChangedAt).toLocaleString()}` : 'Default mode'} tone={state.mode === 'automatic' ? 'cyan' : 'amber'} icon={<DashboardIcon name="settings" />} />
        <MetricCard label="Dissolved Oxygen" value={currentDo ? `${currentDo.toFixed(2)} mg/L` : '--'} detail={oxygenStatus.detail} tone={oxygenStatus.tone} icon={<DashboardIcon name="pulse" />} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Manual Control" tone="amber" icon={<StatusBadge label={state.mode === 'manual' ? 'Active' : 'Standby'} tone={state.mode === 'manual' ? 'amber' : 'slate'} />}>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setPower('ON')} className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
              Turn ON
            </button>
            <button onClick={() => setPower('OFF')} className="rounded-lg bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500">
              Turn OFF
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">Manual commands override automatic behavior until automatic mode is enabled again.</p>
        </Panel>

        <Panel title="Automatic Mode" tone="cyan" icon={<StatusBadge label={state.mode === 'automatic' ? 'Enabled' : 'Disabled'} tone={state.mode === 'automatic' ? 'emerald' : 'slate'} />}>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMode('automatic')} className="rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
              Auto ON
            </button>
            <button onClick={() => setMode('manual')} className="rounded-lg bg-slate-600 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-500">
              Auto OFF
            </button>
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-[#101117] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Automation rule</p>
              <StatusBadge label={oxygenStatus.label} tone={oxygenStatus.tone} />
            </div>
            <p className="mt-2 text-xs text-gray-500">Run aerator when dissolved oxygen drops below 5.00 mg/L. Treat below 3.00 mg/L as critical.</p>
          </div>
        </Panel>
      </section>

      <Panel title="Aerator Details" tone="emerald" icon={<DashboardIcon name="pulse" />}>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-[#101117] p-3">
            <p className="font-semibold text-white">Control Source</p>
            <p className="mt-1 text-xs text-gray-500">
              {state.mode === 'automatic' ? 'Automatic mode is deciding from dissolved oxygen.' : 'Manual mode is using the farmer command.'}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#101117] p-3">
            <p className="font-semibold text-white">Oxygen Threshold</p>
            <p className="mt-1 text-xs text-gray-500">Auto ON below 5.00 mg/L. Critical condition below 3.00 mg/L.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#101117] p-3">
            <p className="font-semibold text-white">Last Change</p>
            <p className="mt-1 text-xs text-gray-500">
              {state.lastChangedAt ? new Date(state.lastChangedAt).toLocaleString() : 'No farmer command recorded yet.'}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default DashboardAeratorPage;
