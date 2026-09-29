import { refreshDisplayReading } from './sensorDisplay';
import { useEffect, useRef, useState } from 'react';
import { useWaterQualityWebSocket } from '../../hooks/useWaterQualityWebSocket';
import { apiClient } from '../../services/apiClient';
import type { WaterQualityReading, HealthAlert, PredictiveAnalyticsResult, PredictionLog } from '../../types/water';
import type { SmsLogEntry } from '../../types/sms';

interface ChartDataPoint {
  time: string;
  temperature?: number|null;
  ph?: number|null;
  do?: number|null;
  turbidity?: number|null;
  turbidityUnit?: string;
  ammonia?: number|null;
}

interface FeedingSchedule {
  id: string;
  date: string | null;
  time: string;
  enabled: boolean;
  label: string | null;
}

export const useDashboardData = () => {
  const ws = useWaterQualityWebSocket();
  const { isConnected, latestReading, historyReadings, requestStatistics, requestLatestReading, requestHistory } = ws;

  const [polledReading, setPolledReading] = useState<WaterQualityReading|null>(null);
  const [restError, setRestError] = useState<string|null>(null);
  const dashboardRequestSequence = useRef(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(timer); },[]);
  const newest = polledReading && (!latestReading || new Date(polledReading.createdAt || polledReading.timestamp)>=new Date(latestReading.createdAt || latestReading.timestamp)) ? polledReading : latestReading;
  const displayReading = refreshDisplayReading(newest,now);
  const [batteryLevel, setBatteryLevel] = useState(92);
  const [tankWaterLevel, setTankWaterLevel] = useState(78);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [feedingSchedules, setFeedingSchedules] = useState<FeedingSchedule[]>([]);
  const [feedingLoading, setFeedingLoading] = useState(false);
  const [predictiveWarning, setPredictiveWarning] = useState<PredictiveAnalyticsResult | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLogEntry[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<HealthAlert[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<HealthAlert[]>([]);

  useEffect(() => {
    if (isConnected) {
      requestStatistics(60);
      requestLatestReading();
      requestHistory(60);
    }
  }, [isConnected, requestStatistics, requestLatestReading, requestHistory]);

  useEffect(() => {
    if (!historyReadings.length) return;
    const sorted = [...historyReadings]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-30)
      .map((reading) => ({
        time: new Date(reading.timestamp).toLocaleTimeString(),
        temperature: reading.temperature,
        ph: reading.ph,
        do: reading.doMeasured === false ? undefined : reading.do,
        turbidity: reading.turbidity,
        turbidityUnit: reading.turbidityUnit,
        ammonia: reading.speciation?.percent ?? null,
      }));
    setChartData(sorted);
  }, [historyReadings]);

  useEffect(() => {
    if (!latestReading) return;
    const time = new Date(latestReading.timestamp).toLocaleTimeString();
    setChartData((prev) => {
      const deduped = prev.filter((point) => point.time !== time);
      return [
        ...deduped.slice(-29),
        {
          time,
          temperature: latestReading.temperature,
          ph: latestReading.ph,
          do: latestReading.doMeasured === false ? undefined : latestReading.do,
          turbidity: latestReading.turbidity,
          turbidityUnit: latestReading.turbidityUnit,
          ammonia: latestReading.speciation?.percent ?? null,
        },
      ];
    });
  }, [latestReading]);

  const loadFeedingSchedules = async () => {
    try {
      setFeedingLoading(true);
      const response = await apiClient.get<FeedingSchedule[]>('/feeding/schedules');
      setFeedingSchedules(response.data || []);
    } finally {
      setFeedingLoading(false);
    }
  };

  useEffect(() => {
    void loadFeedingSchedules();
  }, []);

  useEffect(() => {
    const loadPredictiveBundle = async () => {
      const requestSequence=++dashboardRequestSequence.current;
      try {
        const response = await apiClient.get<{ latest:WaterQualityReading|null; predictiveWarning: PredictiveAnalyticsResult; predictionHistory: PredictionLog[]; smsLogs: SmsLogEntry[] }>('/water/dashboard');
        if (requestSequence!==dashboardRequestSequence.current) return;
        const incoming=response.data.latest;
        const incomingAt=incoming ? new Date(incoming.timestamp).getTime() : NaN;
        if (incoming && !Number.isFinite(incomingAt)) {
          setRestError('REST response has no valid acquisition timestamp; retaining last known reading');
          setPolledReading((current)=>current?{...current,connectionState:'ERROR'}:current);
          return;
        }
        if (incoming) setPolledReading((current)=> {
          const currentAt=current ? new Date(current.timestamp).getTime() : NaN;
          if (current && Number.isFinite(currentAt) && incomingAt<currentAt) return current;
          if (current && incomingAt===currentAt) return {...current,connectionState:'LIVE'};
          return {...incoming,connectionState:'LIVE'};
        });
        setPredictiveWarning(response.data.predictiveWarning);
        setSmsLogs(response.data.smsLogs || []);
        setRestError(null);
      } catch {
        if (requestSequence!==dashboardRequestSequence.current) return;
        setRestError('REST refresh failed; showing last known data with original acquisition time');
        setPolledReading((current) => current ? { ...current, connectionState: 'ERROR' } : current);
      }
    };

    void loadPredictiveBundle();
    const interval = setInterval(() => void loadPredictiveBundle(), 5000);
    return () => { clearInterval(interval); dashboardRequestSequence.current++; };
  }, []);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const [activeResponse, recentResponse] = await Promise.all([
          apiClient.get<HealthAlert[]>('/alerts?status=ACTIVE&limit=50'),
          apiClient.get<HealthAlert[]>('/alerts?limit=50'),
        ]);
        setActiveAlerts(activeResponse.data || []);
        setRecentAlerts(recentResponse.data || []);
      } catch {
        setActiveAlerts(ws.alerts || []);
        setRecentAlerts(ws.alerts || []);
      }
    };

    void loadAlerts();
    const interval = setInterval(() => void loadAlerts(), 15000);
    return () => clearInterval(interval);
  }, [ws.alerts]);

  useEffect(() => {
    const batteryInterval = setInterval(() => setBatteryLevel((prev) => (prev - 0.1 < 0 ? 0 : prev - 0.1)), 5000);
    return () => clearInterval(batteryInterval);
  }, []);

  const triggerManual = async (action: 'ON' | 'OFF' | 'TRIGGER') => {
    await apiClient.post('/feeding/manual', { action });
    await loadFeedingSchedules();
  };

  const addSchedule = async (date: string, time: string, label: string) => {
    await apiClient.post('/feeding/schedules', { date: date || null, time, label: label || null });
    await loadFeedingSchedules();
  };

  const toggleSchedule = async (item: FeedingSchedule) => {
    await apiClient.put(`/feeding/schedules/${item.id}`, { enabled: !item.enabled });
    await loadFeedingSchedules();
  };

  const removeSchedule = async (id: string) => {
    await apiClient.delete(`/feeding/schedules/${id}`);
    await loadFeedingSchedules();
  };

  const updateSchedule = async (id: string, date: string, time: string, label: string) => {
    await apiClient.put(`/feeding/schedules/${id}`, { date: date || null, time, label: label || null });
    await loadFeedingSchedules();
  };

  const drainWater = () => {
    let level = tankWaterLevel;
    const timer = setInterval(() => {
      level -= 5;
      setTankWaterLevel(level);
      if (level <= 0) {
        clearInterval(timer);
      }
    }, 300);
  };

  return {
    ...ws,
    error: ws.error || restError,
    latestReading: displayReading,
    alerts: activeAlerts.length > 0 ? activeAlerts : ws.alerts,
    activeAlerts,
    recentAlerts,
    batteryLevel,
    tankWaterLevel,
    chartData,
    feedingSchedules,
    feedingLoading,
    predictiveWarning: displayReading?.sensorHealth?.temperature.valid && displayReading.sensorHealth.ph.valid && displayReading.sensorHealth.turbidity.valid && displayReading.doMeasured ? predictiveWarning : null,
    smsLogs,
    setTankWaterLevel,
    drainWater,
    triggerManual,
    addSchedule,
    toggleSchedule,
    removeSchedule,
    updateSchedule,
  };
};
