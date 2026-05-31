import React, { useState } from 'react';
import { DashboardIcon, PageHeader, Panel, StatusBadge } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';

const DashboardFeedingPage: React.FC = () => {
  const { feedingSchedules, feedingLoading, triggerManual, addSchedule, toggleSchedule, removeSchedule, updateSchedule } = useDashboardData();
  const [manualBusy, setManualBusy] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleLabel, setScheduleLabel] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const enabledCount = feedingSchedules.filter((item) => item.enabled).length;

  const runManual = async (action: 'ON' | 'OFF' | 'TRIGGER') => {
    try {
      setManualBusy(true);
      await triggerManual(action);
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
    <div className="space-y-6">
      <PageHeader title="Feeding" subtitle={`${enabledCount} active schedule(s), ${feedingSchedules.length} total`} tone="amber" icon={<DashboardIcon name="feed" />} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Manual Control" tone="emerald" icon={<StatusBadge label={manualBusy ? 'Sending' : 'Ready'} tone={manualBusy ? 'amber' : 'emerald'} />}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button disabled={manualBusy} onClick={() => void runManual('ON')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">ON</button>
            <button disabled={manualBusy} onClick={() => void runManual('OFF')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">OFF</button>
            <button disabled={manualBusy} onClick={() => void runManual('TRIGGER')} className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Feed</button>
          </div>
          <p className="mt-3 text-xs text-gray-500">Manual commands are sent directly to the feeder controller.</p>
        </Panel>

        <Panel title="Add Schedule" tone="cyan" icon={<DashboardIcon name="clock" />}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-sm text-gray-200" />
            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-sm text-gray-200" />
            <input type="text" value={scheduleLabel} onChange={(e) => setScheduleLabel(e.target.value)} placeholder="Label" className="rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-sm text-gray-200" />
          </div>
          <button disabled={feedingLoading || !scheduleTime} onClick={() => void saveSchedule()} className="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Save Schedule
          </button>
        </Panel>
      </section>

      <Panel title="Scheduled Feedings" tone="amber" icon={<StatusBadge label={`${enabledCount} enabled`} tone="amber" />}>
        {feedingLoading ? (
          <p className="text-sm text-gray-400">Loading schedules...</p>
        ) : feedingSchedules.length === 0 ? (
          <p className="text-sm text-gray-400">No schedules yet.</p>
        ) : (
          <div className="space-y-2">
            {feedingSchedules.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-[#101117] p-3">
                {editingScheduleId === item.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-sm text-gray-200" />
                      <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-sm text-gray-200" />
                      <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-sm text-gray-200" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void updateSchedule(item.id, editDate, editTime, editLabel).then(() => setEditingScheduleId(null))} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white">Save</button>
                      <button onClick={() => setEditingScheduleId(null)} className="rounded-lg bg-slate-600 px-3 py-2 text-xs font-semibold text-white">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.date ? `${item.date} ` : 'Daily '}@ {item.time}</p>
                      {item.label && <p className="text-xs text-gray-400">{item.label}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={item.enabled ? 'Enabled' : 'Disabled'} tone={item.enabled ? 'emerald' : 'slate'} />
                      <button onClick={() => { setEditingScheduleId(item.id); setEditDate(item.date || ''); setEditTime(item.time); setEditLabel(item.label || ''); }} className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs text-white">Edit</button>
                      <button onClick={() => void toggleSchedule(item)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white">{item.enabled ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => void removeSchedule(item.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white">Remove</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default DashboardFeedingPage;
