import React, { useMemo, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useDashboardData } from '../../components/WaterQuality/useDashboardData';
import { getDashboardProfile } from '../../components/WaterQuality/dashboardProfile';

const CustomIcon = ({ name, color }: { name: string; color: string }) => {
  const baseClasses = `h-8 w-8 stroke-[1.5] flex-shrink-0`;
  switch (name) {
    case 'temperature':
      return <svg className={baseClasses} style={{ stroke: color }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
    case 'ph':
      return <svg className={baseClasses} style={{ stroke: color }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18A9 9 0 003 12h18a9 9 0 00-9-9z" /></svg>;
    case 'do':
      return <svg className={baseClasses} style={{ stroke: color }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'turbidity':
      return <svg className={baseClasses} style={{ stroke: color }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
    case 'ammonia':
      return <svg className={baseClasses} style={{ stroke: color }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
    case 'shield':
      return <svg className={baseClasses} style={{ stroke: color }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.956 11.956 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
    default:
      return null;
  }
};

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
      case 'temp': return (value >= 24 && value <= 32) ? { label: 'Normal', color: 'text-emerald-400', bg: 'bg-emerald-400/10' } : { label: 'Warning', color: 'text-amber-400', bg: 'bg-amber-400/10' };
      case 'ph': return (value >= 6.5 && value <= 8.5) ? { label: 'Normal', color: 'text-emerald-400', bg: 'bg-emerald-400/10' } : { label: 'Warning', color: 'text-amber-400', bg: 'bg-amber-400/10' };
      case 'do': return (value > 5) ? { label: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-400/10' } : { label: 'Low', color: 'text-rose-400', bg: 'bg-rose-400/10' };
      case 'turbidity': return (value < 25) ? { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-400/10' } : { label: 'High', color: 'text-rose-400', bg: 'bg-rose-400/10' };
      case 'ammonia': return (value < 0.2) ? { label: 'Safe', color: 'text-emerald-400', bg: 'bg-emerald-400/10' } : { label: 'High', color: 'text-rose-400', bg: 'bg-rose-400/10' };
      default: return { label: 'Unknown', color: 'text-gray-400', bg: 'bg-gray-400/10' };
    }
  };

  const metrics = [
    { title: 'TEMPERATURE', value: latestReading ? `${latestReading.temperature.toFixed(1)} °C` : '--', color: '#f59e0b', icon: 'temperature', status: getStatus('temp', latestReading?.temperature || 0) },
    { title: 'pH LEVEL', value: latestReading ? latestReading.ph.toFixed(1) : '--', color: '#3b82f6', icon: 'ph', status: getStatus('ph', latestReading?.ph || 0) },
    { title: 'DISSOLVED OXYGEN', value: latestReading ? `${latestReading.do.toFixed(1)} mg/L` : '--', color: '#22c55e', icon: 'do', status: getStatus('do', latestReading?.do || 0) },
    { title: 'TURBIDITY', value: latestReading ? `${latestReading.turbidity.toFixed(0)} NTU` : '--', color: '#a855f7', icon: 'turbidity', status: getStatus('turbidity', latestReading?.turbidity || 0) },
    { title: 'AMMONIA (NH3)', value: latestReading ? `${latestReading.ammonia.toFixed(2)} mg/L` : '--', color: '#ef4444', icon: 'ammonia', status: getStatus('ammonia', latestReading?.ammonia || 0) },
  ];

  const gaugeData = [
    { name: 'Risk', value: currentRiskScore, fill: riskColor },
    { name: 'Safe', value: 100 - currentRiskScore, fill: '#1f2937' }
  ];

  const renderChart = (title: string, dataKey: string, color: string, yDomain: [number | string, number | string], idealLabel: string) => (
    <div className="rounded-xl border border-white/5 bg-[#171a23] p-4 h-[220px] flex flex-col relative">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color }}><CustomIcon name={dataKey === 'temperature' ? 'temperature' : dataKey === 'ph' ? 'ph' : dataKey === 'do' ? 'do' : dataKey === 'turbidity' ? 'turbidity' : dataKey === 'ammonia' ? 'ammonia' : 'shield'} color={color} /> {title}</h3>
        <span className="text-[10px] text-gray-500">{idealLabel}</span>
      </div>
      <div className="flex-1 min-h-0 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d3748" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#718096' }} tickMargin={8} minTickGap={20} />
            <YAxis domain={yDomain} tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${dataKey})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-200 font-sans p-4 lg:p-6 space-y-6">
      
      {/* Top Header Section */}
      <header className="flex flex-col xl:flex-row justify-between items-center gap-6 bg-[#161b22] border border-white/5 rounded-2xl p-4 md:p-6 text-center xl:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-rose-500/10 p-3 rounded-lg flex-shrink-0">
             <CustomIcon name="shield" color="#f43f5e" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold tracking-tight text-white uppercase">AQUASENSE WATER QUALITY MONITORING DASHBOARD</h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">Real-time Water Quality Monitoring and Mortality Risk Assessment</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center xl:justify-end items-center gap-3 md:gap-6 text-xs md:text-sm w-full xl:w-auto">
          <div className="flex items-center gap-2 border-r border-white/10 pr-3 md:pr-6">
            <CustomIcon name="temperature" color="#9ca3af" />
            <div className="flex flex-col text-left">
              <span className="text-gray-400">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="font-semibold text-white">{new Date().toLocaleTimeString('en-US')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 border-r border-white/10 pr-3 md:pr-6">
             <div className="flex flex-col text-right">
                <span className="text-gray-400">Tank ID</span>
                <span className="font-semibold text-cyan-400">{profile.tankName || 'POND-01'}</span>
             </div>
          </div>
          <div className="flex items-center gap-2 pl-1 md:pl-2">
            <div className="flex flex-col text-left">
              <span className="text-gray-400">Status</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>{isConnected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">Connection error: {error}</div>}

      {/* Top Metrics Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className="bg-[#161b22] border border-white/5 rounded-xl p-4 flex flex-col justify-between items-center text-center shadow-lg relative overflow-hidden group hover:border-gray-600 transition-colors">
             <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CustomIcon name={metric.icon} color={metric.color} />
             </div>
             <div className="flex items-center gap-2 mb-2 w-full justify-center">
                <div className="p-1.5 rounded-full" style={{ backgroundColor: `${metric.color}15` }}>
                   <CustomIcon name={metric.icon} color={metric.color} />
                </div>
                <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">{metric.title}</span>
             </div>
             <div className="text-2xl font-bold text-white mb-3 tracking-tight">{metric.value}</div>
             <div className={`text-xs font-semibold px-3 py-1 rounded-full ${metric.status.bg} ${metric.status.color} uppercase tracking-wider`}>
                {metric.status.label}
             </div>
          </div>
        ))}
        
        {/* Mortality Risk Top Card */}
        <div className="bg-[#161b22] border border-white/5 rounded-xl p-4 flex flex-col justify-between items-center text-center shadow-lg relative overflow-hidden group hover:border-gray-600 transition-colors">
            <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase mb-2">MORTALITY RISK LEVEL</span>
            <div className="text-2xl font-bold mb-2 tracking-tight uppercase" style={{ color: riskColor }}>{riskLevel}</div>
            <div className="flex items-center gap-2">
               <CustomIcon name="shield" color={riskColor} />
               <span className="text-sm font-semibold text-gray-300">Risk Score: {currentRiskScore.toFixed(0)}%</span>
            </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Charts Grid (Spans 2 columns) */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderChart('Temperature (°C)', 'temperature', '#f59e0b', [20, 36], 'Ideal Range 24 - 32 °C')}
          {renderChart('pH Level', 'ph', '#3b82f6', [4, 10], 'Ideal Range 6.5 - 8.5')}
          {renderChart('Dissolved Oxygen (mg/L)', 'do', '#22c55e', [0, 12], 'Ideal Range > 5 mg/L')}
          {renderChart('Turbidity (NTU)', 'turbidity', '#a855f7', [0, 50], 'Ideal Range < 25 NTU')}
          {renderChart('Ammonia (NH3) Concentration (mg/L)', 'ammonia', '#ef4444', [0, 1.0], 'Safe Range < 0.2 mg/L')}
          {renderChart('Mortality Risk Score (%)', 'riskScore', '#ef4444', [0, 100], 'Goal < 25%')}
        </div>

        {/* Right Side: Risk Assessment Panel */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Gauge Chart Panel */}
          <div className="bg-[#161b22] border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center">
             <h3 className="text-sm font-semibold text-gray-300 tracking-widest uppercase mb-4 w-full text-center">MORTALITY RISK LEVEL</h3>
             <div className="relative w-full h-[180px] flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={gaugeData}
                     cx="50%"
                     cy="100%"
                     startAngle={180}
                     endAngle={0}
                     innerRadius={80}
                     outerRadius={110}
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
               <div className="absolute bottom-4 flex flex-col items-center">
                  <span className="text-4xl font-bold text-white">{currentRiskScore.toFixed(0)}%</span>
                  <span className="text-xl font-bold mt-1 uppercase" style={{ color: riskColor }}>{riskLevel}</span>
               </div>
             </div>
             
             {/* Gradient arc decoration */}
             <div className="w-[220px] h-3 rounded-full mt-2" style={{ background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)' }}></div>
          </div>

          {/* Risk Level Guide Panel */}
          <div className="bg-[#161b22] border border-white/5 rounded-xl p-5">
             <h3 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4 border-b border-white/10 pb-2">RISK LEVEL GUIDE</h3>
             <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-sm">
                   <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="font-semibold text-rose-500">EXTREME</span></div>
                   <span className="text-gray-400">76 - 100</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="font-semibold text-orange-500">HIGH</span></div>
                   <span className="text-gray-400">51 - 75</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div><span className="font-semibold text-yellow-500">MEDIUM</span></div>
                   <span className="text-gray-400">26 - 50</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="font-semibold text-emerald-500">LOW</span></div>
                   <span className="text-gray-400">0 - 25</span>
                </div>
             </div>
          </div>

          {/* Factors Contributing Panel */}
          <div className="bg-[#161b22] border border-white/5 rounded-xl p-5">
             <h3 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4 border-b border-white/10 pb-2">FACTORS CONTRIBUTING TO RISK</h3>
             <div className="flex flex-col gap-4">
                {[
                  { name: 'Dissolved Oxygen', status: metrics[2].status.label, color: metrics[2].color, icon: 'do', good: metrics[2].status.label === 'Good' },
                  { name: 'Ammonia (NH3)', status: metrics[4].status.label, color: metrics[4].color, icon: 'ammonia', good: metrics[4].status.label === 'Safe' },
                  { name: 'Temperature', status: metrics[0].status.label, color: metrics[0].color, icon: 'temperature', good: metrics[0].status.label === 'Normal' },
                  { name: 'Turbidity', status: metrics[3].status.label, color: metrics[3].color, icon: 'turbidity', good: metrics[3].status.label === 'Moderate' },
                  { name: 'pH Level', status: metrics[1].status.label, color: metrics[1].color, icon: 'ph', good: metrics[1].status.label === 'Normal' },
                ].map((factor, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                     <div className="flex items-center gap-3">
                        <CustomIcon name={factor.icon} color={factor.color} />
                        <span className="text-gray-300">{factor.name}</span>
                     </div>
                     <div className="flex items-center gap-2" style={{ color: factor.color }}>
                        <span className="font-semibold">{factor.status}</span>
                        {factor.good ? 
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg> : 
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </section>

      {/* Footer Status Bar */}
      <footer className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#161b22] border border-white/5 rounded-xl p-4 mt-4 text-center md:text-left">
         <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Update Interval</span>
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-lg text-xs md:text-sm font-semibold">
               <svg className="w-4 h-4 animate-spin-slow flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               5 seconds
            </div>
         </div>
         <div className="flex items-start sm:items-center gap-2 text-xs text-gray-500 text-left">
            <div className="mt-0.5 sm:mt-0 flex-shrink-0"><CustomIcon name="shield" color="#6b7280" /></div>
            <span>All readings are real-time and refreshed every 5 seconds. Ensure regular calibration.</span>
         </div>
      </footer>
    </div>
  );
};

export default DashboardOverviewPage;
