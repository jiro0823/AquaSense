import React, { useCallback, useEffect, useState } from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { apiClient, getApiErrorMessage } from '../../services/apiClient';

interface Device { deviceId: string; name?: string; isActive: boolean }
interface HardwareState {
  deviceId: string;
  online: boolean;
  receivedAt: string | null;
  state: null | { aerator: boolean; automation: boolean; wifiConnected: boolean; mqttConnected: boolean };
}
interface ApiCommand { id: string; action: string; status: 'PENDING' | 'ACKED' | 'EXPIRED'; result?: string | null; expiresAt?: string }
type TrackedCommand = Omit<ApiCommand, 'status'> & { status: ApiCommand['status'] | 'TIMEOUT' };

const DashboardAeratorPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [hardware, setHardware] = useState<HardwareState | null>(null);
  const [trackedCommand, setTrackedCommand] = useState<TrackedCommand | null>(null);
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

  const command = async (action: 'AERATOR_ON' | 'AERATOR_OFF' | 'AERATOR_AUTO') => {
    if (!deviceId || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiClient.post<ApiCommand>('/hardware/commands', { deviceId, action });
      setTrackedCommand(response.data);
      await refresh(deviceId);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Command could not be queued.'));
    } finally {
      setPending(false);
      window.setTimeout(() => void refresh(deviceId), 1200);
    }
  };

  const fresh = hardware?.online === true && loadedAt !== null && Date.now() - loadedAt < 20000;
  const state = hardware?.state;
  const commandStatus = !trackedCommand ? 'No command sent in this session'
    : trackedCommand.status === 'PENDING' ? 'QUEUED — awaiting device acknowledgement'
      : trackedCommand.status === 'TIMEOUT' ? 'TIMEOUT — device acknowledgement was not received before command expiry'
        : trackedCommand.status === 'EXPIRED' ? 'EXPIRED — device did not execute this command'
          : trackedCommand.result === 'accepted' ? 'DEVICE ACKNOWLEDGED — command accepted'
            : `DEVICE REJECTED — ${trackedCommand.result || 'execution was not accepted'}`;

  return <div className="flex flex-col gap-3">
    <header className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <span className="flex-shrink-0 rounded-lg bg-cyan-50 p-2 text-cyan-600"><DashboardIcon name="aerator" /></span>
      <div><h1 className="text-base font-bold tracking-tight text-gray-900 lg:text-lg">Aerator</h1><p className="mt-0.5 text-xs text-gray-500">Authenticated device control. Reported output state is logical state, not physical feedback.</p></div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block text-xs font-semibold text-gray-600" htmlFor="aerator-device">Device</label>
        <select id="aerator-device" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); setHardware(null); setTrackedCommand(null); }} className="mt-1 w-full rounded border p-2 text-sm">
          {devices.length === 0 && <option value="">No active registered device</option>}
          {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.name || device.deviceId} ({device.deviceId})</option>)}
        </select>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Connection</dt><dd className="font-semibold">{fresh ? 'ONLINE' : 'OFFLINE / STALE'}</dd></div>
          <div><dt className="text-gray-500">Aerator output (logical)</dt><dd className="font-semibold">{fresh && state ? (state.aerator ? 'ON' : 'OFF') : 'UNKNOWN'}</dd></div>
          <div><dt className="text-gray-500">Control mode</dt><dd className="font-semibold">{fresh && state ? (state.automation ? 'AUTOMATIC' : 'MANUAL') : 'UNKNOWN'}</dd></div>
          <div><dt className="text-gray-500">Device network</dt><dd className="font-semibold">{fresh && state ? `${state.wifiConnected ? 'Wi-Fi' : 'Wi-Fi disconnected'} · ${state.mqttConnected ? 'MQTT' : 'MQTT disconnected'}` : 'UNKNOWN'}</dd></div>
        </dl>
        <p className="mt-3 text-[11px] text-gray-500">State reported {hardware?.receivedAt ? new Date(hardware.receivedAt).toLocaleString() : 'not yet reported'}.</p>
        <p className="mt-1 text-[11px] text-gray-500">Automatic mode applies the firmware temperature policy. It does not use dissolved oxygen or ORP as a dissolved-oxygen reading.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800">Aerator control</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button disabled={!deviceId || pending} onClick={() => void command('AERATOR_ON')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Turn ON</button>
          <button disabled={!deviceId || pending} onClick={() => void command('AERATOR_OFF')} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Turn OFF</button>
          <button disabled={!deviceId || pending} onClick={() => void command('AERATOR_AUTO')} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Automatic</button>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">Manual ON/OFF selects manual mode on the device. Automatic returns control to the firmware temperature policy.</p>
        <p className="mt-3 text-xs" aria-live="polite">{pending ? 'Submitting command…' : commandStatus}</p>
        {trackedCommand && <p className="mt-1 text-[10px] text-gray-500">Command {trackedCommand.id} · {trackedCommand.action}</p>}
        {loadedAt && <p className="mt-1 text-[10px] text-gray-400">Last state poll: {new Date(loadedAt).toLocaleTimeString()}</p>}
        {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
      </div>
    </section>
  </div>;
};

export default DashboardAeratorPage;
