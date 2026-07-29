import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardIcon, MetricCard, PageHeader, Panel, StatusBadge } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import { apiClient } from '../../services/apiClient';

type PumpState = 'ON' | 'OFF';
type WaterChangeMode = 'manual' | 'automatic';
type CyclePhase = 'idle' | 'draining' | 'filling';

interface WaterChangeEvent {
  id: string;
  at: string;
  trigger: 'manual' | 'automatic';
  reason: string;
}

interface WaterChangeState {
  mode: WaterChangeMode;
  drain: PumpState;
  fill: PumpState;
  lastChangedAt: string | null;
  history: WaterChangeEvent[];
}

const STORAGE_KEY = 'waterChangeState';
const DRAIN_DURATION_MS = 2500;
const FILL_DURATION_MS = 2500;
const MAX_HISTORY = 100;

const loadWaterChangeState = (): WaterChangeState => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<WaterChangeState>;
    return {
      mode: saved.mode || 'automatic',
      drain: saved.drain || 'OFF',
      fill: saved.fill || 'OFF',
      lastChangedAt: saved.lastChangedAt || null,
      history: saved.history || [],
    };
  } catch {
    return { mode: 'automatic', drain: 'OFF', fill: 'OFF', lastChangedAt: null, history: [] };
  }
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const notifyFarmer = async (message: string) => {
  const trimmed = message.length > 160 ? `${message.slice(0, 157)}...` : message;
  try {
    await apiClient.post('/sms/test', { message: trimmed });
  } catch {
    // best-effort notification; the water change is still logged locally
  }
};

const makeEvent = (trigger: 'manual' | 'automatic', reason: string): WaterChangeEvent => ({
  id: `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  at: new Date().toISOString(),
  trigger,
  reason,
});

const DashboardWaterChangePage: React.FC = () => {
  const { predictiveWarning } = useDashboardData();
  const [state, setState] = useState<WaterChangeState>(loadWaterChangeState);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [cyclePhase, setCyclePhase] = useState<CyclePhase>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const runningRef = useRef(false);
  const autoHandledRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const riskLevel = predictiveWarning?.warningCard?.riskLevel || 'LOW';
  const riskCause = predictiveWarning?.warningCard?.cause || 'No active risk factors detected';

  const riskStatus = useMemo(() => {
    switch (riskLevel) {
      case 'CRITICAL':
        return { label: 'Critical', tone: 'rose' as const, detail: 'Not advisable for crayfish. Immediate water change required.' };
      case 'HIGH':
        return { label: 'Warning', tone: 'amber' as const, detail: 'Not advisable — action needed soon. Farmer notified by SMS.' };
      case 'MODERATE':
        return { label: 'Monitor', tone: 'cyan' as const, detail: 'Conditions are drifting from ideal ranges.' };
      default:
        return { label: 'Stable', tone: 'emerald' as const, detail: 'Water quality is within safe ranges for crayfish.' };
    }
  }, [riskLevel]);

  const logEvent = (trigger: 'manual' | 'automatic', reason: string) => {
    const event = makeEvent(trigger, reason);
    setState((s) => ({ ...s, lastChangedAt: event.at, history: [event, ...s.history].slice(0, MAX_HISTORY) }));
  };

  const runWaterChangeCycle = useCallback(async (trigger: 'manual' | 'automatic', reason: string) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setCycleRunning(true);
    setNotice(null);

    setCyclePhase('draining');
    setState((s) => ({ ...s, mode: trigger === 'automatic' ? s.mode : 'manual', drain: 'ON', fill: 'OFF' }));
    await delay(DRAIN_DURATION_MS);

    setCyclePhase('filling');
    setState((s) => ({ ...s, drain: 'OFF', fill: 'ON' }));
    await delay(FILL_DURATION_MS);

    const event = makeEvent(trigger, reason);
    setState((s) => ({ ...s, fill: 'OFF', lastChangedAt: event.at, history: [event, ...s.history].slice(0, MAX_HISTORY) }));

    setCyclePhase('idle');
    setCycleRunning(false);
    runningRef.current = false;
    setNotice(`${trigger === 'automatic' ? 'Automatic' : 'Manual'} water change completed.`);

    if (trigger === 'automatic') {
      void notifyFarmer(
        `AquaSense ALERT: Critical water quality detected (${reason}). Automatic water change was started to protect your crayfish. Please check the tank soon.`
      );
    }
  }, []);

  useEffect(() => {
    if (riskLevel !== 'CRITICAL') {
      autoHandledRef.current = false;
      return;
    }
    if (state.mode !== 'automatic' || autoHandledRef.current) return;
    autoHandledRef.current = true;
    void runWaterChangeCycle('automatic', riskCause);
  }, [riskLevel, state.mode, riskCause, runWaterChangeCycle]);

  const setMode = (mode: WaterChangeMode) => {
    setState((s) => ({ ...s, mode }));
    logEvent('manual', `Switched to ${mode === 'automatic' ? 'Automatic' : 'Manual'} mode`);
  };

  const setDrain = (drain: PumpState) => {
    if (cycleRunning) return;
    setState((s) => ({ ...s, mode: 'manual', drain }));
    logEvent('manual', `Drain pump turned ${drain}`);
  };

  const setFill = (fill: PumpState) => {
    if (cycleRunning) return;
    setState((s) => ({ ...s, mode: 'manual', fill }));
    logEvent('manual', `Fill pump turned ${fill}`);
  };

  const runManualCycle = () => void runWaterChangeCycle('manual', 'Farmer requested manual water change');

  const cycleLabel = cyclePhase === 'draining' ? 'Draining…' : cyclePhase === 'filling' ? 'Filling…' : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Water Change" subtitle="Drain & fill pump control, automated by live water quality risk" tone="violet" icon={<DashboardIcon name="tank" />} />

      {(riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && (
        <div className={`rounded-xl border p-3 text-sm ${riskLevel === 'CRITICAL' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}>
          <span className="font-semibold">{riskLevel === 'CRITICAL' ? 'Critical: ' : 'Warning: '}</span>
          {riskStatus.detail} {riskCause ? `Cause: ${riskCause}.` : ''}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Water Quality Risk" value={riskStatus.label} detail={riskStatus.detail} tone={riskStatus.tone} icon={<DashboardIcon name="alert" />} />
        <MetricCard
          label="Mode"
          value={state.mode === 'automatic' ? 'Automatic' : 'Manual'}
          detail={cycleLabel || (state.lastChangedAt ? `Changed ${new Date(state.lastChangedAt).toLocaleString()}` : 'Default mode')}
          tone={state.mode === 'automatic' ? 'cyan' : 'amber'}
          icon={<DashboardIcon name="settings" />}
        />
        <MetricCard label="Drain Pump" value={state.drain} detail={state.drain === 'ON' ? 'Currently draining' : 'Idle'} tone={state.drain === 'ON' ? 'emerald' : 'slate'} icon={<DashboardIcon name="drain" />} />
        <MetricCard label="Fill Pump" value={state.fill} detail={state.fill === 'ON' ? 'Currently filling' : 'Idle'} tone={state.fill === 'ON' ? 'emerald' : 'slate'} icon={<DashboardIcon name="fill" />} />
        <MetricCard
          label="Last Water Change"
          value={state.lastChangedAt ? new Date(state.lastChangedAt).toLocaleDateString() : 'Never'}
          detail={state.history.length ? `${state.history.length} recorded change(s)` : 'No history yet'}
          tone="violet"
          icon={<DashboardIcon name="clock" />}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Panel title="Manual Pump Control" tone="emerald" icon={<StatusBadge label={cycleRunning ? cycleLabel || 'Running' : 'Ready'} tone={cycleRunning ? 'amber' : 'emerald'} />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400"><DashboardIcon name="drain" /> Drain Pump</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={cycleRunning} onClick={() => setDrain('ON')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-emerald-500">ON</button>
                <button disabled={cycleRunning} onClick={() => setDrain('OFF')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-rose-500">OFF</button>
              </div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400"><DashboardIcon name="fill" /> Fill Pump</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={cycleRunning} onClick={() => setFill('ON')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-emerald-500">ON</button>
                <button disabled={cycleRunning} onClick={() => setFill('OFF')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-rose-500">OFF</button>
              </div>
            </div>
          </div>
          <button disabled={cycleRunning} onClick={runManualCycle} className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-violet-500">
            {cycleRunning ? cycleLabel || 'Running…' : 'Run Full Water Change Now'}
          </button>
          <p className="mt-2 text-xs text-gray-500">Drains the tank first, then refills automatically. Manual commands switch the mode to Manual.</p>
        </Panel>

        <Panel title="Automatic Mode" tone="cyan" icon={<StatusBadge label={state.mode === 'automatic' ? 'Enabled' : 'Disabled'} tone={state.mode === 'automatic' ? 'emerald' : 'slate'} />}>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMode('automatic')} className="rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500">Auto ON</button>
            <button onClick={() => setMode('manual')} className="rounded-lg bg-slate-600 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-500">Auto OFF</button>
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-[#101117] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Automation rule</p>
              <StatusBadge label={riskStatus.label} tone={riskStatus.tone} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Runs a full drain-and-fill cycle automatically when predictive risk reaches <span className="text-rose-300 font-semibold">Critical</span>. At <span className="text-amber-300 font-semibold">Warning</span> level the system sends an SMS asking for immediate action without changing the water automatically.
            </p>
          </div>
          {notice && <p className="mt-3 text-xs font-semibold text-emerald-300">{notice}</p>}
        </Panel>
      </section>

      <section>
        <div className="flex flex-col rounded-xl border border-white/10 bg-[#14151b] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
              <DashboardIcon name="clock" />
              <span>Water Change History</span>
            </h3>
            <StatusBadge label={`${state.history.length} logged`} tone="violet" />
          </div>
          {state.history.length === 0 ? (
            <div className="flex min-h-[16rem] items-center justify-center text-center text-sm text-gray-500">No water changes recorded yet.</div>
          ) : (
            <div className="min-h-[16rem] max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {state.history.map((event) => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#101117] p-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{new Date(event.at).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{event.reason}</p>
                  </div>
                  <StatusBadge label={event.trigger === 'automatic' ? 'Automatic' : 'Manual'} tone={event.trigger === 'automatic' ? 'rose' : 'cyan'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardWaterChangePage;
