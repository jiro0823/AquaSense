import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardIcon, MetricCard, PageHeader, Panel, StatusBadge } from '../../components/WaterQuality/DashboardUi';
import { getDashboardProfile } from '../../components/WaterQuality/dashboardProfile';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';

const DashboardOverviewPage: React.FC = () => {
  const { isConnected, latestReading, statistics, batteryLevel, tankWaterLevel, predictiveWarning, alerts, smsLogs, feedingSchedules, error, drainWater } =
    useDashboardData();
  const [profile, setProfile] = useState(getDashboardProfile);

  const latestUpdated = latestReading ? new Date(latestReading.timestamp).toLocaleString() : 'Waiting for sensor data';
  const criticalAlerts = alerts.filter((alert) => ['CRITICAL', 'EMERGENCY'].includes(String(alert.severity).toUpperCase())).length;
  const sentSms = smsLogs.filter((log) => log.success).length;

  useEffect(() => {
    const refreshProfile = () => setProfile(getDashboardProfile());
    window.addEventListener('farmerProfileUpdated', refreshProfile);
    return () => window.removeEventListener('farmerProfileUpdated', refreshProfile);
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-500/20 bg-[#14151b] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300">Welcome back</p>
            <h1 className="mt-1 text-2xl font-bold text-white">{profile.farmerName}</h1>
            <p className="mt-1 text-sm text-gray-400">{profile.farmName} • {profile.tankName} • {profile.location}</p>
          </div>
          <Link to="/dashboard/settings" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#101117] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-[#1a1b22]">
            <DashboardIcon name="settings" />
            Edit farm profile
          </Link>
        </div>
      </section>

      <PageHeader
        title="Overview"
        subtitle={isConnected ? 'Live tank status and system summary' : 'Dashboard is waiting for backend connection'}
        tone="emerald"
        icon={<DashboardIcon name="home" />}
      />

      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">Connection error: {error}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Health Score" value={statistics ? `${Math.round(statistics.healthScore)}` : '--'} detail="Overall water quality rating" tone="emerald" icon={<DashboardIcon name="pulse" />} />
        <MetricCard label="Battery" value={`${batteryLevel.toFixed(0)}%`} detail="Estimated sensor power" tone="amber" icon={<DashboardIcon name="battery" />} />
        <MetricCard label="Tank Level" value={`${tankWaterLevel.toFixed(0)}%`} detail="Current water reserve" tone="cyan" icon={<DashboardIcon name="tank" />} />
        <div className="rounded-xl border border-rose-500/25 bg-[#14151b] p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Tank Control</p>
          <button onClick={drainWater} className="mt-3 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500">
            Drain Water
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Latest Reading" tone="cyan" icon={<StatusBadge label={isConnected ? 'Live' : 'Offline'} tone={isConnected ? 'emerald' : 'rose'} />}>
          {latestReading ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div><p className="text-xs text-gray-500">Temp</p><p className="text-lg font-bold text-orange-300">{latestReading.temperature.toFixed(1)} C</p></div>
                <div><p className="text-xs text-gray-500">pH</p><p className="text-lg font-bold text-violet-300">{latestReading.ph.toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-500">DO</p><p className="text-lg font-bold text-emerald-300">{latestReading.do.toFixed(2)} mg/L</p></div>
                <div><p className="text-xs text-gray-500">Turbidity</p><p className="text-lg font-bold text-amber-300">{latestReading.turbidity.toFixed(1)} NTU</p></div>
                <div><p className="text-xs text-gray-500">Ammonia</p><p className="text-lg font-bold text-teal-300">{latestReading.ammonia.toFixed(2)} ppm</p></div>
              </div>
              <p className="mt-3 text-xs text-gray-500">Last update: {latestUpdated}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No live reading received yet.</p>
          )}
        </Panel>

        <Panel title="Predictive Warning" tone={predictiveWarning?.warningCard.riskLevel === 'CRITICAL' ? 'rose' : predictiveWarning?.warningCard.riskLevel === 'HIGH' ? 'amber' : 'emerald'}>
          {predictiveWarning ? (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={predictiveWarning.warningCard.riskLevel} tone={predictiveWarning.warningCard.riskLevel === 'CRITICAL' ? 'rose' : predictiveWarning.warningCard.riskLevel === 'HIGH' ? 'amber' : 'emerald'} />
                <span className="text-gray-400">{predictiveWarning.warningCard.confidence}% confidence</span>
              </div>
              <p className="text-gray-200">{predictiveWarning.warningCard.predictedIssue}</p>
              <p className="text-gray-400">{predictiveWarning.warningCard.action}</p>
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-xs md:grid-cols-4">
                <div>
                  <p className="text-gray-500">Risk Score</p>
                  <p className="font-semibold text-gray-200">{predictiveWarning.riskScore.toFixed(1)}/100</p>
                </div>
                <div>
                  <p className="text-gray-500">Data Quality</p>
                  <p className="font-semibold text-gray-200">{predictiveWarning.dataQuality.score}%</p>
                </div>
                <div>
                  <p className="text-gray-500">Samples</p>
                  <p className="font-semibold text-gray-200">{predictiveWarning.dataQuality.sampleCount}</p>
                </div>
                <div>
                  <p className="text-gray-500">Model</p>
                  <p className="font-semibold text-gray-200">{predictiveWarning.modelVersion}</p>
                </div>
              </div>
              {predictiveWarning.dataQuality.notes.length > 0 && (
                <p className="text-xs text-amber-300">{predictiveWarning.dataQuality.notes[0]}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No predictive warning available yet.</p>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link to="/dashboard/parameters" className="rounded-xl border border-cyan-500/20 bg-[#14151b] p-4 transition hover:bg-[#191b22]">
          <p className="flex items-center gap-2 text-sm font-semibold text-cyan-300"><DashboardIcon name="chart" /> Parameters</p>
          <p className="mt-2 text-xs text-gray-500">Review detailed sensor charts and ranges.</p>
        </Link>
        <Link to="/dashboard/feeding" className="rounded-xl border border-amber-500/20 bg-[#14151b] p-4 transition hover:bg-[#191b22]">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-300"><DashboardIcon name="feed" /> Feeding</p>
          <p className="mt-2 text-xs text-gray-500">{feedingSchedules.length} schedule(s) configured.</p>
        </Link>
        <Link to="/dashboard/alerts" className="rounded-xl border border-rose-500/20 bg-[#14151b] p-4 transition hover:bg-[#191b22]">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-300"><DashboardIcon name="bell" /> Alerts & Logs</p>
          <p className="mt-2 text-xs text-gray-500">{criticalAlerts} critical alert(s), {sentSms} sent SMS.</p>
        </Link>
      </section>
    </div>
  );
};

export default DashboardOverviewPage;
