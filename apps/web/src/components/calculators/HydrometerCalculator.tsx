import { useState } from 'react';
import { hydrometerCorrectedSg, formatGravity } from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, ResultRow } from './CalculatorCard';

/** Thin wrapper over the new hydrometerCorrectedSg (hydrometry.ts). No result state (§2.4). */
export function HydrometerCalculator() {
  const { config } = useConfig();
  const [readingSg, setReadingSg] = useState('1.050');
  const [sampleTempC, setSampleTempC] = useState('30');
  const [calibrationTempC, setCalibrationTempC] = useState('20');

  const result = hydrometerCorrectedSg({
    readingSg: Number.parseFloat(readingSg),
    sampleTempC: Number.parseFloat(sampleTempC),
    calibrationTempC: Number.parseFloat(calibrationTempC),
  });

  return (
    <CalculatorCard
      title="Hydrometer Temperature Correction"
      description="Corrects a hydrometer reading taken at a temperature other than the hydrometer's calibration temperature."
      formula="The reading is adjusted for the density change of water between the sample and calibration temperatures."
    >
      <NumericField label="Hydrometer reading (SG)" value={readingSg} onChange={setReadingSg} />
      <NumericField label="Sample temperature (°C)" value={sampleTempC} onChange={setSampleTempC} />
      <NumericField label="Calibration temperature (°C)" value={calibrationTempC} onChange={setCalibrationTempC} />
      <ResultRow label="Corrected gravity" value={formatGravity(result, config.gravityUnit)} />
    </CalculatorCard>
  );
}
