import type { WaterQualityReading, TanMeasurementRecord } from '../../types/water';
export function SensorHealthPanel({reading}:{reading:WaterQualityReading|null}) {
  const health=reading?.sensorHealth;
  return <section className="shrink-0 rounded-xl border border-gray-200 bg-white p-3 text-xs" aria-label="Sensor health and calibration readiness">
    <div className="mb-2 font-semibold">Sensor health · Calibration REQUIRED</div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(['temperature','ph','turbidity','orp'] as const).map(name=> {
        const s=health?.[name];
        return <div key={name}>
          <strong>{name === 'ph' ? 'pH' : name.toUpperCase()}</strong>
          <p>Connection: {s?.connection || (s?.communication ? 'CONNECTED' : 'UNKNOWN')}</p>
          <p>{s?.valid && s.value!==null ? `${s.value.toFixed(2)} ${s.unit} · ${s.calibration==='CALIBRATED' && s.stability==='STABLE' ? 'qualified' : 'reported; calibration required'}`:'--'} · {s?.health || 'MISSING'}</p>
          {name==='orp' && s?.health==='MISSING' && s.value!==null && s.reason.includes('not commissioned') &&
            <p className="text-amber-800">Device-reported diagnostic: {s.value.toFixed(2)} mV · uncalibrated, not a validated measurement</p>}
          {s?.rawAvailable && !s.measurementValid && <p className="text-amber-800">Signal available; engineering measurement unavailable</p>}
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
export function AmmoniaSpeciationCard({measurement}:{measurement:TanMeasurementRecord|null}) {
  return <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs" title="Freshwater NH3-N is calculated from measured TAN, pH and temperature only when their sample times align and source sensors qualify.">
    <h3 className="font-semibold">Unionized NH3 fraction of TAN</h3>
    <p className="my-1 text-xl font-bold">{measurement?.nh3Fraction != null ? `${(measurement.nh3Fraction * 100).toFixed(2)}%`:'UNAVAILABLE'}</p>
    <p>TAN: {measurement ? `${measurement.value} ${measurement.unit}`:'NOT AVAILABLE'}</p>
    <p>NH3-N: {measurement?.nh3N != null ? `${measurement.nh3N.toFixed(5)} mg/L as N`:'NOT CALCULATED — aligned qualified pH and temperature required'}</p>
    {measurement && <>
      <p className="mt-1">Source: {measurement.source} · {measurement.validationStatus.toLowerCase().replace('_', ' ')}</p>
      <p>Sample collected: {new Date(measurement.sampleCollectedAt).toLocaleString()} · Entered: {new Date(measurement.enteredAt).toLocaleString()}</p>
      <p>Evidence: {measurement.validationEvidence}</p>
    </>}
    <p className="mt-1">{measurement?.speciationReason || 'Enter an actual TAN measurement; its hazard remains unassessed until then.'}</p>
    <p className="mt-1 text-amber-800">Freshwater estimate only · Calibration and test-method accuracy are not certified by AquaSense.</p>
  </div>;
}
