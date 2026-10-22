import { refreshDisplayReading } from './sensorDisplay';
import { readingsForDevice, toDiagnosticChartPoint } from './dashboardDiagnostics';
import { useEffect, useRef, useState } from 'react';
import { useWaterQualityWebSocket } from '../../hooks/useWaterQualityWebSocket';
import { apiClient, getApiErrorMessage } from '../../services/apiClient';
import type { WaterQualityReading, HealthAlert, PredictiveAnalyticsResult, PredictionLog, TanMeasurementRecord } from '../../types/water';
import type { SmsLogEntry } from '../../types/sms';

interface ChartDataPoint {
  timestamp: string;
  time: string;
  deviceId?: string;
  temperature?: number|null;
  ph?: number|null;
  orp?: number|null;
  turbidity?: number|null;
  turbidityUnit?: string;
  tan?: number|null;
  nh3N?: number|null;
  rawPhAdc?: number|null;
  provisionalPh?: number|null;
  rawTurbidityAdc?: number|null;
  provisionalTurbidity?: number|null;
  rawOrpAdc?: number|null;
  provisionalOrp?: number|null;
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
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [tanMeasurements, setTanMeasurements] = useState<TanMeasurementRecord[]>([]);
  const [tanLoading, setTanLoading] = useState(true);
  const [tanError, setTanError] = useState<string|null>(null);
  const [feedingSchedules, setFeedingSchedules] = useState<FeedingSchedule[]>([]);
  const [feedingLoading, setFeedingLoading] = useState(false);
  const [predictiveWarning, setPredictiveWarning] = useState<PredictiveAnalyticsResult | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<PredictionLog[]>([]);
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
    const sorted = readingsForDevice(historyReadings, latestReading?.deviceId)
      .filter((reading) => Number.isFinite(new Date(reading.timestamp).getTime()))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-30)
      .map((reading) => ({
        timestamp: new Date(reading.timestamp).toISOString(),
        time: new Date(reading.timestamp).toLocaleTimeString(),
        ...toDiagnosticChartPoint(reading),
        temperature: reading.temperature,
        ph: reading.ph,
        orp: reading.orp,
        turbidity: reading.turbidity,
        turbidityUnit: reading.turbidityUnit,
        tan: reading.speciation?.tan?.value ?? null,
        nh3N: reading.speciation?.nh3N ?? null,
      }));
    setChartData(sorted);
  }, [historyReadings, latestReading?.deviceId]);

  useEffect(() => {
    const candidates = [polledReading, latestReading].filter((reading): reading is WaterQualityReading => reading !== null);
    const validCandidates = candidates.filter((item) => Number.isFinite(new Date(item.timestamp).getTime()));
    const reading = validCandidates.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[validCandidates.length - 1];
    if (!reading) return;
    const timestamp = new Date(reading.timestamp).toISOString();
    const time = new Date(timestamp).toLocaleTimeString();
    setChartData((prev) => {
      if (prev.some((point) => point.timestamp === timestamp)) return prev;
      return [...prev, {
        timestamp,
        time,
        ...toDiagnosticChartPoint(reading),
        temperature: reading.temperature,
        ph: reading.ph,
        orp: reading.orp,
        turbidity: reading.turbidity,
        turbidityUnit: reading.turbidityUnit,
        tan: reading.speciation?.tan?.value ?? null,
        nh3N: reading.speciation?.nh3N ?? null,
      }].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).slice(-30);
    });
  }, [latestReading, polledReading]);

  useEffect(() => {
    let active = true;
    const loadTanMeasurements = async () => {
      try {
        const response = await apiClient.get<TanMeasurementRecord[]>('/water/tan-measurements?limit=100');
        if (active) {
          setTanMeasurements(response.data || []);
          setTanError(null);
        }
      } catch (requestError: unknown) {
        if (active) setTanError(getApiErrorMessage(requestError, 'TAN history could not be loaded.'));
      } finally {
        if (active) setTanLoading(false);
      }
    };
    void loadTanMeasurements();
    const interval = setInterval(() => void loadTanMeasurements(), 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

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
        setPredictionHistory(response.data.predictionHistory || []);
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

  const triggerManual = async (action: 'ON' | 'OFF' | 'TRIGGER', deviceId?: string) => {
    await apiClient.post('/feeding/manual', { action, ...(deviceId ? { deviceId } : {}) });
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

  const addTanMeasurement = (measurement: TanMeasurementRecord) => {
    setTanMeasurements((current) => [measurement, ...current.filter((item) => item.id !== measurement.id)]
      .sort((a, b) => new Date(b.sampleCollectedAt).getTime() - new Date(a.sampleCollectedAt).getTime()).slice(0, 100));
  };

  return {
    ...ws,
    error: ws.error || restError,
    latestReading: displayReading,
    alerts: activeAlerts.length > 0 ? activeAlerts : ws.alerts,
    activeAlerts,
    recentAlerts,
    chartData,
    tanMeasurements,
    tanLoading,
    tanError,
    latestTanMeasurement: tanMeasurements[0] ?? null,
    feedingSchedules,
    feedingLoading,
    predictiveWarning,
    predictionHistory,
    smsLogs,
    triggerManual,
    addSchedule,
    toggleSchedule,
    removeSchedule,
    updateSchedule,
    addTanMeasurement,
  };
};
