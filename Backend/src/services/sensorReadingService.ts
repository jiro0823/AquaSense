import { logger } from '../utils/logger';
import { SensorReading as SensorReadingModel } from '../database/models/SensorReading';
import { Op } from 'sequelize';
<<<<<<< Updated upstream
import { orpStatistics, type OrpStatistics } from './sensorValues';

export interface SensorReading {
  id: string;
  deviceId: string;
  temperature: number;
  ph: number;
  do: number;
  doMeasured?: boolean;
  turbidity: number;
  orp?: number | null;
  ammonia: number;
  location: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
=======
import {ruleEngine} from './ruleEngine.service';
import {waterHealthScore} from './sensorValues';
import { SensorValidator, SENSOR_NAMES, numeric, timestampMs, refreshHealth, ammoniaSpeciation, type HealthSummary, type AmmoniaSpeciation, HEALTH_CONFIG } from './sensorHealth';
export interface SensorReading {
  id: string; deviceId: string; temperature: number|null; ph: number|null; do: number|null;
  doMeasured: boolean; turbidity: number|null; orp: number|null; ammonia: number|null;
  turbidityUnit: string; sensorHealth: HealthSummary; speciation: AmmoniaSpeciation;
  waterQuality: Record<string,string>; status: 'normal'|'warning'|'critical'|'unavailable';
  location: string; timestamp: Date; createdAt: Date; updatedAt: Date;
>>>>>>> Stashed changes
}
export interface SensorStatistics { parameter: string; current: number|null; average: number|null; min: number|null; max: number|null }
class SensorReadingService {
<<<<<<< Updated upstream
  /**
   * Add a new sensor reading
   */
  async addSensorReading(
    deviceId: string,
    temperature: number,
    ph: number,
    do_value: number,
    turbidity: number,
    ammonia: number = 0,
    location: string = 'Default Location',
    timestamp: Date = new Date(),
    doMeasured: boolean = true,
    orp: number | null = null
  ): Promise<SensorReading | null> {
    try {
      const reading = await SensorReadingModel.create({
        deviceId,
        temperature,
        ph,
        do: do_value,
        doMeasured,
        orp,
        turbidity,
        ammonia,
        location,
        timestamp,
      });

      logger.info('Sensor reading stored', { id: reading.id, location });
      return this.mapSensorModel(reading);
    } catch (error) {
      logger.error('Error adding sensor reading', error);
      throw error;
=======
  private validator = new SensorValidator();
  private sequences = new Map<string,{boot:string; sequence:number; at:number}>();
  private transitions = new Map<string,string>();
  private logTransitions(device: string, health: HealthSummary) {
    for (const name of SENSOR_NAMES) { const key=`${device}:${name}`, next=health[name].health, prev=this.transitions.get(key);
      if (prev!==next) { logger.info('Sensor health transition',{deviceId:device,sensor:name,from:prev||'MISSING',to:next}); this.transitions.set(key,next); }
>>>>>>> Stashed changes
    }
    if (this.transitions.size>2048) this.transitions.clear();
  }
  async ingest(deviceId: string, payload: Record<string,any>): Promise<SensorReading> {
    const now=Date.now();
    const age=payload.sampleAgeMs===undefined?0:numeric(payload.sampleAgeMs);
    let acquired = payload.timestamp === undefined ? age!==null && age>=0 ? now-age : NaN : timestampMs(payload.timestamp);
    let replay = false;
    if (typeof payload.bootId==='number' && Number.isInteger(payload.sequence) && payload.sequence>=0) {
      const prior=this.sequences.get(deviceId), boot=String(payload.bootId);
      if (prior?.boot===boot && payload.sequence<=prior.sequence) { acquired=prior.at; replay=true; }
      else this.sequences.set(deviceId,{boot,sequence:payload.sequence,at:acquired});
      if(this.sequences.size>512) this.sequences.delete(this.sequences.keys().next().value!);
    }
    const timestamp = Number.isFinite(acquired) ? new Date(acquired) : new Date(now);
    const unit=payload.turbidityUnit === 'raw_adc' ? 'raw_adc' : payload.turbidityUnit === 'NTU' ? 'NTU' : 'unknown';
    const sensorHealth=Object.fromEntries(SENSOR_NAMES.map(name=>[name,this.validator.validate(deviceId,name,
      payload[name], replay ? timestamp : payload.sensorTimestamps?.[name] ?? this.sensorTimestamp(payload.sensors?.[name],now,Number.isFinite(acquired)?timestamp:'invalid'),payload.sensors?.[name],now,name==='turbidity'?unit:undefined)])) as HealthSummary;
    this.logTransitions(deviceId,sensorHealth);
    const speciation=ammoniaSpeciation(sensorHealth,payload.tan,payload.waterType ?? 'freshwater',now);
    const oxygen=numeric(payload.do ?? payload.dissolvedOxygen);
    const doMeasured=payload.doMeasured!==false && oxygen!==null && oxygen>=0 && oxygen<=20 && Number.isFinite(acquired) && now-acquired<=HEALTH_CONFIG.staleMs && acquired<=now+2000;
    const values=Object.fromEntries(SENSOR_NAMES.map(name=>[name,sensorHealth[name].valid ? sensorHealth[name].value : null]));
    const model=await SensorReadingModel.create({...values,deviceId,do:doMeasured?oxygen:null,doMeasured,
      ammonia:speciation.nh3N,turbidityUnit:unit,sensorHealth,speciation,
      location:typeof payload.location==='string'?payload.location.slice(0,255):deviceId,timestamp});
    return this.mapSensorModel(model);
  }
  private sensorTimestamp(diagnostic:any,now:number,fallback:Date|string):Date|string {
    if(diagnostic?.sampleAgeMs===undefined) return fallback;
    const age=numeric(diagnostic.sampleAgeMs);
    return age!==null && age>=0 ? new Date(now-age) : 'invalid';
  }
<<<<<<< Updated upstream

  /**
   * Get statistics for a parameter within time range
   */
  async getStatistics(minutes: number = 60): Promise<{
    temperature: SensorStatistics;
    ph: SensorStatistics;
    do: SensorStatistics;
    turbidity: SensorStatistics;
    ammonia: SensorStatistics;
    orp: OrpStatistics;
  }> {
    try {
      const readings = await this.getReadingsByTimeRange(minutes);

      if (readings.length === 0) {
        return {
          orp: orpStatistics([]),
          temperature: { parameter: 'Temperature', current: 0, average: 0, min: 0, max: 0 },
          ph: { parameter: 'pH', current: 0, average: 0, min: 0, max: 0 },
          do: { parameter: 'Dissolved Oxygen', current: 0, average: 0, min: 0, max: 0 },
          turbidity: { parameter: 'Turbidity', current: 0, average: 0, min: 0, max: 0 },
          ammonia: { parameter: 'Ammonia', current: 0, average: 0, min: 0, max: 0 },
        };
      }

      const latestReading = readings[0];

      const calculateStats = (dataArray: number[]): { average: number; min: number; max: number } => {
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const min = Math.min(...dataArray);
        const max = Math.max(...dataArray);
        return { average, min, max };
      };

      const temps = readings.map((r) => r.temperature);
      const phs = readings.map((r) => r.ph);
      const dos = readings.map((r) => r.do);
      const turbidities = readings.map((r) => r.turbidity);
      const ammonias = readings.map((r) => r.ammonia);

      return {
        orp: orpStatistics(readings),
        temperature: {
          parameter: 'Temperature',
          current: latestReading.temperature,
          ...calculateStats(temps),
        },
        ph: {
          parameter: 'pH',
          current: latestReading.ph,
          ...calculateStats(phs),
        },
        do: {
          parameter: 'Dissolved Oxygen',
          current: latestReading.do,
          ...calculateStats(dos),
        },
        turbidity: {
          parameter: 'Turbidity',
          current: latestReading.turbidity,
          ...calculateStats(turbidities),
        },
        ammonia: {
          parameter: 'Ammonia',
          current: latestReading.ammonia,
          ...calculateStats(ammonias),
        },
      };
    } catch (error) {
      logger.error('Error calculating statistics', error);
      return {
        orp: orpStatistics([]),
        temperature: { parameter: 'Temperature', current: 0, average: 0, min: 0, max: 0 },
        ph: { parameter: 'pH', current: 0, average: 0, min: 0, max: 0 },
        do: { parameter: 'Dissolved Oxygen', current: 0, average: 0, min: 0, max: 0 },
        turbidity: { parameter: 'Turbidity', current: 0, average: 0, min: 0, max: 0 },
        ammonia: { parameter: 'Ammonia', current: 0, average: 0, min: 0, max: 0 },
      };
    }
=======
  async addSensorReading(deviceId:string,temperature:unknown,ph:unknown,do_value:unknown,turbidity:unknown,
    _ammonia:unknown=null,location='Default Location',timestamp=new Date(),doMeasured=true,orp:unknown=null) {
    return this.ingest(deviceId,{temperature,ph,do:do_value,turbidity,location,timestamp:timestamp.toISOString(),doMeasured,orp});
>>>>>>> Stashed changes
  }
  async getLatestReading(): Promise<SensorReading|null> {
    const reading=await SensorReadingModel.findOne({order:[['createdAt','DESC']]});
    return reading?this.mapSensorModel(reading,true):null;
  }
  async getReadingsByTimeRange(minutes=60): Promise<SensorReading[]> {
    const readings=await SensorReadingModel.findAll({where:{timestamp:{[Op.gte]:new Date(Date.now()-minutes*60000)}},order:[['timestamp','DESC']]});
    return readings.map(r=>this.mapSensorModel(r));
  }
<<<<<<< Updated upstream

  /**
   * Map Sequelize SensorReading model to SensorReading interface
   */
  private mapSensorModel(reading: SensorReadingModel): SensorReading {
    return {
      id: reading.id,
      deviceId: reading.deviceId,
      temperature: reading.temperature,
      ph: reading.ph,
      do: reading.do,
      doMeasured: reading.doMeasured,
      orp: reading.orp ?? null,
      turbidity: reading.turbidity,
      ammonia: reading.ammonia,
      location: reading.location,
      timestamp: reading.timestamp,
      createdAt: reading.createdAt,
      updatedAt: reading.updatedAt,
=======
  async getStatistics(minutes=60) {
    const readings=await this.getReadingsByTimeRange(minutes), latest=await this.getLatestReading();
    const stats=(name:'temperature'|'ph'|'do'|'turbidity'|'orp'|'ammonia'):SensorStatistics=>{
      const values=readings.filter(r=>(!latest || r.deviceId===latest.deviceId) && (name!=='turbidity' || r.turbidityUnit===latest?.turbidityUnit)).map(r=>r[name]).filter((v):v is number=>v!==null&&Number.isFinite(v));
      return {parameter:name,current:latest?.[name]??null,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,
        min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null};
>>>>>>> Stashed changes
    };
    return {temperature:stats('temperature'),ph:stats('ph'),do:stats('do'),turbidity:stats('turbidity'),orp:stats('orp'),ammonia:stats('ammonia'),healthScore:waterHealthScore(latest)};
  }
  async getAllReadings(location?:string,limit=100) {
    return (await SensorReadingModel.findAll({where:location?{location}:{},order:[['timestamp','DESC']],limit})).map(r=>this.mapSensorModel(r));
  }
  async deleteOldReadings(minutes=10080) { return SensorReadingModel.destroy({where:{timestamp:{[Op.lt]:new Date(Date.now()-minutes*60000)}}}); }
  private mapSensorModel(reading:SensorReadingModel,current=false):SensorReading {
    const validator=new SensorValidator();
    const at=new Date(reading.timestamp).getTime();
    const original=reading.sensorHealth || Object.fromEntries(SENSOR_NAMES.map(name=>[name,validator.validate(reading.deviceId,name,reading[name],reading.timestamp,{},at)])) as HealthSummary;
    const sensorHealth=current?refreshHealth(original):original;
    if (current) this.logTransitions(reading.deviceId,sensorHealth);
    const speciation=ammoniaSpeciation(sensorHealth,reading.speciation?.tan,reading.speciation?.waterType??'freshwater',current?Date.now():at);
    const stale=current && Date.now()-at>HEALTH_CONFIG.staleMs;
    const alerts=ruleEngine({temperature:sensorHealth.temperature.valid?sensorHealth.temperature.value:null,ph:sensorHealth.ph.valid?sensorHealth.ph.value:null,
      turbidity:sensorHealth.turbidity.valid?sensorHealth.turbidity.value:null,turbidityUnit:reading.turbidityUnit,
      dissolvedOxygen:!stale&&reading.doMeasured?reading.do:null,dissolvedOxygenMeasured:!stale&&reading.doMeasured});
    const condition=(name:'temperature'|'ph'|'turbidity',prefix:string)=> {
      if(!sensorHealth[name].valid) return 'UNAVAILABLE';
      if(name==='turbidity' && reading.turbidityUnit!=='NTU') return 'UNKNOWN (RAW ADC)';
      const related=alerts.filter(a=>a.category.startsWith(prefix));
      return related.some(a=>a.severity==='CRITICAL'||a.severity==='EMERGENCY')?'CRITICAL':related.length?'WARNING':'NORMAL';
    };
    const waterQuality={temperature:condition('temperature','TEMP'),ph:condition('ph','PH'),turbidity:condition('turbidity','TURBIDITY'),orp:'NO WATER-QUALITY POLICY'};
    const status=Object.values(waterQuality).includes('CRITICAL')?'critical':Object.values(waterQuality).includes('WARNING')?'warning':Object.values(waterQuality).includes('UNAVAILABLE')?'unavailable':'normal';
    return {id:reading.id,deviceId:reading.deviceId,temperature:sensorHealth.temperature.valid?sensorHealth.temperature.value:null,
      ph:sensorHealth.ph.valid?sensorHealth.ph.value:null,turbidity:sensorHealth.turbidity.valid?sensorHealth.turbidity.value:null,
      orp:sensorHealth.orp.valid?sensorHealth.orp.value:null,do:!stale&&reading.doMeasured?reading.do:null,
      doMeasured:!stale&&reading.doMeasured,ammonia:speciation.nh3N,sensorHealth,speciation,waterQuality,status,turbidityUnit:reading.turbidityUnit||'unknown',
      location:reading.location,timestamp:reading.timestamp,createdAt:reading.createdAt,updatedAt:reading.updatedAt};
  }
}
export const sensorReadingService=new SensorReadingService();
