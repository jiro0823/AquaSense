import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import { apiClient } from '../../services/apiClient';

type PumpState = 'ON' | 'OFF';
type WaterChangeMode = 'manual' | 'automatic';
type CyclePhase = 'idle' | 'draining' | 'filling';
type Tone = 'emerald' | 'amber' | 'cyan' | 'rose' | 'violet' | 'gray';

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

const toneStyles: Record<Tone, { bg: string; text: string; dot: string; pillBg: string; pillText: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', pillBg: 'bg-emerald-100', pillText: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', pillBg: 'bg-amber-100', pillText: 'text-amber-700' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', dot: 'bg-cyan-500', pillBg: 'bg-cyan-100', pillText: 'text-cyan-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500', pillBg: 'bg-rose-100', pillText: 'text-rose-700' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500', pillBg: 'bg-violet-100', pillText: 'text-violet-700' },
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
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0">
      <header className="flex items-center gap-3 p-3 bg-white border border-gray-200 shadow-sm shrink-0 rounded-2xl">
        <div className="flex-shrink-0 p-2 rounded-lg bg-violet-50">
          <span className="text-violet-600"><DashboardIcon name="tank" /></span>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-gray-900 lg:text-lg">Water Change</h1>
          <p className="text-xs text-gray-500 mt-0.5">Drain & fill pump control, automated by live water quality risk</p>
        </div>
      </header>

      {(riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && (
        <div className={`shrink-0 rounded-xl border p-2.5 text-xs flex items-start gap-2 ${riskLevel === 'CRITICAL' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className={`mt-0.5 shrink-0 ${riskLevel === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}><DashboardIcon name="alert" /></span>
          <p><span className="font-bold">{riskLevel === 'CRITICAL' ? 'Critical: ' : 'Warning: '}</span>{riskStatus.detail} {riskCause ? `Cause: ${riskCause}.` : ''}</p>
        </div>
      )}

      <section className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <MetricTile label="Water Quality Risk" value={riskStatus.label} detail={riskStatus.detail} tone={riskStatus.tone} icon={<DashboardIcon name="alert" />} />
        <MetricTile
          label="Mode"
          value={state.mode === 'automatic' ? 'Automatic' : 'Manual'}
          detail={cycleLabel || (state.lastChangedAt ? `Changed ${new Date(state.lastChangedAt).toLocaleString()}` : 'Default mode')}
          tone={state.mode === 'automatic' ? 'cyan' : 'amber'}
          icon={<DashboardIcon name="settings" />}
        />
        <MetricTile label="Drain Pump" value={state.drain} detail={state.drain === 'ON' ? 'Currently draining' : 'Idle'} tone={state.drain === 'ON' ? 'emerald' : 'gray'} icon={<DashboardIcon name="drain" />} />
        <MetricTile label="Fill Pump" value={state.fill} detail={state.fill === 'ON' ? 'Currently filling' : 'Idle'} tone={state.fill === 'ON' ? 'emerald' : 'gray'} icon={<DashboardIcon name="fill" />} />
        <MetricTile
          label="Last Water Change"
          value={state.lastChangedAt ? new Date(state.lastChangedAt).toLocaleDateString() : 'Never'}
          detail={state.history.length ? `${state.history.length} recorded change(s)` : 'No history yet'}
          tone="violet"
          icon={<DashboardIcon name="clock" />}
        />
      </section>

      <section className="shrink-0 grid grid-cols-1 xl:grid-cols-2 gap-2.5">
        <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Manual Pump Control
            </h3>
            <Pill label={cycleRunning ? cycleLabel || 'Running' : 'Ready'} tone={cycleRunning ? 'amber' : 'emerald'} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><DashboardIcon name="drain" /> Drain Pump</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={cycleRunning} onClick={() => setDrain('ON')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors">ON</button>
                <button disabled={cycleRunning} onClick={() => setDrain('OFF')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-rose-700 transition-colors">OFF</button>
              </div>
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><DashboardIcon name="fill" /> Fill Pump</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={cycleRunning} onClick={() => setFill('ON')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors">ON</button>
                <button disabled={cycleRunning} onClick={() => setFill('OFF')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-rose-700 transition-colors">OFF</button>
              </div>
            </div>
          </div>
          <button disabled={cycleRunning} onClick={runManualCycle} className="w-full px-4 py-2 mt-3 text-xs font-semibold text-white transition-colors rounded-lg bg-violet-600 disabled:opacity-40 hover:bg-violet-700">
            {cycleRunning ? cycleLabel || 'Running…' : 'Run Full Water Change Now'}
          </button>
          <p className="mt-2 text-[10px] text-gray-400">Drains the tank first, then refills automatically. Manual commands switch the mode to Manual.</p>
        </div>

        <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Automatic Mode
            </h3>
            <Pill label={state.mode === 'automatic' ? 'Enabled' : 'Disabled'} tone={state.mode === 'automatic' ? 'emerald' : 'gray'} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setMode('automatic')} className="px-4 py-2 text-xs font-semibold text-white transition-colors rounded-lg bg-cyan-600 hover:bg-cyan-700">Auto ON</button>
            <button onClick={() => setMode('manual')} className="px-4 py-2 text-xs font-semibold text-white transition-colors bg-gray-500 rounded-lg hover:bg-gray-600">Auto OFF</button>
          </div>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-900">Automation rule</p>
              <Pill label={riskStatus.label} tone={riskStatus.tone} />
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
              Runs a full drain-and-fill cycle automatically when predictive risk reaches <span className="font-semibold text-rose-600">Critical</span>. At <span className="font-semibold text-amber-600">Warning</span> level the system sends an SMS asking for immediate action without changing the water automatically.
            </p>
          </div>
          {notice && <p className="mt-2.5 text-[10px] font-semibold text-emerald-600">{notice}</p>}
        </div>
      </section>

      <section className="flex flex-col p-3 bg-white border border-gray-200 shadow-sm lg:flex-1 lg:min-h-0 rounded-xl">
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            <DashboardIcon name="clock" />
            <span>Water Change History</span>
          </h3>
          <Pill label={`${state.history.length} logged`} tone="violet" />
        </div>
        {state.history.length === 0 ? (
          <div className="flex flex-1 min-h-[10rem] items-center justify-center text-center text-xs text-gray-400">No water changes recorded yet.</div>
        ) : (
          <div className="flex-1 min-h-[10rem] lg:min-h-0 space-y-1.5 overflow-y-auto pr-1">
            {state.history.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{new Date(event.at).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">{event.reason}</p>
                </div>
                <Pill label={event.trigger === 'automatic' ? 'Automatic' : 'Manual'} tone={event.trigger === 'automatic' ? 'rose' : 'cyan'} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardWaterChangePage;
