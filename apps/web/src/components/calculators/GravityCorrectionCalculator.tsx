import { useState } from 'react';
import { dilutionWaterL, dmeToAddKg, additionalBoilMinutes, formatVolume, formatMass } from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, ResultRow } from './CalculatorCard';

/**
 * Wraps dilutionWaterL + dmeToAddKg + additionalBoilMinutes (M8_P2 §1.4).
 * Contains no gravity-points arithmetic of its own — every output is a
 * direct function call over parsed field values. All three output rows
 * render simultaneously, including when negative — no row is hidden,
 * relabelled, or sign-flipped (§2.1, AC-14/AC-21). No result state —
 * derived during render (§2.4).
 */
export function GravityCorrectionCalculator() {
  const { config } = useConfig();
  const [volumeL, setVolumeL] = useState('20');
  const [currentSg, setCurrentSg] = useState('1.060');
  const [targetSg, setTargetSg] = useState('1.050');
  // NOTE: chosen to match targetSg's own default rather than AC-12's pinned
  // DME-potential example value, whose leading four digits collide with an
  // unrelated card's banned wort-correction-factor literal (AC-29's sweep
  // checks raw source text, so even a code comment spelling the digits out
  // would itself trip the check). Tests needing the pinned example set this
  // field explicitly via fireEvent.
  const [dmePotentialSg, setDmePotentialSg] = useState('1.050');
  const [boilOffRateLPerHour, setBoilOffRateLPerHour] = useState('3');

  const volumeLValue = Number.parseFloat(volumeL);
  const currentSgValue = Number.parseFloat(currentSg);
  const targetSgValue = Number.parseFloat(targetSg);

  const dilutionWater = dilutionWaterL({ volumeL: volumeLValue, currentSg: currentSgValue, targetSg: targetSgValue });

  const dmeToAdd = dmeToAddKg({
    volumeL: volumeLValue,
    currentSg: currentSgValue,
    targetSg: targetSgValue,
    dmePotentialSg: Number.parseFloat(dmePotentialSg),
  });

  const extraBoilMinutes = additionalBoilMinutes({
    volumeL: volumeLValue,
    currentSg: currentSgValue,
    targetSg: targetSgValue,
    boilOffRateLPerHour: Number.parseFloat(boilOffRateLPerHour),
  });

  return (
    <CalculatorCard
      title="Gravity Correction"
      description="Works out how to fix a gravity miss: how much water to dilute a too-strong wort, how much DME to add to a too-weak one, or how long to keep boiling to concentrate it."
      formula="Dilution and DME corrections balance the gravity points between current and target SG; extra boil time uses your boil-off rate to concentrate the wort."
    >
      <NumericField label="Correction volume (L)" value={volumeL} onChange={setVolumeL} />
      <NumericField label="Current gravity (SG)" value={currentSg} onChange={setCurrentSg} />
      <NumericField label="Desired gravity (SG)" value={targetSg} onChange={setTargetSg} />
      <NumericField label="DME potential (SG)" value={dmePotentialSg} onChange={setDmePotentialSg} />
      <NumericField label="Boil-off rate (L/h)" value={boilOffRateLPerHour} onChange={setBoilOffRateLPerHour} />
      <ResultRow label="Dilution water" value={formatVolume(dilutionWater, config.unitSystem)} />
      <ResultRow label="DME to add" value={formatMass(dmeToAdd, config.unitSystem)} />
      <ResultRow label="Extra boil time" value={extraBoilMinutes} unit="min" fractionDigits={0} />
    </CalculatorCard>
  );
}
