import React, { useMemo, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import { getDashboardProfile } from '../../components/WaterQuality/dashboardProfile';
import { ParameterIcon as CustomIcon, type ParameterIconName } from '../../components/WaterQuality/ParameterIcon';

const DashboardOverviewPage: React.FC = () => {
  const { isConnected, latestReading, chartData, predictiveWarning, error } = useDashboardData();
  const [profile, setProfile] = useState(getDashboardProfile());

  useEffect(() => {
    const refreshProfile = () => setProfile(getDashboardProfile());
    window.addEventListener('farmerProfileUpdated', refreshProfile);
    return () => window.removeEventListener('farmerProfileUpdated', refreshProfile);
  }, []);

  const processedChartData = useMemo(() => {
    return chartData.map((d, i) => {
      const currentRisk = predictiveWarning?.riskScore || 22;
      const mockRisk = Math.max(0, Math.min(100, currentRisk + Math.sin(i * 0.5) * 5));
      return { ...d, riskScore: mockRisk };
    });
  }, [chartData, predictiveWarning?.riskScore]);



  const getRiskColor = (score: number) => {
    if (score <= 25) return '#22c55e'; // green
    if (score <= 50) return '#eab308'; // yellow
    if (score <= 75) return '#f97316'; // orange
    return '#ef4444'; // red
  };
  const currentRiskScore = predictiveWarning?.riskScore || 22;
  const riskLevel = predictiveWarning?.warningCard?.riskLevel || 'LOW';
  const riskColor = getRiskColor(currentRiskScore);

  const getStatus = (param: string, value: number) => {
    switch(param) {
      case 'temp': return (value >= 24 && value <= 32) ? { label: 'Normal', color: 'text-emerald-700', bg: 'bg-emerald-100' } : { label: 'Warning', color: 'text-amber-700', bg: 'bg-amber-100' };
      case 'ph': return (value >= 6.5 && value <= 8.5) ? { label: 'Normal', color: 'text-emerald-700', bg: 'bg-emerald-100' } : { label: 'Warning', color: 'text-amber-700', bg: 'bg-amber-100' };
      case 'do': return (value > 5) ? { label: 'Good', color: 'text-emerald-700', bg: 'bg-emerald-100' } : { label: 'Low', color: 'text-rose-700', bg: 'bg-rose-100' };
      case 'turbidity': return (value < 25) ? { label: 'Moderate', color: 'text-amber-700', bg: 'bg-amber-100' } : { label: 'High', color: 'text-rose-700', bg: 'bg-rose-100' };
      case 'ammonia': return (value < 0.2) ? { label: 'Safe', color: 'text-emerald-700', bg: 'bg-emerald-100' } : { label: 'High', color: 'text-rose-700', bg: 'bg-rose-100' };
      default: return { label: 'Unknown', color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  const metrics: Array<{ title: string; value: string; color: string; icon: ParameterIconName; status: { label: string; color: string; bg: string } }> = [
    { title: 'TEMPERATURE', value: latestReading ? `${latestReading.temperature.toFixed(1)} °C` : '--', color: '#f59e0b', icon: 'temperature', status: getStatus('temp', latestReading?.temperature || 0) },
    { title: 'pH LEVEL', value: latestReading ? latestReading.ph.toFixed(1) : '--', color: '#3b82f6', icon: 'ph', status: getStatus('ph', latestReading?.ph || 0) },
    { title: 'DISSOLVED OXYGEN', value: latestReading && latestReading.doMeasured !== false ? `${latestReading.do.toFixed(1)} mg/L` : '--', color: '#22c55e', icon: 'do', status: latestReading?.doMeasured === false ? { label: 'Unmeasured', color: 'text-gray-600', bg: 'bg-gray-100' } : getStatus('do', latestReading?.do || 0) },
    { title: 'TURBIDITY', value: latestReading ? `${latestReading.turbidity.toFixed(0)} NTU` : '--', color: '#a855f7', icon: 'turbidity', status: getStatus('turbidity', latestReading?.turbidity || 0) },
    { title: 'AMMONIA (NH3)', value: latestReading ? `${latestReading.ammonia.toFixed(2)} mg/L` : '--', color: '#ef4444', icon: 'ammonia', status: getStatus('ammonia', latestReading?.ammonia || 0) },
  ];

  const gaugeData = [
    { name: 'Risk', value: currentRiskScore, fill: riskColor },
    { name: 'Safe', value: 100 - currentRiskScore, fill: '#e5e7eb' }
  ];

  const renderChart = (title: string, dataKey: string, color: string, yDomain: [number | string, number | string], idealLabel: string) => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-2.5 lg:p-2 h-[220px] lg:h-full lg:min-h-0 flex flex-col relative">
      <div className="flex items-center justify-between gap-2 mb-1 shrink-0">
        <h3 className="text-xs font-semibold flex items-center gap-1.5 truncate" style={{ color }}><CustomIcon name={dataKey === 'temperature' ? 'temperature' : dataKey === 'ph' ? 'ph' : dataKey === 'do' ? 'do' : dataKey === 'turbidity' ? 'turbidity' : dataKey === 'ammonia' ? 'ammonia' : 'shield'} color={color} size="h-4 w-4" /> <span className="truncate">{title}</span></h3>
        <span className="text-[9px] text-gray-400 whitespace-nowrap">{idealLabel}</span>
      </div>
      <div className="relative flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${dataKey})`} />
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
            <p className="text-xs text-gray-500 mt-0.5">Real-time Water Quality Monitoring and Mortality Risk Assessment</p>
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

      {error && <div className="p-2 text-sm border shrink-0 rounded-xl border-rose-200 bg-rose-50 text-rose-700">Connection error: {error}</div>}

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

        {/* Mortality Risk Top Card */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-2.5 lg:p-2 flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-gray-300 transition-colors">
            <span className="text-[10px] font-semibold text-gray-500 tracking-wider uppercase mb-1">MORTALITY RISK LEVEL</span>
            <div className="mb-1 text-lg font-bold tracking-tight uppercase lg:text-xl" style={{ color: riskColor }}>{riskLevel}</div>
            <div className="flex items-center gap-1.5">
               <CustomIcon name="shield" color={riskColor} size="h-4 w-4" />
               <span className="text-xs font-semibold text-gray-600">Risk Score: {currentRiskScore.toFixed(0)}%</span>
            </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 lg:gap-2 lg:flex-1 lg:min-h-0">

        {/* Left Side: Charts Grid (Spans 2 columns) */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-2.5 lg:gap-2 lg:min-h-0">
          {renderChart('Temperature (°C)', 'temperature', '#f59e0b', [20, 36], 'Ideal 24-32°C')}
          {renderChart('pH Level', 'ph', '#3b82f6', [4, 10], 'Ideal 6.5-8.5')}
          {renderChart('Dissolved Oxygen (mg/L)', 'do', '#22c55e', [0, 12], 'Ideal > 5 mg/L')}
          {renderChart('Turbidity (NTU)', 'turbidity', '#a855f7', [0, 50], 'Ideal < 25 NTU')}
          {renderChart('Ammonia (NH3) (mg/L)', 'ammonia', '#ef4444', [0, 1.0], 'Safe < 0.2 mg/L')}
          {renderChart('Mortality Risk Score (%)', 'riskScore', '#ef4444', [0, 100], 'Goal < 25%')}
        </div>

        {/* Right Side: Risk Assessment Panel */}
        <div className="lg:col-span-1 flex flex-col gap-2.5 lg:gap-2 lg:min-h-0">

          {/* Gauge Chart Panel */}
          <div className="shrink-0 bg-white border border-gray-200 shadow-sm rounded-xl p-3 lg:p-2.5 flex flex-col items-center justify-center">
             <h3 className="text-xs font-semibold text-gray-600 tracking-widest uppercase mb-1.5 w-full text-center">MORTALITY RISK LEVEL</h3>
             <div className="relative w-full h-[150px] lg:h-[110px] flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={gaugeData}
                     cx="50%"
                     cy="100%"
                     startAngle={180}
                     endAngle={0}
                     innerRadius={55}
                     outerRadius={78}
                     paddingAngle={0}
                     dataKey="value"
                     stroke="none"
                   >
                     {gaugeData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.fill} />
                     ))}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute flex flex-col items-center bottom-1">
                  <span className="text-2xl font-bold text-gray-900">{currentRiskScore.toFixed(0)}%</span>
                  <span className="text-sm font-bold mt-0.5 uppercase" style={{ color: riskColor }}>{riskLevel}</span>
               </div>
             </div>

             {/* Gradient arc decoration */}
             <div className="w-[160px] h-2 rounded-full mt-1" style={{ background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)' }}></div>
          </div>

          {/* Risk Level Guide Panel */}
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto bg-white border border-gray-200 shadow-sm rounded-xl p-3 lg:p-2.5">
             <h3 className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2 border-b border-gray-200 pb-1.5">RISK LEVEL GUIDE</h3>
             <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                   <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div><span className="font-semibold text-rose-600">EXTREME</span></div>
                   <span className="text-gray-500">76 - 100</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                   <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div><span className="font-semibold text-orange-600">HIGH</span></div>
                   <span className="text-gray-500">51 - 75</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                   <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div><span className="font-semibold text-yellow-600">MEDIUM</span></div>
                   <span className="text-gray-500">26 - 50</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                   <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="font-semibold text-emerald-600">LOW</span></div>
                   <span className="text-gray-500">0 - 25</span>
                </div>
             </div>
          </div>

          {/* Factors Contributing Panel */}
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto bg-white border border-gray-200 shadow-sm rounded-xl p-3 lg:p-2.5">
             <h3 className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2 border-b border-gray-200 pb-1.5">FACTORS CONTRIBUTING TO RISK</h3>
             <div className="flex flex-col gap-1.5 lg:gap-1.5">
                {([
                  { name: 'Dissolved Oxygen', status: metrics[2].status.label, color: metrics[2].color, icon: 'do', good: metrics[2].status.label === 'Good' },
                  { name: 'Ammonia (NH3)', status: metrics[4].status.label, color: metrics[4].color, icon: 'ammonia', good: metrics[4].status.label === 'Safe' },
                  { name: 'Temperature', status: metrics[0].status.label, color: metrics[0].color, icon: 'temperature', good: metrics[0].status.label === 'Normal' },
                  { name: 'Turbidity', status: metrics[3].status.label, color: metrics[3].color, icon: 'turbidity', good: metrics[3].status.label === 'Moderate' },
                  { name: 'pH Level', status: metrics[1].status.label, color: metrics[1].color, icon: 'ph', good: metrics[1].status.label === 'Normal' },
                ] as Array<{ name: string; status: string; color: string; icon: ParameterIconName; good: boolean }>).map((factor, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                     <div className="flex items-center gap-2">
                        <CustomIcon name={factor.icon} color={factor.color} size="h-4 w-4" />
                        <span className="text-gray-600">{factor.name}</span>
                     </div>
                     <div className="flex items-center gap-1.5" style={{ color: factor.color }}>
                        <span className="font-semibold">{factor.status}</span>
                        {factor.good ?
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg> :
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
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
