const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
// Compile the actual components for server rendering; no duplicate display implementation.
for(const extension of ['.ts','.tsx']) require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,file);
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {SensorHealthPanel,AmmoniaSpeciationCard}=require('../src/components/WaterQuality/SensorHealthPanel.tsx');
const {refreshDisplayReading,currentWaterSensorValue}=require('../src/components/WaterQuality/sensorDisplay.ts');
const {readingsForDevice,toDiagnosticChartPoint}=require('../src/components/WaterQuality/dashboardDiagnostics.ts');
const render=(Component,value)=>renderToStaticMarkup(React.createElement(Component,Component===AmmoniaSpeciationCard?{measurement:value}:{reading:value}));
const tanRecord=(overrides={})=>({id:'tan-1',deviceId:'tank-1',enteredByUserId:'user-1',value:1,unit:'mg/L as N',source:'test_kit',sampleCollectedAt:'2026-10-01T02:00:00.000Z',enteredAt:'2026-10-01T02:05:00.000Z',validationEvidence:'Kit lot 42, expiry 2027-04',validationStatus:'USER_ATTESTED',speciationStatus:'AVAILABLE',speciationReason:'Calculated from measured TAN and aligned pH and temperature',nh3Fraction:0.053842,nh3N:0.053842,environmentalReadingId:'water-1',...overrides});
test('missing sensors visibly show missing and calibration required',()=>{
 const html=render(SensorHealthPanel,null); assert.match(html,/MISSING/);assert.match(html,/Calibration REQUIRED/);assert.match(html,/ORP/);assert.doesNotMatch(html,/ACCURATE/);
});
test('missing TAN keeps both TAN and NH3-N unavailable',()=>{
 const html=render(AmmoniaSpeciationCard,null);
 assert.match(html,/UNAVAILABLE/);assert.match(html,/TAN: NOT AVAILABLE/);assert.match(html,/NH3-N: NOT CALCULATED/);assert.match(html,/TAN measurement/);assert.doesNotMatch(html,/Safe|Critical|0\.05 mg/);
});
test('measured TAN displays NH3 fraction, NH3-N and provenance',()=>{
 const html=render(AmmoniaSpeciationCard,tanRecord());
 assert.match(html,/5\.38%/);assert.match(html,/TAN: 1 mg\/L as N/);assert.match(html,/0\.05384 mg\/L as N/);assert.match(html,/user attested/);assert.match(html,/Kit lot 42/);
});
test('stale speciation renders unavailable',()=>{
 const html=render(AmmoniaSpeciationCard,tanRecord({speciationStatus:'UNAVAILABLE',speciationReason:'Valid fresh pH and temperature required',nh3Fraction:null,nh3N:null}));
 assert.match(html,/UNAVAILABLE/);assert.match(html,/Valid fresh/);assert.match(html,/TAN: 1 mg\/L as N/);assert.match(html,/NH3-N: NOT CALCULATED/);
});
test('invalid diagnostic value is not displayed as a measurement',()=>{
 const html=render(SensorHealthPanel,{sensorHealth:{temperature:{valid:false,value:-127,health:'SENSOR_ERROR',stability:'COLLECTING',reason:'DS18B20 disconnected',window:{}}}});
 assert.match(html,/SENSOR_ERROR/);assert.match(html,/DS18B20 disconnected/);assert.doesNotMatch(html,/-127/);
});
test('reported uncalibrated ORP stays clearly diagnostic while health remains missing',()=>{
 const health={valid:false,value:494.7,unit:'mV',health:'MISSING',calibration:'REQUIRED',stability:'COLLECTING',reason:'ORP engineering conversion/calibration is not commissioned by the backend',window:{}};
 const html=render(SensorHealthPanel,{orp:494.7,sensorHealth:{orp:health}});
 assert.match(html,/--.*MISSING/);assert.match(html,/Device-reported diagnostic: 494\.70 mV/);assert.match(html,/uncalibrated, not a validated measurement/);
});
test('provisional diagnostics display only as unverified estimates with acquisition freshness',()=>{
 const health={valid:false,value:null,unit:'pH',health:'MISSING',stability:'COLLECTING',calibration:'REQUIRED',reason:'Raw signal available; engineering conversion is unavailable',timestamp:new Date().toISOString(),provisional:{value:7.25,unit:'pH',status:'UNVERIFIED'},window:{count:0}};
 const html=render(SensorHealthPanel,{ph:null,sensorHealth:{ph:health},waterQuality:{ph:'UNAVAILABLE'}});
 assert.match(html,/Provisional estimate: 7\.25 pH · UNVERIFIED/);
 assert.match(html,/Freshness: RECENT/);
 assert.match(html,/Water quality: UNAVAILABLE/);
 assert.match(html,/--.*MISSING/);
});
test('temperature health does not show analog provisional estimates',()=>{
 const temperature={valid:false,value:null,unit:'C',health:'MISSING',stability:'COLLECTING',calibration:'REQUIRED',reason:'No sensor reading supplied',timestamp:new Date().toISOString(),provisional:{value:25,unit:'pH',status:'UNVERIFIED'},window:{count:0}};
 const html=render(SensorHealthPanel,{sensorHealth:{temperature}});
 assert.match(html,/TEMPERATURE/);
 const temperatureBlock=html.split('<strong>TEMPERATURE</strong>')[1].split('<strong>pH</strong>')[0];
 assert.doesNotMatch(temperatureBlock,/Provisional estimate/);
});
test('stale provisional estimates remain labeled unverified and stale',()=>{
 const health={valid:false,value:null,unit:'pH',health:'STALE',stability:'COLLECTING',calibration:'REQUIRED',reason:'No recent sensor reading received',timestamp:new Date(Date.now()-20000).toISOString(),provisional:{value:7.25,unit:'pH',status:'UNVERIFIED'},window:{count:0}};
 const html=render(SensorHealthPanel,{ph:null,sensorHealth:{ph:health}});
 assert.match(html,/Provisional estimate: 7\.25 pH · UNVERIFIED/);
 assert.match(html,/Freshness: STALE/);
});
test('old frames without provisional diagnostics and null estimates show unavailable',()=>{
 const oldFrame=render(SensorHealthPanel,{sensorHealth:{ph:{valid:false,value:null,health:'MISSING',stability:'COLLECTING',calibration:'REQUIRED',reason:'No sensor reading supplied',window:{count:0}}}});
 const nullEstimate=render(SensorHealthPanel,{sensorHealth:{ph:{valid:false,value:null,health:'MISSING',stability:'COLLECTING',calibration:'REQUIRED',reason:'No sensor reading supplied',provisional:null,window:{count:0}}}});
 assert.match(oldFrame,/Provisional estimate: UNAVAILABLE/);
 assert.match(nullEstimate,/Provisional estimate: UNAVAILABLE/);
 assert.doesNotMatch(oldFrame,/Freshness: RECENT/);
});
test('parameter current sensor values follow the same latest reading, not stale statistics',()=>{
 const reading={temperature:25,ph:7.5,orp:494.7,turbidity:346};
 assert.equal(currentWaterSensorValue(reading,'turbidity'),346);
 assert.equal(currentWaterSensorValue(reading,'orp'),494.7);
 assert.equal(currentWaterSensorValue(null,'turbidity'),null);
});
test('provisional estimates never substitute for validated current sensor values',()=>{
 const reading={ph:null,sensorHealth:{ph:{provisional:{value:7.25,unit:'pH',status:'UNVERIFIED'}}}};
 assert.equal(currentWaterSensorValue(reading,'ph'),null);
});
test('source freshness expires even while the enclosing frame is fresh',()=>{
 const now=Date.now(), timestamp=new Date(now).toISOString();
 const sensors=Object.fromEntries(['temperature','ph','turbidity','orp'].map(name=>[name,{name,timestamp: name==='ph'?new Date(now-16000).toISOString():timestamp,valid:true,health:'VALID'}]));
 const original={timestamp,ph:8,sensorHealth:sensors,speciation:{percent:5.38,nh3N:null}};
 const result=refreshDisplayReading(original,now);
 assert.equal(result.ph,null);assert.equal(result.sensorHealth.ph.health,'STALE');assert.equal(result.speciation.percent,null);
 assert.equal(original.ph,8);assert.equal(original.sensorHealth.ph.health,'VALID');
});
test('dashboard diagnostic points retain raw ADC and only explicitly unverified estimates',()=>{
 const reading={deviceId:'esp32-feeder-1',sensorHealth:{ph:{rawAdc:1870,provisional:{value:7.25,unit:'pH',status:'UNVERIFIED'}},turbidity:{rawAdc:4095,provisional:{value:22,unit:'NTU',status:'INVALID'}},orp:{rawAdc:4095,provisional:{value:180,unit:'mV',status:'UNVERIFIED'}}}};
 assert.deepEqual(toDiagnosticChartPoint(reading),{deviceId:'esp32-feeder-1',rawPhAdc:1870,provisionalPh:7.25,rawTurbidityAdc:4095,provisionalTurbidity:null,rawOrpAdc:4095,provisionalOrp:180});
});
test('diagnostic history is restricted to the latest device',()=>{
 const a={deviceId:'device-a'},b={deviceId:'device-b'};
 assert.deepEqual(readingsForDevice([a,b],b.deviceId),[b]);
});
