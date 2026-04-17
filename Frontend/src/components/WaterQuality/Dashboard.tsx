/**
 * Water Quality Dashboard with Charts
 * Real-time monitoring with sensor graphs - Clean, Professional Design
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useWaterQualityWebSocket } from '../../hooks/useWaterQualityWebSocket';

interface ChartDataPoint {
  time: string;
  temperature?: number;
  ph?: number;
  do?: number;
  turbidity?: number;
}

export const WaterQualityDashboard: React.FC = () => {
  const { isConnected, latestReading, statistics, alerts, error: wsError, requestStatistics } =
    useWaterQualityWebSocket();
  const navigate = useNavigate();

  const [batteryLevel, setBatteryLevel] = useState(92);
  const [tankWaterLevel, setTankWaterLevel] = useState(78);
  const [isDraining, setIsDraining] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    if (isConnected) {
      requestStatistics(60);
    }
  }, [isConnected, requestStatistics]);

  // Periodic health check for backend connectivity
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const response = await fetch('http://localhost:5000/health', {
          signal: AbortSignal.timeout(3000),
        });
        // Health check is just for logging - WebSocket connection is what matters
        if (!response.ok && isConnected) {
          console.warn('Backend health check failed, but WebSocket still connected');
        }
      } catch (_err) {
        if (isConnected) {
          console.warn('Backend health check failed');
        }
      }
    };

    // Check every 10 seconds
    const healthCheckInterval = setInterval(checkBackendHealth, 10000);
    return () => clearInterval(healthCheckInterval);
  }, [isConnected]);

  useEffect(() => {
    if (latestReading) {
      const time = new Date(latestReading.timestamp).toLocaleTimeString();
      setChartData((prev) => [
        ...prev.slice(-29),
        {
          time,
          temperature: latestReading.temperature,
          ph: latestReading.ph,
          do: latestReading.do,
          turbidity: latestReading.turbidity,
        },
      ]);
    }
  }, [latestReading]);

  useEffect(() => {
    const batteryInterval = setInterval(() => {
      setBatteryLevel((prev) => (prev - 0.1 < 0 ? 0 : prev - 0.1));
    }, 5000);
    return () => clearInterval(batteryInterval);
  }, []);

  const handleDrainWater = () => {
    setIsDraining(true);
    let level = tankWaterLevel;
    const drainInterval = setInterval(() => {
      level -= 5;
      setTankWaterLevel(level);
      if (level <= 0) {
        clearInterval(drainInterval);
        setIsDraining(false);
      }
    }, 300);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header Navigation */}
      <nav className="header sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🌊</div>
              <div>
                <h1 className="text-2xl font-bold text-primary">AquaSense Dashboard</h1>
                <p className="text-xs text-gray-600">Real-time Water Quality Monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isConnected ? (
                <div className="flex items-center gap-2 badge bg-green-100 text-green-800">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                  <span className="text-sm font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 badge bg-red-100 text-red-800">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                  <span className="text-sm font-medium">Offline</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="btn btn-danger btn-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Error Alerts */}
      {wsError && (
        <div className="alert alert-danger max-w-7xl mx-auto mt-4">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Connection Error</p>
            <p className="text-sm">{wsError}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Top Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Health Score */}
          {statistics && (
            <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-b-4 border-accent">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-semibold text-gray-600">Health Score</h3>
                <span className="text-2xl">🎯</span>
              </div>
              <div className="metric">
                <div className="metric-value text-accent">{Math.round(statistics.healthScore)}</div>
                <p className="text-xs text-gray-600 font-medium">Water Quality Rating</p>
                <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-accent to-cyan-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${statistics.healthScore}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Battery Level */}
          <div className="card bg-gradient-to-br from-yellow-50 to-amber-50 border-b-4 border-warning">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Battery Level</h3>
              <span className="text-2xl">🔋</span>
            </div>
            <div className="metric">
              <div className="metric-value text-warning">{batteryLevel.toFixed(0)}%</div>
              <p className="text-xs text-gray-600 font-medium">Solar Panel</p>
              <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-warning to-orange-500 h-full rounded-full" 
                  style={{ width: `${batteryLevel}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Tank Level */}
          <div className="card bg-gradient-to-br from-cyan-50 to-blue-50 border-b-4 border-accent">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-semibold text-gray-600">Tank Level</h3>
              <span className="text-2xl">💧</span>
            </div>
            <div className="metric">
              <div className="metric-value text-primary">{tankWaterLevel.toFixed(0)}%</div>
              <p className="text-xs text-gray-600 font-medium">Water Reserve</p>
              <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-blue-500 h-full rounded-full" 
                  style={{ width: `${tankWaterLevel}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Drain Control */}
          <div className="card bg-gradient-to-br from-red-50 to-orange-50 border-b-4 border-danger flex flex-col justify-between">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Tank Control</h3>
            <button
              onClick={handleDrainWater}
              disabled={isDraining || tankWaterLevel === 0}
              className="btn btn-danger w-full"
            >
              {isDraining ? '🔄 Draining...' : tankWaterLevel === 0 ? '✓ Empty' : '💦 Drain'}
            </button>
          </div>
        </div>

        {/* Main Parameters Section */}
        {statistics ? (
          <div className="space-y-6">
            {/* Parameters Title */}
            <h2 className="section-title">
              <span className="text-2xl">📊</span>
              Real-Time Parameters
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Temperature Chart */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-primary">🌡️ Temperature</h3>
                  <span className="text-3xl font-bold text-orange-500">{statistics.temperature.current.toFixed(1)}°C</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Average</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.temperature.average.toFixed(1)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Min</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.temperature.min.toFixed(1)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Max</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.temperature.max.toFixed(1)}°C</p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData.slice(-20)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} 
                      formatter={(value: any) => (value !== undefined ? `${Number(value).toFixed(1)}°C` : 'N/A')}
                      labelStyle={{ color: '#1f2937' }}
                    />
                    <Line type="monotone" dataKey="temperature" stroke="#f97316" dot={false} strokeWidth={3} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* pH Chart */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-primary">🧪 pH Level</h3>
                  <span className="text-3xl font-bold text-purple-600">{statistics.ph.current.toFixed(2)}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Average</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.ph.average.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Min</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.ph.min.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Max</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.ph.max.toFixed(2)}</p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData.slice(-20)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <YAxis domain={[6, 9]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} 
                      formatter={(value: any) => (value !== undefined ? `${Number(value).toFixed(2)} pH` : 'N/A')}
                      labelStyle={{ color: '#1f2937' }}
                    />
                    <Line type="monotone" dataKey="ph" stroke="#a855f7" dot={false} strokeWidth={3} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Dissolved Oxygen Chart */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-primary">💨 Dissolved Oxygen</h3>
                  <span className="text-3xl font-bold text-green-600">{statistics.do.current.toFixed(2)} mg/L</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Average</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.do.average.toFixed(2)} mg/L</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Min</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.do.min.toFixed(2)} mg/L</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Max</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.do.max.toFixed(2)} mg/L</p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData.slice(-20)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <YAxis domain={[0, 15]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} 
                      formatter={(value: any) => (value !== undefined ? `${Number(value).toFixed(2)} mg/L` : 'N/A')}
                      labelStyle={{ color: '#1f2937' }}
                    />
                    <Line type="monotone" dataKey="do" stroke="#22c55e" dot={false} strokeWidth={3} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Turbidity Chart */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-primary">🌊 Turbidity</h3>
                  <span className="text-3xl font-bold text-yellow-600">{statistics.turbidity.current.toFixed(1)} NTU</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Average</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.turbidity.average.toFixed(1)} NTU</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Min</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.turbidity.min.toFixed(1)} NTU</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase mb-1">Max</p>
                    <p className="text-lg font-semibold text-gray-900">{statistics.turbidity.max.toFixed(1)} NTU</p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData.slice(-20)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <YAxis domain={[0, 150]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} 
                      formatter={(value: any) => (value !== undefined ? `${Number(value).toFixed(1)} NTU` : 'N/A')}
                      labelStyle={{ color: '#1f2937' }}
                    />
                    <Line type="monotone" dataKey="turbidity" stroke="#eab308" dot={false} strokeWidth={3} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-surface rounded-lg">
            <div className="text-5xl animate-bounce mb-4">⏳</div>
            <p className="text-lg font-semibold text-gray-900">Loading sensor data...</p>
            <p className="text-sm text-gray-600 mt-2">Please wait while we connect to your IoT device</p>
          </div>
        )}

        {/* Alerts Section */}
        <div>
          <h2 className="section-title">
            <span className="text-2xl">🚨</span>
            Recent Alerts
          </h2>

          {alerts.length === 0 ? (
            <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-success text-center py-12">
              <p className="text-3xl mb-2">✓</p>
              <p className="text-lg font-bold text-gray-900">All Clear</p>
              <p className="text-sm text-gray-600 mt-2">Water quality is stable and within normal ranges</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`alert ${
                    alert.severity === 'critical'
                      ? 'alert-danger'
                      : alert.severity === 'warning'
                        ? 'alert-warning'
                        : 'alert-info'
                  }`}
                >
                  <span className="text-lg font-bold flex-shrink-0">
                    {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️'}
                  </span>
                  <div className="flex-1">
                    <p className="font-bold capitalize">{alert.parameter} Alert</p>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs opacity-75 mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-surface py-8 text-center text-gray-600">
        <p className="font-medium">🌊 AquaSense • Crayfish Farm Water Quality Management</p>
        <p className="mt-2 text-sm">Real-time monitoring • Automated control • Smart farming</p>
      </footer>
    </div>
  );
};
