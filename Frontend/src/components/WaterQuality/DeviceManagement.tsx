import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiClient, getApiErrorMessage } from '../../services/apiClient';

interface RegisteredDevice {
  deviceId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

const formatRegisteredAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Registration date unavailable' : date.toLocaleString();
};

export const DeviceManagement: React.FC = () => {
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDevices = useCallback(async () => {
    setError('');
    try {
      const response = await apiClient.get<RegisteredDevice[]>('/devices');
      setDevices(response.data || []);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Could not load devices registered to this account.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  const register = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await apiClient.post<RegisteredDevice>('/devices', {
        deviceId: deviceId.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      setMessage('Device registered and active for this account.');
      setDeviceId('');
      setName('');
      await loadDevices();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Could not register this device. Check the ID and account ownership.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm" aria-labelledby="device-management-heading">
      <div className="mb-3">
        <h2 id="device-management-heading" className="text-sm font-semibold text-gray-800">Device Management</h2>
        <p className="mt-1 text-xs text-gray-500">Register only the ID configured in the firmware currently running on your physical AquaSense device. Registration does not verify that the board is online.</p>
      </div>

      <form onSubmit={register} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
          Device ID
          <input required minLength={3} maxLength={120} value={deviceId} onChange={(event) => setDeviceId(event.target.value)} disabled={submitting} autoComplete="off" className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Exact firmware DeviceConfig::DEVICE_ID" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
          Display name (optional)
          <input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} className="rounded-lg border border-gray-300 px-3 py-2" placeholder="e.g. Main Tank" />
        </label>
        <button type="submit" disabled={submitting || !deviceId.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'Registering…' : 'Register device'}
        </button>
      </form>

      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-800">{error}</p>}
      {message && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{message}</p>}

      <div aria-live="polite">
        {loading ? <p role="status" className="text-xs text-gray-500">Loading registered devices…</p> : devices.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">No devices are registered to this account. TAN entry becomes available after you register the ID of your actual device.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {devices.map((device) => (
              <li key={device.deviceId} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800">{device.name || device.deviceId}</p>
                  <p className="break-all font-mono text-[11px] text-gray-500">{device.deviceId}</p>
                  <p className="text-[10px] text-gray-400">Registered {formatRegisteredAt(device.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${device.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {device.isActive ? 'Active · selectable for TAN' : 'Inactive'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
