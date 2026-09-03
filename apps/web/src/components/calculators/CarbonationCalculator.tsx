import { useState } from 'react';
import { residualCO2Volumes, primingSugarG, forceCarbonationPsi, formatHopMass } from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, ResultRow } from './CalculatorCard';

/**
 * Wraps residualCO2Volumes + primingSugarG + forceCarbonationPsi (M8_P2
 * §1.4). Contains NO arithmetic whatsoever (AC-15) — residualCO2Volumes,
 * primingSugarG and forceCarbonationPsi have been shipped and under test
 * since M5_P2; this card adds zero carbonation math. No result state —
 * derived during render (§2.4).
 */
export function CarbonationCalculator() {
  const { config } = useConfig();
  const [beerVolumeL, setBeerVolumeL] = useState('19');
  const [targetCo2Volumes, setTargetCo2Volumes] = useState('2.4');
  const [peakFermentationTempC, setPeakFermentationTempC] = useState('20');
  const [servingTempC, setServingTempC] = useState('4');

  const peakFermentationTempCValue = Number.parseFloat(peakFermentationTempC);

  const residualCo2 = residualCO2Volumes(peakFermentationTempCValue);

  const primingSugar = primingSugarG({
    volumesCO2Target: Number.parseFloat(targetCo2Volumes),
    peakFermentationTempC: peakFermentationTempCValue,
    beerVolumeL: Number.parseFloat(beerVolumeL),
  });

  const forceCarbPsi = forceCarbonationPsi({
    volumesCO2: Number.parseFloat(targetCo2Volumes),
    tempC: Number.parseFloat(servingTempC),
  });

  return (
    <CalculatorCard
      title="Priming Sugar & Force Carbonation"
      description="Computes how much priming sugar to add for bottle conditioning, or what CO2 regulator pressure to set for force carbonating a keg."
      formula="Residual CO2 comes from peak fermentation temperature; priming sugar raises it to your target; force-carb pressure follows from temperature and target volumes."
    >
      <NumericField label="Beer volume (L)" value={beerVolumeL} onChange={setBeerVolumeL} />
      <NumericField label="Target CO2 (vols)" value={targetCo2Volumes} onChange={setTargetCo2Volumes} />
      <NumericField label="Peak fermentation temperature (°C)" value={peakFermentationTempC} onChange={setPeakFermentationTempC} />
      <NumericField label="Serving temperature (°C)" value={servingTempC} onChange={setServingTempC} />
      <ResultRow label="Residual CO2" value={residualCo2} unit="vols" fractionDigits={2} />
      <ResultRow label="Priming sugar" value={formatHopMass(primingSugar, config.unitSystem)} />
      <ResultRow label="Force-carb pressure" value={forceCarbPsi} unit="psi" fractionDigits={2} />
    </CalculatorCard>
  );
}
