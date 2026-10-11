import React, { useMemo, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import { getDashboardProfile } from '../../components/WaterQuality/dashboardProfile';
import { ParameterIcon as CustomIcon, type ParameterIconName } from '../../components/WaterQuality/ParameterIcon';

const DashboardOverviewPage: React.FC = () => {
  const { isConnected, latestReading, chartData, predictiveWarning, error, tanMeasurements, latestTanMeasurement, tanLoading, tanError } = useDashboardData();
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
    { title: 'UNIONIZED NH3-N', value: latestTanMeasurement?.nh3N != null ? `${latestTanMeasurement.nh3N.toFixed(3)} mg/L as N` : '--', color: '#ef4444', icon: 'ammonia', status: {label:latestTanMeasurement?.nh3N != null ? 'Calculated from aligned measured TAN' : latestTanMeasurement ? 'TAN recorded; speciation unavailable' : tanLoading ? 'Loading TAN history' : tanError ? 'TAN history unavailable' : 'TAN not recorded',color:'text-gray-600',bg:'bg-gray-100'} },
  ];

  const renderChart = (title: string, dataKey: string, color: string, yDomain: [number | string, number | string], idealLabel: string, detail?: React.ReactNode, secondSeries?: { dataKey: string; color: string }, dataOverride?: typeof chartData) => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-2.5 lg:p-2 h-[220px] lg:h-full lg:min-h-0 flex flex-col relative">
      <div className="flex items-center justify-between gap-2 mb-1 shrink-0">
        <h3 className="text-xs font-semibold flex items-center gap-1.5 truncate" style={{ color }}><CustomIcon name={dataKey === 'temperature' ? 'temperature' : dataKey === 'ph' ? 'ph' : dataKey === 'turbidity' ? 'turbidity' : secondSeries || dataKey === 'tan' || dataKey === 'nh3N' ? 'ammonia' : 'shield'} color={color} size="h-4 w-4" /> <span className="truncate">{title}</span></h3>
        <span className="text-[9px] text-gray-400 whitespace-nowrap">{idealLabel}</span>
      </div>
      {detail && <div className="shrink-0 text-[9px] leading-tight text-gray-500">{detail}</div>}
      <div className="relative flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dataKey==='turbidity'?(dataOverride ?? processedChartData).filter(point=>point.turbidityUnit===latestReading?.turbidityUnit):(dataOverride ?? processedChartData)} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
              {secondSeries && <linearGradient id={`gradient-${secondSeries.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={secondSeries.color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={secondSeries.color} stopOpacity={0}/>
              </linearGradient>}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} tickMargin={8} minTickGap={20} />
            <YAxis domain={yDomain} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              itemStyle={{ color: '#111827' }}
              labelStyle={{ color: '#6b7280' }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${dataKey})`} />
            {secondSeries && <Area type="monotone" dataKey={secondSeries.dataKey} stroke={secondSeries.color} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${secondSeries.dataKey})`} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5 lg:gap-2 p-4 lg:h-full lg:min-h-0 lg:p-0 text-gray-800 font-sans">

      {/* Top Header Section */}
      <header className="shrink-0 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white border border-gray-200 shadow-sm rounded-2xl p-3 lg:p-2.5 text-center xl:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50">
             <CustomIcon name="shield" color="#2563eb" size="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900 uppercase md:text-lg lg:text-xl">AQUASENSE WATER QUALITY MONITORING DASHBOARD</h1>
            <p className="text-xs text-gray-500 mt-0.5">Real-time sensor readings and freshwater ammonia speciation</p>
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
                <span className="text-gray-500">Tank ID</span>
                <span className="font-semibold text-blue-600">{profile.tankName || 'POND-01'}</span>
             </div>
          </div>
          <div className="flex items-center gap-2 pl-1 md:pl-2">
            <div className="flex flex-col text-left">
              <span className="text-gray-500">Status</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <span className={isConnected ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>{isConnected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="p-2 text-sm border shrink-0 rounded-xl border-amber-200 bg-amber-50 text-amber-900">Data connection status: {error}</div>}
      {tanError && <div role="alert" className="p-2 text-sm border shrink-0 rounded-xl border-amber-200 bg-amber-50 text-amber-900">TAN history unavailable: {tanError}</div>}

      {/* Top Metrics Cards */}
      <section className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 lg:gap-2">
        {metrics.map((metric, idx) => (
          <div key={idx} className="bg-white border border-gray-200 shadow-sm rounded-xl p-2.5 lg:p-2 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-gray-300 transition-colors">
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
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-2.5 lg:p-2 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-gray-300 transition-colors">
            <span className="text-[10px] font-semibold text-gray-500 tracking-wider uppercase mb-1">RISK ANALYSIS</span>
            <div className="mb-1 text-lg font-bold tracking-tight uppercase lg:text-xl" style={{ color: riskColor }}>{riskLevel}</div>
            <div className="flex items-center gap-1.5">
               <CustomIcon name="shield" color={riskColor} size="h-4 w-4" />
               <span className="text-xs font-semibold text-gray-600">Index: {currentRiskScore === null ? '--' : `${currentRiskScore.toFixed(0)} / 100`}</span>
            </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 lg:gap-2 lg:flex-1 lg:min-h-0">

        {/* Left Side: Charts Grid (Spans 2 columns) */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-2.5 lg:gap-2 lg:min-h-0">
          {renderChart('Temperature (°C)', 'temperature', '#f59e0b', [20, 36], 'Growth guidance 26-29°C')}
          {renderChart('pH Level', 'ph', '#3b82f6', [4, 10], 'Culture guidance pH 7-8.5')}
          {renderChart('ORP / Redox (mV)', 'orp', '#22c55e', ['auto', 'auto'], 'Independent redox indicator', orpIsStale ? 'Latest sample is stale; historical device-reported values are uncalibrated' : latestReading?.orp != null ? 'Device-reported trend; calibration required for interpretation' : 'No reported ORP samples')}
          {renderChart('Turbidity ('+(latestReading?.turbidityUnit || 'unit unknown')+')', 'turbidity', '#a855f7', ['auto', 'auto'], 'Calibration required')}
          {renderChart(
            'TAN / NH3-N (mg/L as N)', 'tan', '#3b82f6', ['auto', 'auto'], 'Measured TAN; NH3-N only when aligned and qualified',
            <>{latestTanMeasurement ? `Latest TAN ${latestTanMeasurement.value} mg/L as N · ${latestTanMeasurement.source} · collected ${new Date(latestTanMeasurement.sampleCollectedAt).toLocaleString()}` : tanLoading ? 'Loading TAN measurement history…' : tanError ? 'TAN history could not be loaded' : 'No TAN measurement recorded'} · {latestTanMeasurement?.nh3N != null ? `NH3-N ${latestTanMeasurement.nh3N.toFixed(5)} mg/L as N` : 'NH3-N unavailable'}</>,
            { dataKey: 'nh3N', color: '#ef4444' }, tanChartData
          )}
          <div className="relative flex h-[220px] flex-col rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm lg:h-full lg:min-h-0 lg:p-2"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-gray-700">Risk Index</h3><span className="text-[9px] text-gray-400">Unavailable</span></div><div className="flex flex-1 flex-col items-center justify-center text-center"><span className="text-2xl font-bold" style={{color:riskColor}}>{currentRiskScore === null ? '--' : `${currentRiskScore.toFixed(0)} / 100`}</span><span className="text-xs text-gray-500">{riskLevel}</span><span className="mt-2 text-[10px] text-gray-400">No validated, commissioned crayfish risk model</span></div></div>
        </div>

        {/* Right Side: Risk Assessment Panel */}
        <div className="lg:col-span-1 flex flex-col gap-2.5 lg:gap-2 lg:min-h-0">

          {/* Risk model readiness is reported explicitly; no score is implied by a gauge. */}
          <div className="shrink-0 min-h-[150px] bg-white border border-gray-200 shadow-sm rounded-xl p-3 lg:p-2.5 flex flex-col items-center justify-center">
             <h3 className="text-xs font-semibold text-gray-600 tracking-widest uppercase mb-2 w-full text-center">RISK MODEL STATUS</h3>
             <span className="text-lg font-bold uppercase text-gray-600">{predictiveWarning?.modelStatus ?? 'UNAVAILABLE'}</span>
             <div className="mt-2 grid w-full grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-600">
               <span>Model validation</span><span className="text-right">{predictiveWarning?.validationStatus === 'VALIDATED' ? 'Validated' : 'Not commissioned'}</span>
               <span>Sensor coverage</span><span className="text-right">{validSensorCount}/{monitoredSensors.length} valid</span>
               <span>Calibrated and stable</span><span className="text-right">{calibratedSensorCount}/{monitoredSensors.length}</span>
               <span>Measured TAN source</span><span className="text-right">{latestTanMeasurement ? 'User-reported result' : 'Unavailable'}</span>
             </div>
             <p className="mt-2 text-[10px] text-gray-500">{latestTanMeasurement?.speciationReason || 'Ammonia hazard is unassessed until an actual TAN result is entered.'}</p>
          </div>

          {/* Risk Level Guide Panel */}
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto bg-white border border-gray-200 shadow-sm rounded-xl p-3 lg:p-2.5">
             <h3 className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2 border-b border-gray-200 pb-1.5">ASSESSMENT LIMITATIONS</h3>
             <div className="flex flex-col gap-1.5">
                <p className="text-xs text-gray-600">No validated Cherax quadricarinatus risk model is commissioned.</p>
                <p className="text-xs text-gray-600">No mortality probability or time-to-critical estimate is available.</p>
                <p className="text-xs text-gray-600">Temperature and pH guidance is advisory; turbidity and ORP have no validated species-specific warning threshold.</p>
             </div>
          </div>

          {/* Factors Contributing Panel */}
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto bg-white border border-gray-200 shadow-sm rounded-xl p-3 lg:p-2.5">
             <h3 className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2 border-b border-gray-200 pb-1.5">LIVE WATER QUALITY INDICATORS</h3>
             <div className="flex flex-col gap-1.5 lg:gap-1.5">
                {([
                  { name: 'ORP / Redox (uncalibrated)', status: latestReading?.orp != null ? `${latestReading.orp.toFixed(1)} mV reported${orpIsStale ? ' · stale' : ''}` : 'Unavailable', color: '#22c55e', icon: 'shield' },
                  { name: 'TAN', status: latestTanMeasurement ? `${latestTanMeasurement.value} mg/L as N · ${latestTanMeasurement.validationStatus.toLowerCase().replace('_', ' ')}` : tanLoading ? 'Loading history' : tanError ? 'History unavailable' : 'No result recorded', color: '#3b82f6', icon: 'ammonia' },
                  { name: 'Unionized NH3-N', status: latestTanMeasurement?.nh3N != null ? `${latestTanMeasurement.nh3N.toFixed(3)} mg/L as N` : 'Unavailable', color: '#ef4444', icon: 'ammonia' },
                  { name: 'Temperature', status: latestReading?.temperature != null ? `${latestReading.temperature.toFixed(1)} °C` : 'Unavailable', color: metrics[0].color, icon: 'temperature' },
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
      <footer className="shrink-0 flex flex-col md:flex-row justify-between items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-xl p-2.5 lg:p-2 text-center md:text-left">
         <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Update Interval</span>
            <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg text-xs font-semibold">
               <svg className="w-3.5 h-3.5 animate-spin-slow flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               5 seconds
            </div>
         </div>
         <div className="flex items-start sm:items-center gap-2 text-[11px] text-gray-500 text-left">
            <div className="mt-0.5 sm:mt-0 flex-shrink-0"><CustomIcon name="shield" color="#9ca3af" size="h-4 w-4" /></div>
            <span>All readings are real-time and refreshed every 5 seconds. Ensure regular calibration.</span>
         </div>
      </footer>
    </div>
  );
};

export default DashboardOverviewPage;
