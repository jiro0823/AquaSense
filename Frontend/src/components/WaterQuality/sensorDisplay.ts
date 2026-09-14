import type {WaterQualityReading} from '../../types/water';
// Age each acquisition locally even if the backend or WebSocket stops responding.
export function refreshDisplayReading(reading:WaterQualityReading|null,now=Date.now(),staleMs=15000):WaterQualityReading|null {
  if(!reading) return null;
  const result={...reading};
  const frameStale=now-new Date(reading.timestamp).getTime()>staleMs;
  if(reading.sensorHealth) {
    result.sensorHealth={...reading.sensorHealth};
    for(const name of ['temperature','ph','turbidity','orp'] as const) {
      const s=reading.sensorHealth[name];
      if(frameStale || (s.timestamp && now-Date.parse(s.timestamp)>staleMs)) {
        result.sensorHealth[name]={...s,health:'STALE',valid:false,readyForCalibration:false,reason:'No recent sensor reading received'};
        result[name]=null;
        result.waterQuality={...result.waterQuality,[name]:'UNAVAILABLE'};
      }
    }
  } else if(frameStale) result.temperature=result.ph=result.turbidity=result.orp=null;
  if(frameStale) { result.do=null;result.doMeasured=false; }
  if(result.speciation && (frameStale || !result.sensorHealth?.ph.valid || !result.sensorHealth?.temperature.valid)) {
    result.ammonia=null;
    result.speciation={...result.speciation,status:'UNAVAILABLE',percent:null,fraction:null,pKa:null,nh3N:null,reason:'Valid fresh pH and temperature required'};
  }
  return result;
}
