import type { WaterQualityReading } from '../../types/water';
export function SensorHealthPanel({reading}:{reading:WaterQualityReading|null}) {
  const health=reading?.sensorHealth;
  return <section className="shrink-0 rounded-xl border border-gray-200 bg-white p-3 text-xs" aria-label="Sensor health and calibration readiness">
    <div className="mb-2 font-semibold">Sensor health · Calibration REQUIRED</div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(['temperature','ph','turbidity','orp'] as const).map(name=> {
        const s=health?.[name];
        return <div key={name}>
          <strong>{name === 'ph' ? 'pH' : name.toUpperCase()}</strong>
          <p>{s?.valid && s.value!==null ? `${s.value.toFixed(2)} ${s.unit}`:'--'} · {s?.health || 'MISSING'}</p>
          <p>Water quality: {reading?.waterQuality?.[name] || 'UNAVAILABLE'}</p>
          <p>Stability: {s?.stability || 'COLLECTING'} · Calibration required</p>
          {s?.reason && <p className="text-amber-800">{s.reason}</p>}
          <details><summary className="cursor-pointer text-blue-700">Calibration diagnostics</summary>
            <p>Raw ADC: {s?.rawAdc ?? '--'} · Input voltage: {s?.voltage?.toFixed(4) ?? '--'} V</p>
            <p>ADC burst: last {s?.adcLast ?? '--'} / min {s?.adcMinimum ?? '--'} / max {s?.adcMaximum ?? '--'} / clipped {s?.clippedSamples ?? '--'}</p>
            <p>Samples: {s?.window.count ?? 0} · Range: {s?.window.range?.toFixed(3) ?? '--'}</p>
            <p>Min: {s?.window.min?.toFixed(3) ?? '--'} · Max: {s?.window.max?.toFixed(3) ?? '--'} · Mean: {s?.window.average?.toFixed(3) ?? '--'}</p>
            <p>Ready for calibration: {s?.readyForCalibration?'YES':'OBSERVE / CHECK'}</p>
          </details>
        </div>;
      })}
    </div>
    <p className="mt-2 text-gray-500">Technically usable and stable signals do not prove measurement accuracy.</p>
  </section>;
}
export function AmmoniaSpeciationCard({reading}:{reading:WaterQualityReading|null}) {
  const s=reading?.speciation;
  return <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs" title="pH and temperature determine the proportion of total ammonia present as unionized NH3. Actual concentration requires Total Ammonia Nitrogen (TAN).">
    <h3 className="font-semibold">Unionized NH3 fraction of TAN</h3>
    <p className="my-1 text-xl font-bold">{s?.percent != null ? `${s.percent.toFixed(2)}%`:'UNAVAILABLE'}</p>
    <p>TAN: {s?.tan ? `${s.tan.value} mg/L as N`:'NOT AVAILABLE'}</p>
    <p>Actual NH3-N: {s?.nh3N != null ? `${s.nh3N.toFixed(5)} mg/L as N`:'NOT CALCULATED — requires TAN measurement'}</p>
    <p className="mt-1">{s?.reason || 'Valid fresh pH and temperature required'}</p>
    <p className="mt-1 text-amber-800">Freshwater estimate · PRELIMINARY · Calibration required</p>
  </div>;
}
