import React from 'react';
import { DashboardIcon, MetricCard, PageHeader, Panel, StatusBadge } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import type { AlertSeverity, HealthAlert } from '../../types/water';

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return 'Hidden';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
};

const normalizeSeverity = (severity: AlertSeverity | string = 'INFO') => severity.toUpperCase();

const isCriticalAlert = (alert: HealthAlert) => {
  const severity = normalizeSeverity(alert.severity);
  return severity === 'CRITICAL' || severity === 'EMERGENCY';
};

const isWarningAlert = (alert: HealthAlert) => normalizeSeverity(alert.severity) === 'WARNING';

const getSeverityTone = (severity: AlertSeverity | string): 'cyan' | 'amber' | 'rose' | 'emerald' | 'slate' => {
  const normalized = normalizeSeverity(severity);
  if (normalized === 'EMERGENCY' || normalized === 'CRITICAL') return 'rose';
  if (normalized === 'WARNING') return 'amber';
  if (normalized === 'INFO') return 'cyan';
  return 'slate';
};

const formatCategory = (alert: HealthAlert) => {
  const label = alert.category || alert.parameter || 'Water quality';
  return label
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getAlertTime = (alert: HealthAlert) => alert.createdAt || alert.timestamp || alert.updatedAt || new Date().toISOString();

const getAlertValue = (alert: HealthAlert) => {
  const value = alert.currentValue ?? alert.value;
  if (value === undefined) return '--';
  return `${value.toFixed(2)}${alert.unit ? ` ${alert.unit}` : ''}`;
};

const getAlertThreshold = (alert: HealthAlert) => {
  const threshold = alert.thresholdValue ?? alert.threshold;
  if (threshold === undefined) return '--';
  return `${threshold.toFixed(2)}${alert.unit ? ` ${alert.unit}` : ''}`;
};

const getActionLabel = (alert: HealthAlert) => (alert.action || 'Review tank').replace(/_/g, ' ').toLowerCase();

const EmptyState = ({ title, detail }: { title: string; detail: string }) => (
  <div className="rounded-xl border border-white/10 bg-[#101117] p-5 text-center">
    <p className="text-sm font-semibold text-emerald-300">{title}</p>
    <p className="mt-1 text-xs text-gray-500">{detail}</p>
  </div>
);

const AlertRow = ({ alert, showAction = false }: { alert: HealthAlert; showAction?: boolean }) => (
  <div className="rounded-xl border border-white/10 bg-[#101117] p-4 transition hover:border-white/20">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">{formatCategory(alert)}</p>
          <StatusBadge label={normalizeSeverity(alert.severity)} tone={getSeverityTone(alert.severity)} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">{alert.message}</p>
      </div>
      <p className="shrink-0 text-xs text-gray-500">{new Date(getAlertTime(alert)).toLocaleTimeString()}</p>
    </div>

    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
      <span>Current: <strong className="font-semibold text-gray-200">{getAlertValue(alert)}</strong></span>
      <span>Limit: <strong className="font-semibold text-gray-200">{getAlertThreshold(alert)}</strong></span>
      {alert.status && <span>Status: <strong className="font-semibold text-gray-200">{alert.status}</strong></span>}
    </div>

    {showAction && (
      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        Recommended action: <span className="font-semibold capitalize">{getActionLabel(alert)}</span>
      </div>
    )}
  </div>
);

const SmsRow = ({ log }: { log: { id: string; category: string; severity: string; recipient: string; success: boolean; sentAt: string } }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#101117] p-4">
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-white">{log.category.replace(/_/g, ' ')}</p>
      <p className="mt-1 text-xs text-gray-500">{new Date(log.sentAt).toLocaleString()}</p>
    </div>
    <div className="shrink-0 text-right">
      <p className="mb-1 text-xs text-gray-500">{maskPhone(log.recipient)}</p>
      <StatusBadge label={log.success ? 'Sent' : 'Failed'} tone={log.success ? 'emerald' : 'rose'} />
    </div>
  </div>
);

const DashboardAlertsPage: React.FC = () => {
  const { activeAlerts, recentAlerts, smsLogs } = useDashboardData();
  const active = activeAlerts || [];
  const recent = recentAlerts?.length ? recentAlerts : active;
  const critical = active.filter(isCriticalAlert);
  const warningAlerts = active.filter(isWarningAlert).length;
  const sentSms = smsLogs.filter((log) => log.success).length;
  const failedSms = smsLogs.filter((log) => !log.success).length;
  const latestCritical = critical[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & SMS Logs"
        subtitle="Simple view of active problems, critical warnings, and notification history"
        tone="rose"
        icon={<DashboardIcon name="alert" />}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Alerts" value={`${active.length}`} detail={active.length ? 'Needs farmer review' : 'No active issues'} tone={active.length > 0 ? 'amber' : 'emerald'} icon={<DashboardIcon name="bell" />} />
        <MetricCard label="Critical" value={`${critical.length}`} detail={critical.length ? 'Check tank first' : 'No urgent issue'} tone={critical.length > 0 ? 'rose' : 'slate'} icon={<DashboardIcon name="alert" />} />
        <MetricCard label="SMS Sent" value={`${sentSms}`} detail="Successful notifications" tone="cyan" icon={<DashboardIcon name="sms" />} />
        <MetricCard label="SMS Failed" value={`${failedSms}`} detail={failedSms ? 'Review connection/API' : 'No failed sends'} tone={failedSms > 0 ? 'amber' : 'slate'} icon={<DashboardIcon name="sms" />} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="Active Alerts" tone={active.length > 0 ? 'amber' : 'emerald'} icon={<StatusBadge label={`${active.length} active`} tone={active.length > 0 ? 'amber' : 'emerald'} />}>
            {active.length === 0 ? (
              <EmptyState title="All clear" detail="There are no active alerts for the tank." />
            ) : (
              <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                {active.slice(0, 8).map((alert) => <AlertRow key={alert.id} alert={alert} showAction />)}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Critical" tone={critical.length > 0 ? 'rose' : 'emerald'} icon={<StatusBadge label={`${critical.length} urgent`} tone={critical.length > 0 ? 'rose' : 'emerald'} />}>
          {!latestCritical ? (
            <EmptyState title="No urgent alert" detail="Emergency and critical alerts will appear here." />
          ) : (
            <div className="space-y-3">
              <AlertRow alert={latestCritical} showAction />
              {critical.length > 1 && (
                <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {critical.length - 1} more critical alert(s) in Active Alerts.
                </p>
              )}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Recent Alerts" tone={recent.length > 0 ? 'cyan' : 'emerald'} icon={<StatusBadge label={`${recent.length} records`} tone="cyan" />}>
          {recent.length === 0 ? (
            <EmptyState title="No alert history yet" detail="Recent alerts will be listed after sensor readings trigger warnings." />
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {recent.slice(0, 10).map((alert) => <AlertRow key={alert.id} alert={alert} />)}
            </div>
          )}
        </Panel>

        <Panel title="SMS Logs" tone={failedSms > 0 ? 'amber' : 'cyan'} icon={<StatusBadge label={`${smsLogs.length} logs`} tone={failedSms > 0 ? 'amber' : 'cyan'} />}>
          {smsLogs.length === 0 ? (
            <EmptyState title="No SMS logs yet" detail="Sent and failed SMS attempts will show here." />
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {smsLogs.slice(0, 10).map((log) => <SmsRow key={log.id} log={log} />)}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
};

export default DashboardAlertsPage;
