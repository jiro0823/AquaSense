import test,{mock,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {SensorReading as Model} from '../database/models/SensorReading';
import {sensorReadingService} from './sensorReadingService';
import {predictiveAnalyticsService} from './predictiveAnalytics.service';
import {waterAlertNotificationService} from './waterAlertNotification.service';
import {MQTTService} from './mqttService';
import {logger} from '../utils/logger';
import {waterReadingSchema,sensorIngestSchema} from '../middleware/validate';
afterEach(()=>mock.restoreAll());
function storage() {
  const rows:any[]=[];
  mock.method(logger,'info',()=>{});mock.method(logger,'warn',()=>{});
  mock.method(Model,'create',async (values:any)=>{const r={...values,id:`test-${rows.length}`,createdAt:new Date(),updatedAt:new Date()};rows.unshift(r);return r;});
  mock.method(Model,'findOne',async()=>rows[0]??null);
  mock.method(Model,'findAll',async()=>rows);
  return rows;
}
test('HTTP schemas preserve null, missing and malformed readings for diagnostics',()=>{
  for(const schema of [waterReadingSchema,sensorIngestSchema]) {
    const data=schema.parse({deviceId:'test',temperature:null,ph:'7junk',sensors:{ph:{rawAdc:3000}},tan:{value:1}});
    assert.equal(data.temperature,null);assert.equal(data.ph,'7junk');assert.equal(data.do,undefined);assert.ok(data.sensors);
  }
});
test('production ingestion retains error diagnostics, nulls invalid values and never invents ammonia',async()=>{
  const rows=storage();
  const r=await sensorReadingService.ingest('error-test',{temperature:-127,ph:8,turbidity:1800,turbidityUnit:'raw_adc',orp:220,sensors:{ph:{rawAdc:3000,voltage:2.4}},ammonia:0.5});
  assert.equal(r.temperature,null);assert.equal(r.sensorHealth.temperature.value,-127);assert.equal(r.sensorHealth.temperature.health,'SENSOR_ERROR');
  assert.equal(r.sensorHealth.ph.rawAdc,3000);assert.equal(r.do,null);assert.equal(r.doMeasured,false);assert.equal(r.ammonia,null);assert.equal(r.speciation.status,'UNAVAILABLE');
  assert.equal(rows[0].temperature,null);assert.equal(rows[0].ammonia,null);
});
test('faulted MQTT frames reach storage and realtime UI with health metadata',async()=>{
  storage();const notify=mock.method(waterAlertNotificationService,'processReading',async()=>({alertsCreated:0,smsSentCount:0}));
  const service=new MQTTService();let received:any;
  service.setRealtimeHandlers({onReadingReceived:r=>received=r});
  await (service as any).handleSensorReading(JSON.stringify({deviceId:'mqtt-fault-test',temperature:-127,ph:null,turbidity:1800,turbidityUnit:'raw_adc',orp:220}));
  assert.equal(received.temperature,null);assert.equal(received.sensorHealth.ph.health,'MISSING');assert.equal(received.orp,220);
  assert.equal((notify.mock.calls[0].arguments as any)[0].temperature,null);
});
test('latest read ages sensors and speciation without new packets; history retains acquisition diagnostics',async()=>{
  const rows=storage();const now=Date.now();
  const r=await sensorReadingService.ingest('freshness-test',{temperature:25,ph:8,orp:220,turbidity:1800,turbidityUnit:'raw_adc'});
  assert.equal(r.speciation.status,'AVAILABLE');
  mock.method(Date,'now',()=>now+20000);
  const latest=await sensorReadingService.getLatestReading();assert.equal(latest!.sensorHealth.ph.health,'STALE');assert.equal(latest!.ph,null);assert.equal(latest!.speciation.status,'UNAVAILABLE');
  assert.equal(rows[0].sensorHealth.ph.health,'VALID');assert.equal((await sensorReadingService.getReadingsByTimeRange())[0].ph,8);
});
test('measured TAN persists with explicit NH3-N units and rejects old ammonia input',async()=>{
  storage();const r=await sensorReadingService.ingest('tan-test',{temperature:25,ph:8,tan:{value:1,unit:'mg/L as N',source:'manual',validated:true,timestamp:new Date().toISOString()},ammonia:999});
  assert.ok(Math.abs(r.ammonia!-0.0538421385)<1e-8);assert.equal(r.speciation.concentrationUnit,'mg/L as N');
});
test('current failure prevents fallback to older healthy prediction history',async()=>{
  storage();await sensorReadingService.ingest('prediction-test',{temperature:25,ph:7.5,do:6,turbidity:20,turbidityUnit:'NTU'});
  await sensorReadingService.ingest('prediction-test',{temperature:-127,ph:7.5,do:6,turbidity:20,turbidityUnit:'NTU'});
  const prediction=await predictiveAnalyticsService.getWarningCard();assert.equal(prediction.analysisStatus,'INSUFFICIENT_VALID_SENSOR_DATA');assert.equal(prediction.riskScore,null);
});
test('valid uncalibrated measured parameters produce preliminary analysis without invented ammonia',async()=>{
  storage();await sensorReadingService.ingest('prediction-valid',{temperature:25,ph:7.5,do:6,turbidity:20,turbidityUnit:'NTU'});
  const prediction=await predictiveAnalyticsService.getWarningCard();assert.equal(prediction.analysisStatus,'AVAILABLE');assert.equal(prediction.latest!.ammonia,null);assert.equal(prediction.calibration,'REQUIRED');
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
  storage();const now=Date.now(), payload={temperature:25,ph:8,bootId:123,sequence:1,sensors:{ph:{sampleAgeMs:0}}};
  await sensorReadingService.ingest('replay-test',payload);
  mock.method(Date,'now',()=>now+20000);
  const r=await sensorReadingService.ingest('replay-test',payload);
  assert.equal(r.sensorHealth.ph.health,'STALE');assert.equal(r.speciation.status,'UNAVAILABLE');
});
test('raw burst diagnostics survive production storage',async()=>{
  storage(); const r=await sensorReadingService.ingest('burst-storage',{ph:8,sensors:{ph:{rawAdc:3000,voltage:2.4,adcMinimum:2999,adcMaximum:3001,adcLast:3000,clippedSamples:0}}});
  assert.equal(r.sensorHealth.ph.adcMinimum,2999);assert.equal(r.sensorHealth.ph.adcMaximum,3001);assert.equal(r.sensorHealth.ph.adcLast,3000);
});
