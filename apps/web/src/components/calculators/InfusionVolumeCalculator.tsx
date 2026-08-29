import { useState } from 'react';
import { infusionVolumeL, formatVolume } from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, ResultRow } from './CalculatorCard';

/**
 * Thin wrapper over the recipe path's own infusionVolumeL (mash.ts, M3_P2).
 * No result state: the value is derived during render (§2.4).
 */
export function InfusionVolumeCalculator() {
  const { config } = useConfig();
  const [grainWeightKg, setGrainWeightKg] = useState('5');
  const [currentTempC, setCurrentTempC] = useState('67');
  const [targetTempC, setTargetTempC] = useState('72');
  const [infusionWaterTempC, setInfusionWaterTempC] = useState('95');
  const [currentMashVolumeL, setCurrentMashVolumeL] = useState('20');

  const result = infusionVolumeL({
    grainWeightKg: Number.parseFloat(grainWeightKg),
    currentTempC: Number.parseFloat(currentTempC),
    targetTempC: Number.parseFloat(targetTempC),
    infusionWaterTempC: Number.parseFloat(infusionWaterTempC),
    currentMashVolumeL: Number.parseFloat(currentMashVolumeL),
  });

  return (
    <CalculatorCard
      title="Infusion (Step-Mash) Volume"
      description="Calculates how much near-boiling water to add to a mash to raise it to the next step-mash temperature."
      formula="The added-water volume is set so the heat it carries raises the existing mash from its current to its target temperature."
    >
      <NumericField label="Infusion grain weight (kg)" value={grainWeightKg} onChange={setGrainWeightKg} />
      <NumericField label="Current mash temperature (°C)" value={currentTempC} onChange={setCurrentTempC} />
      <NumericField label="Infusion target temperature (°C)" value={targetTempC} onChange={setTargetTempC} />
      <NumericField label="Infusion water temperature (°C)" value={infusionWaterTempC} onChange={setInfusionWaterTempC} />
      <NumericField label="Current mash volume (L)" value={currentMashVolumeL} onChange={setCurrentMashVolumeL} />
      <ResultRow label="Infusion water needed" value={formatVolume(result, config.unitSystem)} />
    </CalculatorCard>
  );
}
