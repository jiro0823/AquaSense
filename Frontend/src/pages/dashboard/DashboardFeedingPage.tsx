import React, { useCallback, useEffect, useState } from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import { apiClient, getApiErrorMessage } from '../../services/apiClient';

const inputClass = 'rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400';

interface Device { deviceId: string; name?: string; isActive: boolean }
interface FeedingCommand { id: string; action: string; status: 'PENDING' | 'ACKED'; metadata?: Record<string, unknown> | null; executedAt?: string | null; createdAt?: string }
interface FeedingState { scheduleCount: number; enabledCount: number; pendingCommands: number; lastCommand: FeedingCommand | null }
interface HardwareState { deviceId: string; online: boolean; receivedAt: string | null; state: null | { feederBusy: boolean } }

const Pill = ({ label, tone }: { label: string; tone: 'emerald' | 'amber' | 'gray' }) => {
  const styles = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-600',
  }[tone];
  const dot = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    gray: 'bg-gray-400',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );  
};

const DashboardFeedingPage: React.FC = () => {
  const { feedingSchedules, feedingLoading, triggerManual, addSchedule, toggleSchedule, removeSchedule, updateSchedule } = useDashboardData();
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [feedingState, setFeedingState] = useState<FeedingState | null>(null);
  const [hardwareState, setHardwareState] = useState<HardwareState | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleLabel, setScheduleLabel] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const enabledCount = feedingSchedules.filter((item) => item.enabled).length;
  const deviceOnline = !!hardwareState?.online && loadedAt !== null && Date.now() - loadedAt < 20000;

  const refreshState = useCallback(async (selectedId = deviceId) => {
    if (!selectedId) return;
    try {
      const [feedingResponse, hardwareResponse] = await Promise.all([
        apiClient.get<FeedingState>(`/feeding/state?deviceId=${encodeURIComponent(selectedId)}`),
        apiClient.get<HardwareState>(`/hardware/state?deviceId=${encodeURIComponent(selectedId)}`),
      ]);
      setFeedingState(feedingResponse.data);
      setHardwareState(hardwareResponse.data);
      setLoadedAt(Date.now());
      setStateError(null);
    } catch (cause) {
      setStateError(getApiErrorMessage(cause, 'Unable to read feeder state.'));
    }
  }, [deviceId]);

  useEffect(() => {
    let active = true;
    void apiClient.get<Device[]>('/devices').then((response) => {
      if (!active) return;
      const available = (response.data || []).filter((device) => device.isActive);
      setDevices(available);
      setDeviceId((current) => current || available[0]?.deviceId || '');
    }).catch((cause) => { if (active) setStateError(getApiErrorMessage(cause, 'Unable to load registered devices.')); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    void refreshState(deviceId);
    const timer = window.setInterval(() => void refreshState(deviceId), 5000);
    return () => window.clearInterval(timer);
  }, [deviceId, refreshState]);

  const runManual = async (action: 'ON' | 'OFF' | 'TRIGGER') => {
    try {
      setManualBusy(true);
      setManualMessage(null);
      const published = await triggerManual(action, deviceId);
      setManualMessage(published
        ? `${action === 'TRIGGER' ? 'Feed trigger' : `Feeder ${action}`} published to HiveMQ; servo movement is unconfirmed until the ESP32 acknowledges.`
        : 'Command was not sent. The broker did not accept it, and no retry was queued.');
      await refreshState();
    } catch (cause) {
      setManualMessage(getApiErrorMessage(cause, 'Unable to send the feeder command.'));
    } finally {
      setManualBusy(false);
    }
  };

  const saveSchedule = async () => {
    await addSchedule(scheduleDate, scheduleTime, scheduleLabel);
    setScheduleDate('');
    setScheduleTime('');
    setScheduleLabel('');
  };

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      <header className="flex items-center gap-3 p-3 bg-white border border-gray-200 shadow-sm shrink-0 rounded-2xl">
        <div className="flex-shrink-0 p-2 rounded-lg bg-amber-50">
          <span className="text-amber-600"><DashboardIcon name="feed" /></span>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-gray-900 lg:text-lg">Feeding</h1>
          <p className="text-xs text-gray-500 mt-0.5">{enabledCount} active schedule(s), {feedingSchedules.length} total</p>
        </div>
      </header>

      <section className="shrink-0 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Manual Control
            </h3>
            <Pill label={manualBusy ? 'Sending' : hardwareState?.state?.feederBusy ? 'Feeding' : deviceOnline ? 'Ready' : 'Unavailable'} tone={manualBusy || hardwareState?.state?.feederBusy ? 'amber' : deviceOnline ? 'emerald' : 'gray'} />
          </div>
          <label className="mb-2 block text-[10px] font-semibold text-gray-600" htmlFor="feeding-device">Device</label>
          <select id="feeding-device" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); setFeedingState(null); setHardwareState(null); setLoadedAt(null); }} className="mb-2 w-full rounded border border-gray-200 bg-gray-50 p-2 text-xs">
            {devices.length === 0 && <option value="">No active registered device</option>}
            {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.name || device.deviceId} ({device.deviceId})</option>)}
          </select>
          <div className="mb-2 grid grid-cols-2 gap-2 text-[10px] text-gray-600">
            <span>Device: <strong>{deviceOnline ? 'ONLINE' : 'OFFLINE / STALE'}</strong></span>
            <span>Feeder state: <strong>{hardwareState?.state ? (hardwareState.state.feederBusy ? 'FEEDING' : 'IDLE') : 'UNKNOWN'}</strong></span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button disabled={manualBusy || !deviceOnline} title={!deviceOnline ? 'Device must report online before a feeder command can be sent.' : undefined} onClick={() => void runManual('ON')} className="px-3 py-2 text-xs font-semibold text-white transition-colors rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40">ON</button>
            <button disabled={manualBusy || !deviceOnline} title={!deviceOnline ? 'Device must report online before a feeder command can be sent.' : undefined} onClick={() => void runManual('OFF')} className="px-3 py-2 text-xs font-semibold text-white transition-colors rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40">OFF</button>
            <button disabled={manualBusy || !deviceOnline} title={!deviceOnline ? 'Device must report online before a feeder command can be sent.' : undefined} onClick={() => void runManual('TRIGGER')} className="px-3 py-2 text-xs font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">Feed</button>
          </div>
          {!deviceOnline && <p role="status" className="mt-2 text-[10px] text-amber-700">Feeder controls are disabled until fresh, verified ESP32 telemetry is received and the HiveMQ command connection is available.</p>}
          <p className="mt-2 text-[10px] text-gray-400">State is device-reported logical status; it does not confirm food was physically dispensed. Manual commands use the backend feeder command endpoint.</p>
          {manualMessage && <p role="status" aria-live="polite" className="mt-1 text-[10px] text-blue-700">{manualMessage}</p>}
          <p className="mt-2 text-[10px] text-gray-600" aria-live="polite">{feedingState?.lastCommand ? `Latest command ${feedingState.lastCommand.action}: ${feedingState.lastCommand.status}${feedingState.lastCommand.metadata?.deviceResult ? ` · ${String(feedingState.lastCommand.metadata.deviceResult)}` : ''}` : 'No reported feeding command'}{manualBusy ? ' · PENDING' : ''}</p>
          {feedingState?.lastCommand?.id && <p className="mt-1 break-all text-[10px] text-gray-400">Command ID: {feedingState.lastCommand.id}</p>}
          {loadedAt && <p className="mt-1 text-[10px] text-gray-400">Last state poll: {new Date(loadedAt).toLocaleTimeString()}</p>}
          {stateError && <p role="alert" className="mt-1 text-[10px] text-rose-700">{stateError}</p>}
        </div>

        <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-cyan-600"><DashboardIcon name="clock" /></span>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Add Schedule</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className={inputClass} />
            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className={inputClass} />
            <input type="text" value={scheduleLabel} onChange={(e) => setScheduleLabel(e.target.value)} placeholder="Label" className={inputClass} />
          </div>
          <button disabled={feedingLoading || !scheduleTime} onClick={() => void saveSchedule()} className="mt-2.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 transition-colors disabled:opacity-40">
            Save Schedule
          </button>
        </div>
      </section>

      <div className="p-3 bg-white border border-gray-200 shadow-sm lg:flex-1 lg:min-h-0 lg:overflow-y-auto rounded-xl">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Scheduled Feedings
          </h3>
          <Pill label={`${enabledCount} enabled`} tone="amber" />
        </div>
        {feedingLoading ? (
          <p className="text-xs text-gray-400">Loading schedules...</p>
        ) : feedingSchedules.length === 0 ? (
          <p className="text-xs text-gray-400">No schedules yet.</p>
        ) : (
          <div className="space-y-2">
            {feedingSchedules.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                {editingScheduleId === item.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputClass} />
                      <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className={inputClass} />
                      <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void updateSchedule(item.id, editDate, editTime, editLabel).then(() => setEditingScheduleId(null))} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-700 transition-colors">Save</button>
                      <button onClick={() => setEditingScheduleId(null)} className="rounded-lg bg-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-300 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{item.date ? `${item.date} ` : 'Daily '}@ {item.time}</p>
                      {item.label && <p className="text-[10px] text-gray-500">{item.label}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill label={item.enabled ? 'Enabled' : 'Disabled'} tone={item.enabled ? 'emerald' : 'gray'} />
                      <button onClick={() => { setEditingScheduleId(item.id); setEditDate(item.date || ''); setEditTime(item.time); setEditLabel(item.label || ''); }} className="rounded-lg bg-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-300 transition-colors">Edit</button>
                      <button onClick={() => void toggleSchedule(item)} className="rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-amber-600 transition-colors">{item.enabled ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => void removeSchedule(item.id)} className="rounded-lg bg-rose-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-rose-600 transition-colors">Remove</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardFeedingPage;
