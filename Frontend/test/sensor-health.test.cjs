const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
// Compile the actual components for server rendering; no duplicate display implementation.
for(const extension of ['.ts','.tsx']) require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,file);
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {SensorHealthPanel,AmmoniaSpeciationCard}=require('../src/components/WaterQuality/SensorHealthPanel.tsx');
const {refreshDisplayReading}=require('../src/components/WaterQuality/sensorDisplay.ts');
const render=(Component,reading)=>renderToStaticMarkup(React.createElement(Component,{reading}));
test('missing sensors visibly show missing and calibration required',()=>{
 const html=render(SensorHealthPanel,null); assert.match(html,/MISSING/);assert.match(html,/Calibration REQUIRED/);assert.match(html,/ORP/);assert.doesNotMatch(html,/ACCURATE/);
});
test('missing TAN never renders an ammonia concentration',()=>{
 const html=render(AmmoniaSpeciationCard,{speciation:{percent:5.384213,nh3N:null,tan:null,reason:'Fraction only'}});
 assert.match(html,/5.38%/);assert.match(html,/NOT CALCULATED/);assert.match(html,/TAN measurement/);assert.doesNotMatch(html,/Safe|Critical|0\.05 mg/);
});
test('measured TAN uses NH3-N and mg/L as N',()=>{
 const html=render(AmmoniaSpeciationCard,{speciation:{percent:5.384213,nh3N:0.053842,tan:{value:1},reason:'TAN measured'}});
 assert.match(html,/Actual NH3-N/);assert.match(html,/0.05384 mg\/L as N/);assert.match(html,/PRELIMINARY/);
});
test('stale speciation renders unavailable',()=>{
 const html=render(AmmoniaSpeciationCard,{speciation:{percent:null,nh3N:null,tan:null,reason:'Valid fresh pH and temperature required'}});
 assert.match(html,/UNAVAILABLE/);assert.match(html,/Valid fresh/);
});
test('invalid diagnostic value is not displayed as a measurement',()=>{
 const html=render(SensorHealthPanel,{sensorHealth:{temperature:{valid:false,value:-127,health:'SENSOR_ERROR',stability:'COLLECTING',reason:'DS18B20 disconnected',window:{}}}});
 assert.match(html,/SENSOR_ERROR/);assert.match(html,/DS18B20 disconnected/);assert.doesNotMatch(html,/-127/);
});
test('source freshness expires even while the enclosing frame is fresh',()=>{
 const now=Date.now(), timestamp=new Date(now).toISOString();
 const sensors=Object.fromEntries(['temperature','ph','turbidity','orp'].map(name=>[name,{name,timestamp: name==='ph'?new Date(now-16000).toISOString():timestamp,valid:true,health:'VALID'}]));
 const original={timestamp,ph:8,sensorHealth:sensors,speciation:{percent:5.38,nh3N:null}};
 const result=refreshDisplayReading(original,now);
 assert.equal(result.ph,null);assert.equal(result.sensorHealth.ph.health,'STALE');assert.equal(result.speciation.percent,null);
 assert.equal(original.ph,8);assert.equal(original.sensorHealth.ph.health,'VALID');
});
