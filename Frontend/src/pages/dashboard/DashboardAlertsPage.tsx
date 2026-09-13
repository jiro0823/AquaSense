import React from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import type { AlertSeverity, HealthAlert } from '../../types/water';
import type { SmsLogEntry } from '../../types/sms';

type Tone = 'emerald' | 'amber' | 'cyan' | 'rose' | 'gray';

const toneStyles: Record<Tone, { bg: string; text: string; dot: string; pillBg: string; pillText: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', pillBg: 'bg-emerald-100', pillText: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', pillBg: 'bg-amber-100', pillText: 'text-amber-700' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', dot: 'bg-cyan-500', pillBg: 'bg-cyan-100', pillText: 'text-cyan-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500', pillBg: 'bg-rose-100', pillText: 'text-rose-700' },
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

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return 'Hidden';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
};

const normalizeSeverity = (severity: AlertSeverity | string = 'INFO') => severity.toUpperCase();

const isCriticalAlert = (alert: HealthAlert) => {
  const severity = normalizeSeverity(alert.severity);
  return severity === 'CRITICAL' || severity === 'EMERGENCY';
};

const getSeverityTone = (severity: AlertSeverity | string): Tone => {
  const normalized = normalizeSeverity(severity);
  if (normalized === 'EMERGENCY' || normalized === 'CRITICAL') return 'rose';
  if (normalized === 'WARNING') return 'amber';
  if (normalized === 'INFO') return 'cyan';
  return 'gray';
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
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
    <p className="text-xs font-semibold text-emerald-600">{title}</p>
    <p className="mt-1 text-[10px] text-gray-500">{detail}</p>
  </div>
);

const AlertRow = ({ alert, showAction = false }: { alert: HealthAlert; showAction?: boolean }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 transition hover:border-gray-300">
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-900">{formatCategory(alert)}</p>
          <Pill label={normalizeSeverity(alert.severity)} tone={getSeverityTone(alert.severity)} />
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{alert.message}</p>
      </div>
      <p className="shrink-0 text-[9px] text-gray-400">{new Date(getAlertTime(alert)).toLocaleTimeString()}</p>
    </div>

    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
      <span>Current: <strong className="font-semibold text-gray-800">{getAlertValue(alert)}</strong></span>
      <span>Limit: <strong className="font-semibold text-gray-800">{getAlertThreshold(alert)}</strong></span>
      {alert.status && <span>Status: <strong className="font-semibold text-gray-800">{alert.status}</strong></span>}
    </div>

    {showAction && (
      <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
        Recommended action: <span className="font-semibold capitalize">{getActionLabel(alert)}</span>
      </div>
    )}
  </div>
);

const SmsRow = ({ log }: { log: SmsLogEntry }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
    <div className="min-w-0">
      <p className="truncate text-xs font-semibold text-gray-900">{log.category.replace(/_/g, ' ')}</p>
      <p className="mt-0.5 text-[10px] text-gray-500">{new Date(log.sentAt).toLocaleString()}</p>
    </div>
    <div className="shrink-0 text-right">
      <p className="mb-1 text-[10px] text-gray-500">{maskPhone(log.recipient)}</p>
      <Pill label={log.deliveryStatus === 'unknown' ? 'Unconfirmed' : (log.deliveryStatus || (log.success ? 'Sent' : 'Failed'))} tone={log.success ? 'emerald' : ['pending', 'retrying', 'unknown'].includes(log.deliveryStatus || '') ? 'amber' : 'rose'} />
    </div>
  </div>
);

const PanelShell = ({ title, tone, badge, children }: { title: string; tone: Tone; badge: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 flex flex-col min-h-0">
    <div className="mb-2 shrink-0 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        <span className={`h-1.5 w-1.5 rounded-full ${toneStyles[tone].dot}`} />
        {title}
      </h3>
      {badge}
    </div>
    <div className="flex-1 min-h-[8rem] lg:min-h-0 overflow-y-auto space-y-2 pr-1">{children}</div>
  </div>
);

const DashboardAlertsPage: React.FC = () => {
  const { activeAlerts, recentAlerts, smsLogs } = useDashboardData();
  const active = activeAlerts || [];
  const recent = recentAlerts?.length ? recentAlerts : active;
  const critical = active.filter(isCriticalAlert);
  const sentSms = smsLogs.filter((log) => log.success).length;
  const failedSms = smsLogs.filter((log) => !log.success && !['pending', 'retrying', 'unknown'].includes(log.deliveryStatus || '')).length;
  const pendingSms = smsLogs.filter((log) => ['pending', 'retrying', 'unknown'].includes(log.deliveryStatus || '')).length;
  const latestCritical = critical[0];

  return (
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0">
      <header className="shrink-0 flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-2xl p-3">
        <div className="bg-rose-50 p-2 rounded-lg flex-shrink-0">
          <span className="text-rose-600"><DashboardIcon name="alert" /></span>
        </div>
        <div>
          <h1 className="text-base lg:text-lg font-bold tracking-tight text-gray-900">Alerts & SMS Logs</h1>
          <p className="text-xs text-gray-500 mt-0.5">Simple view of active problems, critical warnings, and notification history</p>
        </div>
      </header>

      <section className="shrink-0 grid grid-cols-2 xl:grid-cols-4 gap-2.5">
        <MetricTile label="Active Alerts" value={`${active.length}`} detail={active.length ? 'Needs farmer review' : 'No active issues'} tone={active.length > 0 ? 'amber' : 'emerald'} icon={<DashboardIcon name="bell" />} />
        <MetricTile label="Critical" value={`${critical.length}`} detail={critical.length ? 'Check tank first' : 'No urgent issue'} tone={critical.length > 0 ? 'rose' : 'gray'} icon={<DashboardIcon name="alert" />} />
        <MetricTile label="SMS Sent" value={`${sentSms}`} detail={`${pendingSms} pending or unconfirmed`} tone="cyan" icon={<DashboardIcon name="sms" />} />
        <MetricTile label="SMS Failed" value={`${failedSms}`} detail={failedSms ? 'Review connection/API' : 'No failed sends'} tone={failedSms > 0 ? 'amber' : 'gray'} icon={<DashboardIcon name="sms" />} />
      </section>

      <section className="lg:flex-1 lg:min-h-0 grid grid-cols-1 xl:grid-cols-2 xl:grid-rows-2 gap-2.5">
        <PanelShell title="Active Alerts" tone={active.length > 0 ? 'amber' : 'emerald'} badge={<Pill label={`${active.length} active`} tone={active.length > 0 ? 'amber' : 'emerald'} />}>
          {active.length === 0 ? (
            <EmptyState title="All clear" detail="There are no active alerts for the tank." />
          ) : (
            active.slice(0, 8).map((alert) => <AlertRow key={alert.id} alert={alert} showAction />)
          )}
        </PanelShell>

        <PanelShell title="Critical" tone={critical.length > 0 ? 'rose' : 'emerald'} badge={<Pill label={`${critical.length} urgent`} tone={critical.length > 0 ? 'rose' : 'emerald'} />}>
          {!latestCritical ? (
            <EmptyState title="No urgent alert" detail="Emergency and critical alerts will appear here." />
          ) : (
            <>
              <AlertRow alert={latestCritical} showAction />
              {critical.length > 1 && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-700">
                  {critical.length - 1} more critical alert(s) in Active Alerts.
                </p>
              )}
            </>
          )}
        </PanelShell>

        <PanelShell title="Recent Alerts" tone={recent.length > 0 ? 'cyan' : 'emerald'} badge={<Pill label={`${recent.length} records`} tone="cyan" />}>
          {recent.length === 0 ? (
            <EmptyState title="No alert history yet" detail="Recent alerts will be listed after sensor readings trigger warnings." />
          ) : (
            recent.slice(0, 10).map((alert) => <AlertRow key={alert.id} alert={alert} />)
          )}
        </PanelShell>

        <PanelShell title="SMS Logs" tone={failedSms > 0 ? 'amber' : 'cyan'} badge={<Pill label={`${smsLogs.length} logs`} tone={failedSms > 0 ? 'amber' : 'cyan'} />}>
          {smsLogs.length === 0 ? (
            <EmptyState title="No SMS logs yet" detail="Sent and failed SMS attempts will show here." />
          ) : (
            smsLogs.slice(0, 10).map((log) => <SmsRow key={log.id} log={log} />)
          )}
        </PanelShell>
      </section>
    </div>
  );
};

export default DashboardAlertsPage;
