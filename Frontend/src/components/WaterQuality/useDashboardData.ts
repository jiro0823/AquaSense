import { useEffect, useState } from 'react';
import { useWaterQualityWebSocket } from '../../hooks/useWaterQualityWebSocket';
import { apiClient } from '../../services/apiClient';
import type { HealthAlert, PredictiveAnalyticsResult, PredictionLog } from '../../types/water';
import type { SmsLogEntry } from '../../types/sms';

interface ChartDataPoint {
  time: string;
  temperature?: number;
  ph?: number;
  do?: number;
  turbidity?: number;
  ammonia?: number;
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
        ammonia: reading.ammonia,
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
          ammonia: latestReading.ammonia,
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
      try {
        const response = await apiClient.get<{ predictiveWarning: PredictiveAnalyticsResult; predictionHistory: PredictionLog[]; smsLogs: SmsLogEntry[] }>('/water/dashboard');
        setPredictiveWarning(response.data.predictiveWarning);
        setSmsLogs(response.data.smsLogs || []);
      } catch {
        // no-op
      }
    };

    void loadPredictiveBundle();
    const interval = setInterval(() => void loadPredictiveBundle(), 15000);
    return () => clearInterval(interval);
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
    alerts: activeAlerts.length > 0 ? activeAlerts : ws.alerts,
    activeAlerts,
    recentAlerts,
    batteryLevel,
    tankWaterLevel,
    chartData,
    feedingSchedules,
    feedingLoading,
    predictiveWarning,
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
