import { useState } from 'react';
import {
  refractometerOriginalGravity,
  refractometerFinalGravity,
  DEFAULT_WORT_CORRECTION_FACTOR,
  formatGravity,
} from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, ResultRow } from './CalculatorCard';

/**
 * Thin wrapper over the new refractometerOriginalGravity / refractometerFinalGravity
 * (hydrometry.ts). The WCF field's default comes from DEFAULT_WORT_CORRECTION_FACTOR,
 * never a hardcoded literal (§1.2). No result state (§2.4).
 */
export function RefractometerCalculator() {
  const { config } = useConfig();
  const [initialBrix, setInitialBrix] = useState('12.5');
  const [finalBrix, setFinalBrix] = useState('6.5');
  const [wortCorrectionFactor, setWortCorrectionFactor] = useState(String(DEFAULT_WORT_CORRECTION_FACTOR));

  const input = {
    initialBrix: Number.parseFloat(initialBrix),
    finalBrix: Number.parseFloat(finalBrix),
    wortCorrectionFactor: Number.parseFloat(wortCorrectionFactor),
  };

  const og = refractometerOriginalGravity(input);
  const fg = refractometerFinalGravity(input);

  return (
    <CalculatorCard
      title="Refractometer (Brix → SG, Alcohol-Corrected)"
      description="Converts Brix readings to specific gravity, and corrects the final reading for the alcohol produced during fermentation."
      formula="Original gravity comes from the initial Brix and a wort correction factor; final gravity is adjusted for the alcohol estimated from the drop in Brix."
    >
      <NumericField label="Initial reading (°Bx)" value={initialBrix} onChange={setInitialBrix} />
      <NumericField label="Final reading (°Bx)" value={finalBrix} onChange={setFinalBrix} />
      <NumericField label="Wort correction factor (ratio)" value={wortCorrectionFactor} onChange={setWortCorrectionFactor} />
      <ResultRow label="Original gravity" value={formatGravity(og, config.gravityUnit)} />
      <ResultRow label="Final gravity (alcohol-corrected)" value={formatGravity(fg, config.gravityUnit)} />
    </CalculatorCard>
  );
}
