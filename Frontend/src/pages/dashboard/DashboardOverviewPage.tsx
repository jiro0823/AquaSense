import React, { useMemo, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import { getDashboardProfile } from '../../components/WaterQuality/dashboardProfile';
import { ParameterIcon as CustomIcon, type ParameterIconName } from '../../components/WaterQuality/ParameterIcon';
import { SensorHealthPanel } from '../../components/WaterQuality/SensorHealthPanel';

const DashboardOverviewPage: React.FC = () => {
  const { isConnected, latestReading, chartData, predictiveWarning, predictionHistory, error, tanMeasurements, latestTanMeasurement, tanLoading, tanError } = useDashboardData();
  const [profile, setProfile] = useState(getDashboardProfile());

  useEffect(() => {
    const refreshProfile = () => setProfile(getDashboardProfile());
    window.addEventListener('farmerProfileUpdated', refreshProfile);
    return () => window.removeEventListener('farmerProfileUpdated', refreshProfile);
  }, []);

  const processedChartData = useMemo(() => chartData, [chartData]);
  const tanChartData = useMemo(() => tanMeasurements.map((measurement) => ({
    timestamp: new Date(measurement.sampleCollectedAt).toISOString(),
    time: new Date(measurement.sampleCollectedAt).toLocaleTimeString(),
    tan: measurement.value,
    nh3N: measurement.nh3N,
  })).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)), [tanMeasurements]);



  const riskModelValidated = predictiveWarning?.modelStatus === 'READY'
    && predictiveWarning.validationStatus === 'VALIDATED'
    && predictiveWarning.analysisStatus === 'AVAILABLE'
    && Number.isFinite(predictiveWarning.riskScore);
  const currentRiskScore = riskModelValidated ? predictiveWarning?.riskScore ?? null : null;
  const riskLevel = riskModelValidated ? predictiveWarning?.warningCard?.riskLevel ?? 'UNAVAILABLE' : 'UNAVAILABLE';
  const riskColor = riskLevel === 'LOW' ? '#22c55e' : riskLevel === 'MODERATE' ? '#eab308' : riskLevel === 'HIGH' ? '#f97316' : riskLevel === 'CRITICAL' ? '#ef4444' : '#6b7280';
  const orpIsStale = latestReading?.sensorHealth?.orp.health === 'STALE';
  const monitoredSensors = ['temperature', 'ph', 'turbidity', 'orp'] as const;
  const validSensorCount = monitoredSensors.filter((name) => latestReading?.sensorHealth?.[name].valid && latestReading.sensorHealth[name].health === 'VALID').length;
  const calibratedSensorCount = monitoredSensors.filter((name) => latestReading?.sensorHealth?.[name].calibration === 'CALIBRATED' && latestReading.sensorHealth[name].stability === 'STABLE').length;
  const telemetryAgeMs = latestReading ? Date.now() - new Date(latestReading.timestamp).getTime() : null;
  const telemetryFreshness = telemetryAgeMs === null || !Number.isFinite(telemetryAgeMs) ? 'UNAVAILABLE'
    : telemetryAgeMs > 5 * 60_000 ? 'STALE' : 'RECENT';
  const riskChartData = useMemo(() => riskModelValidated
    ? predictionHistory
      .filter((prediction) => Number.isFinite(prediction.riskScore)
        && Number.isFinite(Date.parse(prediction.createdAt))
        && prediction.riskLevel !== 'UNAVAILABLE')
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(-30)
      .map((prediction) => ({
        timestamp: new Date(prediction.createdAt).toISOString(),
        time: new Date(prediction.createdAt).toLocaleTimeString(),
        riskScore: prediction.riskScore,
      }))
    : [], [predictionHistory, riskModelValidated]);

  const getStatus = (param: string, value: number|null|undefined, calibrated: boolean) => {
    if(value==null || !Number.isFinite(value)) return {label:'Unavailable',color:'text-gray-600',bg:'bg-gray-100'};
    if (!calibrated) return {label:'Calibration required · not classified',color:'text-amber-700',bg:'bg-amber-100'};
    switch(param) {
      case 'temp': return value >= 26 && value <= 29
        ? { label: 'Within reported growth range', color: 'text-emerald-700', bg: 'bg-emerald-100' }
        : { label: 'Outside reported growth range', color: 'text-amber-700', bg: 'bg-amber-100' };
      case 'ph': return value >= 7 && value <= 8.5
        ? { label: 'Within culture guidance', color: 'text-emerald-700', bg: 'bg-emerald-100' }
        : { label: 'Outside culture guidance', color: 'text-amber-700', bg: 'bg-amber-100' };
      case 'turbidity': return { label: 'No validated NTU threshold', color: 'text-gray-600', bg: 'bg-gray-100' };
      default: return { label: 'Unknown', color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  const metrics: Array<{ title: string; value: string; color: string; icon: ParameterIconName; status: { label: string; color: string; bg: string } }> = [
    { title: 'TEMPERATURE', value: latestReading?.temperature != null ? `${latestReading.temperature?.toFixed(1)} °C` : '--', color: '#f59e0b', icon: 'temperature', status: getStatus('temp', latestReading?.temperature, latestReading?.sensorHealth?.temperature.valid===true && latestReading.sensorHealth.temperature.health==='VALID' && latestReading.sensorHealth.temperature.calibration==='CALIBRATED' && latestReading.sensorHealth.temperature.stability==='STABLE') },
    { title: 'pH LEVEL', value: latestReading?.ph != null ? latestReading.ph?.toFixed(1) : '--', color: '#3b82f6', icon: 'ph', status: getStatus('ph', latestReading?.ph, latestReading?.sensorHealth?.ph.valid===true && latestReading.sensorHealth.ph.health==='VALID' && latestReading.sensorHealth.ph.calibration==='CALIBRATED' && latestReading.sensorHealth.ph.stability==='STABLE') },
    { title: 'ORP / REDOX', value: latestReading?.orp != null ? `${latestReading.orp.toFixed(1)} mV` : '--', color: '#22c55e', icon: 'shield', status: orpIsStale ? {label:'Stale reported sample',color:'text-amber-700',bg:'bg-amber-100'} : latestReading?.sensorHealth?.orp.valid ? {label:'Calibrated reading',color:'text-emerald-700',bg:'bg-emerald-100'} : latestReading?.orp != null ? {label:'Reported; calibration required',color:'text-amber-700',bg:'bg-amber-100'} : {label:'Unavailable',color:'text-gray-600',bg:'bg-gray-100'} },
    { title: 'TURBIDITY', value: latestReading?.turbidity != null ? `${latestReading.turbidity?.toFixed(0)} ${latestReading.turbidityUnit}` : '--', color: '#a855f7', icon: 'turbidity', status: latestReading?.turbidityUnit==='raw_adc' ? {label:'Raw ADC · diagnostic only',color:'text-gray-600',bg:'bg-gray-100'} : latestReading?.turbidityUnit==='NTU' ? getStatus('turbidity', latestReading?.turbidity, latestReading?.sensorHealth?.turbidity.valid===true && latestReading.sensorHealth.turbidity.health==='VALID' && latestReading.sensorHealth.turbidity.calibration==='CALIBRATED' && latestReading.sensorHealth.turbidity.stability==='STABLE') : getStatus('turbidity', null, false) },
    { title: 'TAN · MEASURED', value: latestTanMeasurement ? `${latestTanMeasurement.value} mg/L as N` : '--', color: '#ef4444', icon: 'ammonia', status: {label:latestTanMeasurement ? 'User-entered measurement' : tanLoading ? 'Loading TAN history' : tanError ? 'TAN history unavailable' : 'No TAN measurement recorded',color:'text-gray-600',bg:'bg-gray-100'} },
  ];

  const renderChart = (title: string, dataKey: string, color: string, yDomain: [number | string, number | string], idealLabel: string, detail?: React.ReactNode, dataOverride?: typeof chartData) => {
    const data = dataOverride ?? processedChartData;
    const hasValues = data.some((point) => {
      const value = (point as unknown as Record<string, unknown>)[dataKey];
      return typeof value === 'number' && Number.isFinite(value);
    });
    return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(31,65,114,0.06)] p-3 lg:p-3 h-[230px] lg:h-full lg:min-h-0 flex flex-col relative">
      <div className="flex items-center justify-between gap-2 mb-1 shrink-0">
        <h3 className="text-xs font-semibold flex items-center gap-1.5 truncate" style={{ color }}><CustomIcon name={dataKey === 'temperature' ? 'temperature' : dataKey === 'ph' ? 'ph' : dataKey === 'turbidity' ? 'turbidity' : dataKey === 'tan' ? 'ammonia' : 'shield'} color={color} size="h-4 w-4" /> <span className="truncate">{title}</span></h3>
        <span className="text-[9px] text-gray-400 whitespace-nowrap">{idealLabel}</span>
      </div>
      {detail && <div className="shrink-0 text-[9px] leading-tight text-gray-500">{detail}</div>}
      {hasValues ? <div className="relative flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dataKey==='turbidity'?data.filter(point=>point.turbidityUnit===latestReading?.turbidityUnit):data} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} tickMargin={8} minTickGap={20} />
            <YAxis domain={yDomain} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              itemStyle={{ color: '#111827' }}
              labelStyle={{ color: '#6b7280' }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${dataKey})`} connectNulls={false} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div> : <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-slate-400">No historical {title.toLowerCase()} readings available</div>}
    </div>
  );
  };

  const renderDiagnosticChart = (title: string, dataKey: keyof (typeof chartData)[number], unit: string, color: string, unverified = false) => (
    <div key={String(dataKey)} className="rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div><h3 className="text-xs font-semibold text-gray-700">{title}</h3><p className="text-[10px] text-gray-500">{unit} · {unverified ? 'UNVERIFIED' : 'RAW'}</p></div>
        <span className="text-[10px] font-semibold text-gray-500">{latestReading ? new Date(latestReading.timestamp).toLocaleTimeString() : 'No telemetry'}</span>
      </div>
      <div className="mt-1 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#9ca3af' }} minTickGap={18} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 8, fill: '#9ca3af' }} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.timestamp ? new Date(payload[0].payload.timestamp).toLocaleString() : ''}
              formatter={(value) => [value == null ? 'Unavailable' : `${value} ${unit}`, title]} />
            <Area type="monotone" dataKey={dataKey} connectNulls={false} stroke={color} fill={color} fillOpacity={0.12} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[9px] text-gray-400">Device: {latestReading?.deviceId || 'Unavailable'} · gaps indicate no sample</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 p-0 text-gray-800 font-sans lg:min-h-full">

      {/* Top Header Section */}
      <header className="shrink-0 min-h-[94px] flex flex-col xl:flex-row justify-between items-center gap-4 bg-white border border-slate-100 shadow-[0_2px_10px_rgba(31,65,114,0.06)] rounded-2xl p-4 lg:px-5 lg:py-3 text-center xl:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50">
             <CustomIcon name="shield" color="#2563eb" size="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900 uppercase md:text-lg lg:text-xl">AQUASENSE WATER QUALITY MONITORING DASHBOARD</h1>
            <p className="text-xs text-gray-500 mt-0.5">Real-time water quality monitoring and measured TAN history</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center w-full gap-3 text-xs xl:justify-end md:gap-6 md:text-sm xl:w-auto">
          <div className="flex items-center gap-2 pr-3 border-r border-gray-200 md:pr-6">
            <CustomIcon name="temperature" color="#9ca3af" size="h-5 w-5" />
            <div className="flex flex-col text-left">
              <span className="text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="font-semibold text-gray-900">{new Date().toLocaleTimeString('en-US')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-3 border-r border-gray-200 md:pr-6">
             <div className="flex flex-col text-right">
                <span className="text-gray-500">Tank profile</span>
                <span className="font-semibold text-blue-600">{profile.tankName || 'Not configured'}</span>
             </div>
          </div>
          <div className="flex items-center gap-2 pl-1 md:pl-2">
            <div className="flex flex-col text-left">
              <span className="text-gray-500">Backend connection</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <span className={isConnected ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col border-l border-gray-200 pl-3 text-left md:pl-5">
            <span className="text-gray-500">Device telemetry</span>
            <span className={`mt-0.5 font-semibold ${telemetryFreshness === 'RECENT' ? 'text-emerald-600' : telemetryFreshness === 'STALE' ? 'text-amber-600' : 'text-gray-500'}`}>
              {telemetryFreshness}{latestReading ? ` · ${new Date(latestReading.timestamp).toLocaleTimeString()}` : ''}
            </span>
          </div>
        </div>
      </header>

      {error && <div className="p-2 text-sm border shrink-0 rounded-xl border-amber-200 bg-amber-50 text-amber-900">Data connection status: {error}</div>}
      {tanError && <div role="alert" className="p-2 text-sm border shrink-0 rounded-xl border-amber-200 bg-amber-50 text-amber-900">TAN history unavailable: {tanError}</div>}

      {/* Top Metrics Cards */}
      <section className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-2.5 lg:gap-2" aria-label="Current water quality summary">
        {metrics.map((metric, idx) => (
          <div key={idx} className="min-h-[112px] bg-white border border-slate-100 shadow-[0_2px_10px_rgba(31,65,114,0.06)] rounded-2xl p-3 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-blue-200 transition-colors">
             <div className="absolute transition-opacity -right-4 -top-4 opacity-5 group-hover:opacity-10">
                <CustomIcon name={metric.icon} color={metric.color} size="h-8 w-8" />
             </div>
             <div className="flex items-center gap-1.5 mb-1 w-full justify-center">
                <div className="p-1 rounded-full" style={{ backgroundColor: `${metric.color}15` }}>
                   <CustomIcon name={metric.icon} color={metric.color} size="h-4 w-4" />
                </div>
                <span className="text-[10px] font-semibold text-gray-500 tracking-wider uppercase">{metric.title}</span>
             </div>
              <div className="text-lg lg:text-xl font-bold text-gray-900 mb-1.5 tracking-tight">{metric.value}</div>
             <div className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${metric.status.bg} ${metric.status.color} uppercase tracking-wider`}>
                {metric.status.label}
             </div>
          </div>
        ))}

        {/* Risk analysis remains unavailable until a model is validated and commissioned. */}
        <div className="min-h-[112px] bg-white border border-slate-100 shadow-[0_2px_10px_rgba(31,65,114,0.06)] rounded-2xl p-3 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-blue-200 transition-colors">
            <span className="text-[10px] font-semibold text-gray-500 tracking-wider uppercase mb-1">MORTALITY RISK</span>
            <div className="mb-1 text-lg font-bold tracking-tight uppercase lg:text-xl" style={{ color: riskColor }}>{riskLevel}</div>
            <div className="flex items-center gap-1.5">
               <CustomIcon name="shield" color={riskColor} size="h-4 w-4" />
               <span className="text-xs font-semibold text-gray-600">Index: {currentRiskScore === null ? '--' : `${currentRiskScore.toFixed(0)} / 100`}</span>
            </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <section className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,2.25fr)_minmax(275px,0.9fr)] 2xl:min-h-[510px]">

        {/* Left Side: Charts Grid (Spans 2 columns) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3 2xl:grid-rows-2 2xl:gap-2.5 2xl:min-h-[510px]">
          {renderChart('Temperature (°C)', 'temperature', '#f59e0b', [20, 36], 'Growth guidance 26-29°C')}
          {renderChart('pH Level', 'ph', '#3b82f6', [4, 10], 'Culture guidance pH 7-8.5')}
          {renderChart('ORP / Redox (mV)', 'orp', '#16a765', ['auto', 'auto'], 'Independent redox indicator', orpIsStale ? 'Latest sample is stale; historical device-reported values are uncalibrated' : latestReading?.orp != null ? 'Device-reported trend; calibration required for interpretation' : 'No reported ORP samples')}
          {renderChart('Turbidity ('+(latestReading?.turbidityUnit || 'unit unknown')+')', 'turbidity', '#a855f7', ['auto', 'auto'], 'Calibration required')}
          {renderChart(
            'TAN (mg/L as N)', 'tan', '#ef4444', ['auto', 'auto'], 'User-entered measurement; not an ESP32 sensor',
            <>{latestTanMeasurement ? `Latest TAN ${latestTanMeasurement.value} mg/L as N · ${latestTanMeasurement.source} · collected ${new Date(latestTanMeasurement.sampleCollectedAt).toLocaleString()}` : tanLoading ? 'Loading TAN measurement history…' : tanError ? 'TAN history could not be loaded' : 'No TAN measurement recorded'} · {latestTanMeasurement?.nh3N != null ? `NH3-N ${latestTanMeasurement.nh3N.toFixed(5)} mg/L as N` : 'NH3-N unavailable'}</>,
            tanChartData
          )}
          {renderChart('Mortality Risk Score (%)', 'riskScore', '#ef4444', [0, 100], 'Only shown for a validated model', riskChartData.length ? 'Historical model outputs' : 'No validated historical risk scores available', riskChartData)}
        </div>

        {/* Right Side: Risk Assessment Panel */}
        <div className="flex flex-col gap-3 2xl:min-h-[510px]">

          {/* Risk model readiness is reported explicitly; no score is implied by a gauge. */}
          <div className="shrink-0 min-h-[190px] bg-white border border-gray-200 shadow-sm rounded-xl p-3 lg:p-2.5 flex flex-col items-center justify-center">
             <h3 className="text-xs font-semibold text-gray-600 tracking-widest uppercase mb-1 w-full text-center">MORTALITY RISK LEVEL</h3>
             <div className="relative h-[112px] w-[220px] max-w-full" role="img" aria-label={currentRiskScore === null ? `Risk score unavailable; model ${predictiveWarning?.modelStatus ?? 'unavailable'}` : `Mortality risk score ${currentRiskScore.toFixed(0)} out of 100, ${riskLevel}`}>
               <svg viewBox="0 0 200 115" className="h-full w-full" aria-hidden="true">
                 <path d="M 22 100 A 78 78 0 0 1 178 100" fill="none" stroke="#e7edf5" strokeWidth="18" strokeLinecap="round" />
                 {currentRiskScore !== null && <path d="M 22 100 A 78 78 0 0 1 178 100" fill="none" stroke={riskColor} strokeWidth="18" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, currentRiskScore))} 100`} />}
               </svg>
               <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
                 <span className="text-2xl font-bold text-slate-800">{currentRiskScore === null ? '--' : `${currentRiskScore.toFixed(0)}%`}</span>
                 <span className="text-xs font-semibold uppercase" style={{ color: riskColor }}>{riskLevel}</span>
               </div>
             </div>
             <p className="mt-1 text-[10px] text-gray-500">Model: {predictiveWarning?.modelStatus ?? 'UNAVAILABLE'} · {predictiveWarning?.validationStatus === 'VALIDATED' ? 'validated' : 'not commissioned'}</p>
          </div>

          {/* Risk Level Guide Panel */}
          <div className="bg-white border border-slate-100 shadow-[0_2px_10px_rgba(31,65,114,0.06)] rounded-2xl p-3">
             <h3 className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2 border-b border-gray-200 pb-1.5">ASSESSMENT LIMITATIONS</h3>
             <div className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-600">Model: {predictiveWarning?.modelStatus ?? 'unavailable'} · {predictiveWarning?.validationStatus === 'VALIDATED' ? 'validated' : 'not commissioned'}.</p>
                <p className="text-xs text-gray-600">Sensor coverage: {validSensorCount}/{monitoredSensors.length} valid; {calibratedSensorCount}/{monitoredSensors.length} calibrated and stable.</p>
                <p className="text-xs text-gray-600">No mortality probability or time-to-critical estimate is shown unless the model provides a validated result.</p>
                <p className="text-xs text-gray-600">Temperature and pH guidance is advisory; turbidity and ORP have no validated species-specific warning threshold.</p>
             </div>
          </div>

          {/* Factors Contributing Panel */}
          <div className="bg-white border border-slate-100 shadow-[0_2px_10px_rgba(31,65,114,0.06)] rounded-2xl p-3">
             <h3 className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2 border-b border-gray-200 pb-1.5">LIVE WATER QUALITY INDICATORS</h3>
             <div className="flex flex-col gap-1.5 lg:gap-1.5">
                {([
                  { name: 'ORP / Redox (uncalibrated)', status: latestReading?.orp != null ? `${latestReading.orp.toFixed(1)} mV reported${orpIsStale ? ' · stale' : ''}` : 'Unavailable', color: '#22c55e', icon: 'shield' },
                  { name: 'TAN', status: latestTanMeasurement ? `${latestTanMeasurement.value} mg/L as N · ${latestTanMeasurement.validationStatus.toLowerCase().replace('_', ' ')}` : tanLoading ? 'Loading history' : tanError ? 'History unavailable' : 'No result recorded', color: '#3b82f6', icon: 'ammonia' },
                  { name: 'Unionized NH3-N', status: latestTanMeasurement?.nh3N != null ? `${latestTanMeasurement.nh3N.toFixed(3)} mg/L as N` : 'Unavailable', color: '#ef4444', icon: 'ammonia' },
                  { name: 'Temperature', status: latestReading?.temperature != null ? `${latestReading.temperature.toFixed(1)} °C` : 'Unavailable', color: metrics[0].color, icon: 'temperature' },
                  { name: 'Turbidity', status: latestReading?.turbidity != null ? `${latestReading.turbidity.toFixed(1)} ${latestReading.turbidityUnit}` : 'Unavailable', color: '#a855f7', icon: 'turbidity' },
                  { name: 'pH Level', status: latestReading?.ph != null ? latestReading.ph.toFixed(2) : 'Unavailable', color: metrics[1].color, icon: 'ph' },
                ] as Array<{ name: string; status: string; color: string; icon: ParameterIconName }>).map((factor, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                     <div className="flex items-center gap-2">
                        <CustomIcon name={factor.icon} color={factor.color} size="h-4 w-4" />
                        <span className="text-gray-600">{factor.name}</span>
                     </div>
                     <div className="flex items-center gap-1.5" style={{ color: factor.color }}>
                        <span className="font-semibold">{factor.status}</span>
                        {factor.status === 'Unavailable' && <span className="text-gray-400">—</span>}
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </section>

      {/* Footer Status Bar */}
      <footer className="shrink-0 flex flex-col md:flex-row justify-between items-center gap-3 bg-white border border-slate-100 shadow-[0_2px_10px_rgba(31,65,114,0.06)] rounded-2xl p-3 lg:p-2 text-center md:text-left">
         <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Update Interval</span>
            <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg text-xs font-semibold">
               <svg className="w-3.5 h-3.5 animate-spin-slow flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               5 seconds
            </div>
         </div>
         <div className="flex items-start sm:items-center gap-2 text-[11px] text-gray-500 text-left">
            <div className="mt-0.5 sm:mt-0 flex-shrink-0"><CustomIcon name="shield" color="#9ca3af" size="h-4 w-4" /></div>
             <span>{error ? `Data refresh issue: ${error}. Sensor values retain their original timestamps.` : 'Dashboard data refreshes every 5 seconds; graphs may include historical samples. Check each sensor’s freshness and calibration status.'}</span>
         </div>
      </footer>

      <details className="shrink-0 rounded-xl border border-amber-200 bg-amber-50/30 p-2.5">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">Live sensor diagnostics · RAW and UNVERIFIED values are not validated measurements</summary>
        <div className="mt-3"><SensorHealthPanel reading={latestReading} /></div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {renderDiagnosticChart('pH input signal', 'rawPhAdc', 'ADC counts', '#2563eb')}
          {renderDiagnosticChart('pH provisional estimate', 'provisionalPh', 'pH', '#60a5fa', true)}
          {renderDiagnosticChart('Turbidity input signal', 'rawTurbidityAdc', 'ADC counts', '#9333ea')}
          {renderDiagnosticChart('Turbidity provisional estimate', 'provisionalTurbidity', 'NTU', '#c084fc', true)}
          {renderDiagnosticChart('ORP input signal', 'rawOrpAdc', 'ADC counts', '#15803d')}
          {renderDiagnosticChart('ORP provisional estimate', 'provisionalOrp', 'mV', '#4ade80', true)}
        </div>
      </details>
    </div>
  );
};

export default DashboardOverviewPage;
