import test,{mock,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {SensorReading as Model} from '../database/models/SensorReading';
import * as database from '../database/connection';
import {sensorReadingService} from './sensorReadingService';
import {predictiveAnalyticsService} from './predictiveAnalytics.service';
import {waterAlertNotificationService} from './waterAlertNotification.service';
import {MQTTService} from './mqttService';
import {logger} from '../utils/logger';
import {waterReadingSchema,sensorIngestSchema} from '../middleware/validate';
import {SensorValidator, timestampMs} from './sensorHealth';
afterEach(()=>mock.restoreAll());
function storage() {
  const rows:any[]=[];
  mock.method(logger,'info',()=>{});mock.method(logger,'warn',()=>{});
  mock.method(Model,'create',async (values:any)=>{const r={...values,id:`test-${rows.length}`,createdAt:new Date(),updatedAt:new Date()};rows.unshift(r);return r;});
  mock.method(Model,'findOne',async(options:any={})=>{
    const where=options?.where??{};
    if(where.bootId!==undefined && where.sequenceId!==undefined) return rows.find(r=>r.deviceId===where.deviceId && r.bootId===where.bootId && r.sequenceId===where.sequenceId)??null;
    return rows.find(r=>!where.deviceId || r.deviceId===where.deviceId)??null;
  });
  mock.method(Model,'findAll',async()=>rows);
  mock.method(database,'getDatabase',()=>({query:async()=>[],transaction:async(work:(transaction:object)=>unknown)=>work({})} as any));
  return rows;
}
test('HTTP schemas preserve null, missing and malformed readings for diagnostics',()=>{
  for(const schema of [waterReadingSchema,sensorIngestSchema]) {
    const data=schema.parse({deviceId:'test',temperature:null,ph:'7junk',sensors:{ph:{rawAdc:3000}},tan:{value:1}});
    assert.equal(data.temperature,null);assert.equal(data.ph,'7junk');assert.equal(data.do,undefined);assert.ok(data.sensors);
  }
});
test('production ingestion retains error diagnostics, rejects legacy DO input and never invents ammonia',async()=>{
  const rows=storage();
  const r=await sensorReadingService.ingest('error-test',{temperature:-127,ph:8,turbidity:1800,turbidityUnit:'raw_adc',orp:220,do:7,dissolvedOxygen:8,sensors:{ph:{rawAdc:3000,voltage:2.4}},ammonia:0.5});
  assert.equal(r.temperature,null);assert.equal(r.sensorHealth.temperature.value,-127);assert.equal(r.sensorHealth.temperature.health,'SENSOR_ERROR');
  assert.equal(r.sensorHealth.ph.rawAdc,3000);assert.equal(r.do,null);assert.equal(r.doMeasured,false);assert.equal(r.ammonia,null);assert.equal(r.speciation.status,'UNAVAILABLE');
  assert.equal(rows[0].temperature,null);assert.equal(rows[0].ammonia,null);
});
test('faulted MQTT frames retain health metadata without accepting uncalibrated ORP as mV',async()=>{
  storage();const notify=mock.method(waterAlertNotificationService,'processReading',async()=>({alertsCreated:0,smsSentCount:0}));
  const service=new MQTTService();let received:any;
  service.setRealtimeHandlers({onReadingReceived:r=>received=r});
  await (service as any).handleSensorReading(JSON.stringify({deviceId:'mqtt-fault-test',temperature:-127,ph:null,turbidity:1800,turbidityUnit:'raw_adc',orp:220}));
  assert.equal(received.temperature,null);assert.equal(received.sensorHealth.ph.health,'MISSING');assert.equal(received.orp,null);
  assert.equal(received.sensorHealth.orp.health,'MISSING');assert.equal(received.do,null);assert.equal(received.doMeasured,false);
  assert.equal((notify.mock.calls[0].arguments as any)[0].temperature,null);
});
test('latest read ages sensors and speciation without new packets; history retains acquisition diagnostics',async()=>{
  const rows=storage();const now=Date.now();
  const r=await sensorReadingService.ingest('freshness-test',{temperature:25,ph:8,orp:220,turbidity:1800,turbidityUnit:'raw_adc'});
  assert.equal(r.speciation.status,'UNAVAILABLE');assert.match(r.speciation.reason,/Calibrated/);
  mock.method(Date,'now',()=>now+20000);
  const latest=await sensorReadingService.getLatestReading();assert.equal(latest!.sensorHealth.ph.health,'STALE');assert.equal(latest!.ph,null);assert.equal(latest!.speciation.status,'UNAVAILABLE');
  assert.equal(rows[0].sensorHealth.ph.health,'VALID');assert.equal((await sensorReadingService.getReadingsByTimeRange())[0].ph,8);
});
test('measured TAN persists with explicit NH3-N units and rejects old ammonia input',async()=>{
  storage();const r=await sensorReadingService.ingest('tan-test',{temperature:25,ph:8,tan:{value:1,unit:'mg/L as N',source:'manual',validated:true,timestamp:new Date().toISOString()},ammonia:999});
  assert.equal(r.ammonia,null);assert.equal(r.speciation.tan?.value,1);assert.equal(r.speciation.nh3N,null);
  assert.equal(r.speciation.status,'UNAVAILABLE');assert.equal(r.speciation.concentrationUnit,'mg/L as N');
});
test('current failure prevents fallback to older healthy prediction history',async()=>{
  storage();const firstAcquiredAt=Date.now()-2;
  await sensorReadingService.ingest('prediction-test',{temperature:25,ph:7.5,do:6,turbidity:20,turbidityUnit:'NTU',acquiredAt:new Date(firstAcquiredAt).toISOString()});
  await sensorReadingService.ingest('prediction-test',{temperature:-127,ph:7.5,do:6,turbidity:20,turbidityUnit:'NTU',acquiredAt:new Date(firstAcquiredAt+1).toISOString()});
  const prediction=await predictiveAnalyticsService.getWarningCard();assert.equal(prediction.analysisStatus,'INSUFFICIENT_VALID_SENSOR_DATA');assert.equal(prediction.riskScore,null);
});
test('uncalibrated measured parameters cannot produce a mortality forecast',async()=>{
  storage();await sensorReadingService.ingest('prediction-valid',{temperature:25,ph:7.5,do:6,turbidity:20,turbidityUnit:'NTU'});
  const prediction=await predictiveAnalyticsService.getWarningCard();assert.equal(prediction.analysisStatus,'INSUFFICIENT_VALID_SENSOR_DATA');assert.equal(prediction.riskScore,null);assert.equal(prediction.calibration,'REQUIRED');
});
test('raw turbidity and absent DO block the existing mortality model',async()=>{
  storage();await sensorReadingService.ingest('raw-risk-test',{temperature:25,ph:8,turbidity:1800,turbidityUnit:'raw_adc'});
  const prediction=await predictiveAnalyticsService.getWarningCard();assert.equal(prediction.riskScore,null);assert.equal(prediction.latest,null);
});
test('unsafe pH has VALID health and CRITICAL water quality independently',async()=>{
  storage(); const r=await sensorReadingService.ingest('unsafe-health',{temperature:25,ph:9.5,turbidity:1800,turbidityUnit:'raw_adc'});
  assert.equal(r.sensorHealth.ph.health,'VALID');assert.equal(r.sensorHealth.ph.calibration,'REQUIRED');assert.equal(r.waterQuality.ph,'CRITICAL');assert.equal(r.status,'critical');
});
test('per-sensor acquisition age blocks a stale dependency even inside a fresh frame',async()=>{
  storage(); const r=await sensorReadingService.ingest('sensor-age',{temperature:25,ph:8,sensors:{ph:{sampleAgeMs:20000}}});
  assert.equal(r.sensorHealth.temperature.health,'VALID');assert.equal(r.sensorHealth.ph.health,'STALE');assert.equal(r.speciation.status,'UNAVAILABLE');
});
test('replayed acquisition cannot refresh age or train the stability window',async()=>{
  const rows=storage(), now=Date.now(), payload={temperature:25,ph:8,bootId:'boot-1',sequence:1,acquiredAt:new Date(now).toISOString(),sensors:{ph:{sampleAgeMs:0}}};
  const first=await sensorReadingService.ingest('replay-test',payload);
  const replay=await sensorReadingService.ingest('replay-test',payload);
  assert.equal(replay.id,first.id);assert.equal(rows.length,1);
});
test('new frame after restart is ordered against persisted device history',async()=>{
  const rows=storage(), now=Date.now();
  const first={temperature:25,ph:8,bootId:'boot-durable',sequence:10,acquiredAt:new Date(now).toISOString()};
  await sensorReadingService.ingest('durable-order-test',first);
  // A process restart clears the in-memory validator window; persisted ordering must still reject this frame.
  (sensorReadingService as any).validator=new SensorValidator();
  mock.method(Date,'now',()=>now+3000);
  await assert.rejects(sensorReadingService.ingest('durable-order-test',{...first,sequence:9,acquiredAt:new Date(now+1000).toISOString()}),/Obsolete sensor frame/);
  assert.equal(rows.length,1);
});
test('raw burst diagnostics survive production storage',async()=>{
  storage(); const r=await sensorReadingService.ingest('burst-storage',{ph:8,sensors:{ph:{rawAdc:3000,voltage:2.4,adcMinimum:2999,adcMaximum:3001,adcLast:3000,clippedSamples:0}}});
  assert.equal(r.sensorHealth.ph.adcMinimum,2999);assert.equal(r.sensorHealth.ph.adcMaximum,3001);assert.equal(r.sensorHealth.ph.adcLast,3000);
});
test('ingestion uses the same timestamp normalization rules for ISO and millisecond epochs',async()=>{
  const rows=storage(), now=Date.now();
  const iso=await sensorReadingService.ingest('timestamp-iso',{temperature:25,acquiredAt:new Date(now).toISOString()});
  assert.equal(rows.length,1);assert.equal(iso.timestamp.getTime(),now);
  const next=now+1;
  const numeric=await sensorReadingService.ingest('timestamp-ms',{temperature:25,acquiredAt:next});
  assert.equal(numeric.timestamp.getTime(),next);assert.equal(timestampMs(next),next);
  for(const acquiredAt of [now/1000,Number.NaN,Number.POSITIVE_INFINITY,-1,'1726286400','not-a-timestamp',now-16000,now+3000]) {
    await assert.rejects(sensorReadingService.ingest(`timestamp-invalid-${String(acquiredAt)}`,{temperature:25,acquiredAt}),/Invalid, future, or stale acquisition timestamp/);
  }
  assert.equal(rows.length,2);
});
test('turbidity statistics never combine raw ADC and NTU values',async()=>{
  const rows=storage(), now=Date.now();
  await sensorReadingService.ingest('mixed-unit-history',{turbidity:1800,turbidityUnit:'raw_adc',acquiredAt:new Date(now).toISOString()});
  await sensorReadingService.ingest('mixed-unit-history',{turbidity:12,turbidityUnit:'NTU',acquiredAt:new Date(now+1).toISOString()});
  const stats=await sensorReadingService.getStatistics();
  assert.equal(rows.length,2);assert.deepEqual(stats.turbidity,{parameter:'turbidity',current:12,average:12,min:12,max:12});
});
