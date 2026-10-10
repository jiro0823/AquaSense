import React, { useCallback, useEffect, useState } from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
<<<<<<< HEAD
import { apiClient, getApiErrorMessage } from '../../services/apiClient';
=======
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
>>>>>>> origin/feature/major-improvements

interface Device { deviceId: string; name?: string; isActive: boolean }
interface HardwareState {
  deviceId: string;
  online: boolean;
  receivedAt: string | null;
  state: null | { fillPump: boolean; drainPump: boolean; waterPhase: 'IDLE' | 'DRAINING' | 'TRANSITION' | 'REFILLING' | 'COMPLETE' | 'FAULT'; fault: string; automation: boolean };
}
interface ApiCommand { id: string; action: string; status: 'PENDING' | 'ACKED' | 'EXPIRED'; result?: string | null; expiresAt?: string }
type TrackedCommand = Omit<ApiCommand, 'status'> & { status: ApiCommand['status'] | 'TIMEOUT' };

const WaterChangePage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [hardware, setHardware] = useState<HardwareState | null>(null);
  const [trackedCommand, setTrackedCommand] = useState<TrackedCommand | null>(null);
  const [durationSeconds, setDurationSeconds] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

<<<<<<< HEAD
  const refresh = useCallback(async (selectedId = deviceId) => {
    if (!selectedId) return;
    try {
      const response = await apiClient.get<HardwareState & { commands?: ApiCommand[] }>(`/hardware/state?deviceId=${encodeURIComponent(selectedId)}`);
      setHardware(response.data);
      setTrackedCommand((current) => {
        if (!current || current.status !== 'PENDING') return current;
        const updated = response.data.commands?.find((item) => item.id === current.id);
        if (updated && updated.status !== 'PENDING') return { ...current, ...updated };
        if (current.expiresAt && Date.now() >= new Date(current.expiresAt).getTime()) return { ...current, status: 'TIMEOUT' };
        return updated ? { ...current, ...updated } : current;
      });
      setLoadedAt(Date.now());
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Unable to read device state.'));
    }
  }, [deviceId]);

  useEffect(() => {
    let active = true;
    void apiClient.get<Device[]>('/devices').then((response) => {
      if (!active) return;
      const available = (response.data || []).filter((device) => device.isActive);
      setDevices(available);
      setDeviceId((current) => current || available[0]?.deviceId || '');
    }).catch((cause) => { if (active) setError(getApiErrorMessage(cause, 'Unable to load registered devices.')); });
    return () => { active = false; };
=======
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

  const riskLevel = predictiveWarning?.warningCard?.riskLevel;
  const riskCause = predictiveWarning?.warningCard?.cause || 'Risk information is unavailable; review current sensor readings.';

  const riskStatus = useMemo(() => {
    switch (riskLevel) {
      case 'CRITICAL':
        return { label: 'Critical', tone: 'rose' as const, detail: 'Risk is classified as critical. Check the tank and follow your farm procedure; this page cannot operate physical pumps.' };
      case 'HIGH':
        return { label: 'Warning', tone: 'amber' as const, detail: 'Risk warning only. Review the readings; no physical water-change command is sent from this page.' };
      case 'MODERATE':
        return { label: 'Monitor', tone: 'cyan' as const, detail: 'Conditions are drifting from ideal ranges.' };
      case 'LOW':
        return { label: 'Stable', tone: 'emerald' as const, detail: 'Water quality is within safe ranges for crayfish.' };
      default:
        return { label: 'Unavailable', tone: 'gray' as const, detail: 'Risk level is unavailable or unrecognized. Review current sensor data; water safety cannot be determined here.' };
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
    setNotice(`${trigger === 'automatic' ? 'Automatic' : 'Manual'} water-change simulation completed. No physical pump operation was confirmed.`);

>>>>>>> origin/feature/major-improvements
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    void refresh(deviceId);
    const timer = window.setInterval(() => void refresh(deviceId), 5000);
    return () => window.clearInterval(timer);
  }, [deviceId, refresh]);

  const command = async (action: 'DRAIN' | 'FILL' | 'WATER_EXCHANGE' | 'WATER_STOP') => {
    if (!deviceId || pending) return;
    const durationMs = action === 'WATER_STOP' ? undefined : Number(durationSeconds) * 1000;
    const seconds = Number(durationSeconds);
    if (action !== 'WATER_STOP' && (!Number.isInteger(seconds) || seconds < 1 || seconds > 60)) {
      setError('Enter a pump duration from 1 to 60 seconds.');
      return;
    }
<<<<<<< HEAD
    setPending(true);
    setError(null);
    try {
      const response = await apiClient.post<ApiCommand>('/hardware/commands', { deviceId, action, ...(durationMs ? { durationMs } : {}) });
      setTrackedCommand(response.data);
      await refresh(deviceId);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Command could not be queued.'));
    } finally {
      setPending(false);
      window.setTimeout(() => void refresh(deviceId), 1200);
    }
  };

  const state = hardware?.state;
  const fresh = hardware?.online === true && loadedAt !== null && Date.now() - loadedAt < 20000;
  const stateText = !hardware || !fresh ? 'OFFLINE / STALE' : state?.waterPhase || 'UNKNOWN';
  const commandStatus = !trackedCommand ? 'No command sent in this session'
    : trackedCommand.status === 'PENDING' ? 'QUEUED — awaiting device acknowledgement'
      : trackedCommand.status === 'TIMEOUT' ? 'TIMEOUT — device acknowledgement was not received before command expiry'
        : trackedCommand.status === 'EXPIRED' ? 'EXPIRED — device did not execute this command'
          : trackedCommand.result === 'accepted' ? 'DEVICE ACKNOWLEDGED — command accepted'
            : `DEVICE REJECTED — ${trackedCommand.result || 'execution was not accepted'}`;

  return <div className="flex flex-col gap-3">
    <header className="flex items-center gap-3 p-3 bg-white border border-gray-200 shadow-sm rounded-2xl">
      <span className="p-2 rounded-lg bg-violet-50 text-violet-600"><DashboardIcon name="tank" /></span>
      <div><h1 className="text-lg font-bold text-gray-900">Water Change</h1><p className="text-xs text-gray-500">Timed pump commands through the authenticated device API. Reported output state is logical state, not physical feedback.</p></div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <label className="block text-xs font-semibold text-gray-600" htmlFor="water-device">Device</label>
        <select id="water-device" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); setHardware(null); setTrackedCommand(null); }} className="mt-1 w-full rounded border p-2 text-sm">
          {devices.length === 0 && <option value="">No active registered device</option>}
          {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.name || device.deviceId} ({device.deviceId})</option>)}
        </select>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Device</span><p className="font-semibold">{fresh ? 'ONLINE' : 'OFFLINE / STALE'}</p></div>
          <div><span className="text-gray-500">Water phase</span><p className="font-semibold">{stateText}</p></div>
          <div><span className="text-gray-500">Drain output (logical)</span><p className="font-semibold">{fresh && state ? (state.drainPump ? 'ON' : 'OFF') : 'UNKNOWN'}</p></div>
          <div><span className="text-gray-500">Fill output (logical)</span><p className="font-semibold">{fresh && state ? (state.fillPump ? 'ON' : 'OFF') : 'UNKNOWN'}</p></div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">State reported {hardware?.receivedAt ? new Date(hardware.receivedAt).toLocaleString() : 'not yet reported'}{state?.fault ? ` · Fault: ${state.fault}` : ''}</p>
        <p className="mt-1 text-[11px] text-gray-500">Automation {state?.automation ? 'enabled on device' : 'disabled on device'}. The device firmware owns automatic water-change decisions; predictive risk on this page does not start pumps.</p>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800">Manual water control</h2>
        <label className="mt-3 block text-xs font-semibold text-gray-600" htmlFor="pump-duration">Duration (seconds, required for each pump phase)</label>
        <input id="pump-duration" type="number" min="1" max="60" step="1" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} placeholder="Enter duration (max 60 seconds)" className="mt-1 w-full rounded border p-2 text-sm" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={!deviceId || pending} onClick={() => void command('DRAIN')} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Drain for duration</button>
          <button disabled={!deviceId || pending} onClick={() => void command('FILL')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Fill for duration</button>
          <button disabled={!deviceId || pending} onClick={() => void command('WATER_EXCHANGE')} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Exchange (same duration per phase)</button>
          <button disabled={!deviceId || pending} onClick={() => void command('WATER_STOP')} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Stop</button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Each pump phase has a 60-second initial hard cap. Water Exchange applies the entered duration separately to drain and refill.</p>
        <p className="mt-3 text-xs" aria-live="polite">{pending ? 'Submitting command…' : commandStatus}</p>
        {trackedCommand && <p className="mt-1 text-[10px] text-gray-500">Command {trackedCommand.id} · {trackedCommand.action}</p>}
        {loadedAt && <p className="mt-1 text-[10px] text-gray-400">Last state poll: {new Date(loadedAt).toLocaleTimeString()}</p>}
        {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
      </div>
    </section>
  </div>;
=======
    if (state.mode !== 'automatic' || autoHandledRef.current) return;
    autoHandledRef.current = true;
    void runWaterChangeCycle('automatic', riskCause);
  }, [riskLevel, state.mode, riskCause, runWaterChangeCycle]);

  const setMode = (mode: WaterChangeMode) => {
    setState((s) => ({ ...s, mode }));
    logEvent('manual', `Switched local simulation to ${mode === 'automatic' ? 'automatic demo' : 'manual demo'} mode`);
  };

  const setDrain = (drain: PumpState) => {
    if (cycleRunning) return;
    setState((s) => ({ ...s, mode: 'manual', drain, ...(drain === 'ON' ? { fill: 'OFF' as const } : {}) }));
    logEvent('manual', `Simulated drain state set to ${drain}`);
  };

  const setFill = (fill: PumpState) => {
    if (cycleRunning) return;
    setState((s) => ({ ...s, mode: 'manual', fill, ...(fill === 'ON' ? { drain: 'OFF' as const } : {}) }));
    logEvent('manual', `Simulated fill state set to ${fill}`);
  };

  const runManualCycle = () => void runWaterChangeCycle('manual', 'User requested a local water-change simulation');

  const cycleLabel = cyclePhase === 'draining' ? 'Simulating drain…' : cyclePhase === 'filling' ? 'Simulating refill…' : null;

  return (
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0">
      <header className="flex items-center gap-3 p-3 bg-white border border-gray-200 shadow-sm shrink-0 rounded-2xl">
        <div className="flex-shrink-0 p-2 rounded-lg bg-violet-50">
          <span className="text-violet-600"><DashboardIcon name="tank" /></span>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-gray-900 lg:text-lg">Water Exchange Simulation</h1>
          <p className="text-xs text-gray-500 mt-0.5">Local dashboard demonstration; it does not control or confirm physical pumps.</p>
        </div>
      </header>

      <div role="status" className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
        <strong>Simulation only.</strong> Pump states, cycles, and history on this page are stored locally in this browser. No hardware API command is sent, and this system has no water-level sensor.
      </div>

      {(riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && (
        <div className={`shrink-0 rounded-xl border p-2.5 text-xs flex items-start gap-2 ${riskLevel === 'CRITICAL' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className={`mt-0.5 shrink-0 ${riskLevel === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}><DashboardIcon name="alert" /></span>
          <p><span className="font-bold">{riskLevel === 'CRITICAL' ? 'Critical: ' : 'Warning: '}</span>{riskStatus.detail} {riskCause ? `Cause: ${riskCause}.` : ''}</p>
        </div>
      )}

      <section className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <MetricTile label="Water Quality Risk" value={riskStatus.label} detail={riskStatus.detail} tone={riskStatus.tone} icon={<DashboardIcon name="alert" />} />
        <MetricTile
          label="Simulation Mode"
          value={state.mode === 'automatic' ? 'Auto demo' : 'Manual demo'}
          detail={cycleLabel || (state.lastChangedAt ? `Demo state changed ${new Date(state.lastChangedAt).toLocaleString()}` : 'Local demo only')}
          tone={state.mode === 'automatic' ? 'cyan' : 'amber'}
          icon={<DashboardIcon name="settings" />}
        />
        <MetricTile label="Simulated Drain" value={`Demo ${state.drain}`} detail="Local state; not hardware feedback" tone={state.drain === 'ON' ? 'emerald' : 'gray'} icon={<DashboardIcon name="drain" />} />
        <MetricTile label="Simulated Fill" value={`Demo ${state.fill}`} detail="Local state; not hardware feedback" tone={state.fill === 'ON' ? 'emerald' : 'gray'} icon={<DashboardIcon name="fill" />} />
        <MetricTile
          label="Last Simulated Cycle"
          value={state.lastChangedAt ? new Date(state.lastChangedAt).toLocaleDateString() : 'Never'}
          detail={state.history.length ? `${state.history.length} simulated cycle(s)` : 'No simulation history yet'}
          tone="violet"
          icon={<DashboardIcon name="clock" />}
        />
      </section>

      <section className="shrink-0 grid grid-cols-1 xl:grid-cols-2 gap-2.5">
        <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Pump Control Demo
            </h3>
            <Pill label={cycleRunning ? cycleLabel || 'Simulation running' : 'Demo ready'} tone={cycleRunning ? 'amber' : 'emerald'} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><DashboardIcon name="drain" /> Drain Pump</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={cycleRunning} onClick={() => setDrain('ON')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors">Simulate ON</button>
                <button disabled={cycleRunning} onClick={() => setDrain('OFF')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-rose-700 transition-colors">Simulate OFF</button>
              </div>
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><DashboardIcon name="fill" /> Fill Pump</p>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={cycleRunning} onClick={() => setFill('ON')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors">Simulate ON</button>
                <button disabled={cycleRunning} onClick={() => setFill('OFF')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-rose-700 transition-colors">Simulate OFF</button>
              </div>
            </div>
          </div>
          <button disabled={cycleRunning} onClick={runManualCycle} className="w-full px-4 py-2 mt-3 text-xs font-semibold text-white transition-colors rounded-lg bg-violet-600 disabled:opacity-40 hover:bg-violet-700">
            {cycleRunning ? cycleLabel || 'Simulating cycle…' : 'Run Water-Change Simulation'}
          </button>
          <p className="mt-2 text-[10px] text-gray-500">Demonstrates a drain-then-refill sequence in the UI only. Timed water exchange estimates transferred volume after separate pump calibration; it does not measure water level.</p>
        </div>

        <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Automatic Simulation
            </h3>
            <Pill label={state.mode === 'automatic' ? 'Demo enabled' : 'Demo disabled'} tone={state.mode === 'automatic' ? 'emerald' : 'gray'} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setMode('automatic')} className="px-4 py-2 text-xs font-semibold text-white transition-colors rounded-lg bg-cyan-600 hover:bg-cyan-700">Enable Auto Demo</button>
            <button onClick={() => setMode('manual')} className="px-4 py-2 text-xs font-semibold text-white transition-colors bg-gray-500 rounded-lg hover:bg-gray-600">Disable Auto Demo</button>
          </div>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-900">Simulation rule</p>
              <Pill label={riskStatus.label} tone={riskStatus.tone} />
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
              Runs a local drain-and-fill animation when the displayed risk reaches <span className="font-semibold text-rose-600">Critical</span>. It does not start real pumps. At warning level, review the sensor readings and farm conditions.
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
            <span>Simulation History</span>
          </h3>
          <Pill label={`${state.history.length} logged`} tone="violet" />
        </div>
        {state.history.length === 0 ? (
          <div className="flex flex-1 min-h-[10rem] items-center justify-center text-center text-xs text-gray-400">No water-change simulations recorded yet.</div>
        ) : (
          <div className="flex-1 min-h-[10rem] lg:min-h-0 space-y-1.5 overflow-y-auto pr-1">
            {state.history.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{new Date(event.at).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">{event.reason}</p>
                </div>
                <Pill label={event.trigger === 'automatic' ? 'Simulated automatic' : 'Simulated manual'} tone={event.trigger === 'automatic' ? 'rose' : 'cyan'} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
>>>>>>> origin/feature/major-improvements
};

export default WaterChangePage;
