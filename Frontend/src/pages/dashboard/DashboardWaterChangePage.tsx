import React, { useCallback, useEffect, useState } from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { apiClient, getApiErrorMessage } from '../../services/apiClient';

interface Device { deviceId: string; name?: string; isActive: boolean }
interface HardwareState {
  deviceId: string;
  online: boolean;
  receivedAt: string | null;
  state: null | { fillPump: boolean; drainPump: boolean; waterPhase: 'IDLE' | 'DRAINING' | 'SETTLING_AFTER_DRAIN' | 'REFILLING' | 'COOLDOWN' | 'COMPLETE' | 'FAULT'; fault: string; automation: boolean };
  commands?: ApiCommand[];
}
interface ApiCommand {
  id: string;
  action: string;
  status: 'PENDING' | 'ACKED' | 'EXPIRED';
  result?: string | null;
  durationMs?: number | null;
  expiresAt?: string;
  createdAt?: string;
}
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
  const pumpCommands = hardware?.commands?.filter((item) => ['FILL', 'DRAIN', 'WATER_EXCHANGE', 'WATER_STOP'].includes(item.action)) ?? [];
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
      <div className="p-4 bg-white border shadow-sm rounded-xl">
        <label className="block text-xs font-semibold text-gray-600" htmlFor="water-device">Device</label>
        <select id="water-device" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); setHardware(null); setTrackedCommand(null); }} className="w-full p-2 mt-1 text-sm border rounded">
          {devices.length === 0 && <option value="">No active registered device</option>}
          {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.name || device.deviceId} ({device.deviceId})</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
          <div><span className="text-gray-500">Device</span><p className="font-semibold">{fresh ? 'ONLINE' : 'OFFLINE / STALE'}</p></div>
          <div><span className="text-gray-500">Water phase</span><p className="font-semibold">{stateText}</p></div>
          <div><span className="text-gray-500">Drain output (logical)</span><p className="font-semibold">{fresh && state ? (state.drainPump ? 'ON' : 'OFF') : 'UNKNOWN'}</p></div>
          <div><span className="text-gray-500">Fill output (logical)</span><p className="font-semibold">{fresh && state ? (state.fillPump ? 'ON' : 'OFF') : 'UNKNOWN'}</p></div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">State reported {hardware?.receivedAt ? new Date(hardware.receivedAt).toLocaleString() : 'not yet reported'}{state?.fault ? ` · Fault: ${state.fault}` : ''}</p>
        <p className="mt-1 text-[11px] text-gray-500">Automation {state?.automation ? 'enabled on device' : 'disabled on device'}. The device firmware owns automatic water-change decisions; predictive risk on this page does not start pumps.</p>
      </div>

      <div className="p-4 bg-white border shadow-sm rounded-xl">
        <h2 className="text-sm font-semibold text-gray-800">Manual water control</h2>
        <label className="block mt-3 text-xs font-semibold text-gray-600" htmlFor="pump-duration">Duration (seconds, required by the API)</label>
        <input id="pump-duration" type="number" min="1" max="60" step="1" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} placeholder="Enter duration (max 60 seconds)" className="w-full p-2 mt-1 text-sm border rounded" />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button disabled={!deviceId || pending} onClick={() => void command('DRAIN')} className="px-3 py-2 text-xs font-semibold text-white rounded-lg bg-cyan-700 disabled:opacity-40">Drain for duration</button>
          <button disabled={!deviceId || pending} onClick={() => void command('FILL')} className="px-3 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg disabled:opacity-40">Fill for duration</button>
          <button disabled={!deviceId || pending} onClick={() => void command('WATER_EXCHANGE')} className="px-3 py-2 text-xs font-semibold text-white rounded-lg bg-violet-700 disabled:opacity-40">Exchange (commissioned targets)</button>
          <button disabled={!deviceId || pending} onClick={() => void command('WATER_STOP')} className="px-3 py-2 text-xs font-semibold text-white rounded-lg bg-rose-700 disabled:opacity-40">Stop</button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">FILL and DRAIN requests are capped at 60 seconds and may not exceed the commissioned pump target. WATER_EXCHANGE uses its separately commissioned drain and fill targets; the entered duration is required for API compatibility. Pump controls remain fail-closed until timing and relay settings are commissioned.</p>
        <p className="mt-3 text-xs" aria-live="polite">{pending ? 'Submitting command…' : commandStatus}</p>
        {trackedCommand && <p className="mt-1 text-[10px] text-gray-500">Command {trackedCommand.id} · {trackedCommand.action}</p>}
        {loadedAt && <p className="mt-1 text-[10px] text-gray-400">Last state poll: {new Date(loadedAt).toLocaleTimeString()}</p>}
        {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
      </div>
    </section>

    <section className="p-4 bg-white border shadow-sm rounded-xl" aria-labelledby="water-level-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="water-level-heading" className="text-sm font-semibold text-gray-800">Water level</h2>
          <p className="mt-1 text-xs text-gray-500">Ultrasonic level sensing is not installed or commissioned for this device.</p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-800">UNAVAILABLE</span>
      </div>
      <div className="grid gap-2 mt-3 text-sm sm:grid-cols-3">
        <div className="p-3 rounded-lg bg-gray-50"><span className="text-gray-500">Measured level</span><p className="font-semibold">Unavailable</p></div>
        <div className="p-3 rounded-lg bg-gray-50"><span className="text-gray-500">Estimated volume</span><p className="font-semibold">Unavailable</p></div>
        <div className="p-3 rounded-lg bg-gray-50"><span className="text-gray-500">Level-based pump automation</span><p className="font-semibold">Disabled</p></div>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">No level percentage, pond capacity, or exchange volume is estimated. Sensor model, wiring, and tank calibration must be confirmed before these values or level-based automation can be enabled.</p>
    </section>

    <section className="p-4 bg-white border shadow-sm rounded-xl" aria-labelledby="pump-history-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="pump-history-heading" className="text-sm font-semibold text-gray-800">Recent pump commands</h2>
          <p className="mt-1 text-xs text-gray-500">Command attempts and device acknowledgments; acknowledgment does not confirm physical water flow or a completed exchange.</p>
        </div>
        {fresh && <span className="text-[11px] text-gray-400">Latest device report {hardware?.receivedAt ? new Date(hardware.receivedAt).toLocaleString() : 'unknown'}</span>}
      </div>
      {pumpCommands.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-gray-500 border-b"><tr><th className="py-2 pr-3 font-medium">Requested</th><th className="py-2 pr-3 font-medium">Command</th><th className="py-2 pr-3 font-medium">Duration</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 font-medium">Device result</th></tr></thead>
            <tbody>
              {pumpCommands.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-gray-600">{item.createdAt && Number.isFinite(new Date(item.createdAt).getTime()) ? new Date(item.createdAt).toLocaleString() : 'Time unavailable'}</td>
                  <td className="py-2 pr-3 font-medium">{item.action}</td>
                  <td className="py-2 pr-3">{item.durationMs == null ? '—' : `${(item.durationMs / 1000).toFixed(1)} s`}</td>
                  <td className="py-2 pr-3">{item.status}</td>
                  <td className="py-2">{item.result || 'No result reported'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-3 text-xs text-gray-500">{hardware ? 'No persisted pump commands are available for this device.' : 'Select a device and load its state to view command history.'}</p>}
    </section>
  </div>;
};

export default WaterChangePage;
