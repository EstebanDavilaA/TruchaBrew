import { useState } from 'react';
import { hopTemperatureFactor, alphaAcidAfterStorage, HOP_STORAGE_FACTORS } from '@truchabrew/calculations';
import { CalculatorCard, NumericField, SelectField, ResultRow } from './CalculatorCard';

// Derived from the already-imported VALUE (HOP_STORAGE_FACTORS) rather than
// importing `HopStorageMethod` as a named type — see PitchRateCalculator.tsx's
// identical note on AC-23's runtime-export check.
type HopStorageMethod = keyof typeof HOP_STORAGE_FACTORS;

const HOP_STORAGE_METHOD_LABELS: Record<HopStorageMethod, string> = {
  nitrogenFlushedOxygenBarrier: 'Nitrogen-flushed, oxygen barrier',
  sealedNotEvacuated: 'Sealed, not evacuated',
  looseInAir: 'Loose in air',
};

const HOP_STORAGE_METHOD_OPTIONS = (Object.keys(HOP_STORAGE_FACTORS) as HopStorageMethod[]).map((key) => ({
  value: key,
  label: HOP_STORAGE_METHOD_LABELS[key],
}));

/**
 * Wraps alphaAcidAfterStorage (+ hopTemperatureFactor for the shown factor)
 * (M8_P2 §1.4). No arithmetic at all — every row is a direct function call
 * over parsed field values. No result state — derived during render (§2.4).
 */
export function HopDecayCalculator() {
  const [initialAlphaAcidPct, setInitialAlphaAcidPct] = useState('10');
  const [percentLostSixMonths, setPercentLostSixMonths] = useState('0.3');
  const [storageTempC, setStorageTempC] = useState('4');
  const [storageMethod, setStorageMethod] = useState<HopStorageMethod>('nitrogenFlushedOxygenBarrier');
  const [days, setDays] = useState('180');

  const storageTempCValue = Number.parseFloat(storageTempC);
  const temperatureFactor = hopTemperatureFactor(storageTempCValue);

  const alphaAcidNowPct = alphaAcidAfterStorage({
    initialAlphaAcidPct: Number.parseFloat(initialAlphaAcidPct),
    percentLostSixMonths: Number.parseFloat(percentLostSixMonths),
    storageTempC: storageTempCValue,
    storageFactor: HOP_STORAGE_FACTORS[storageMethod],
    days: Number.parseFloat(days),
  });

  return (
    <CalculatorCard
      title="Hop Alpha-Acid Decay"
      description="Estimates how much alpha-acid potency your hops have lost to storage, so you can adjust hop additions for old stock."
      formula="Alpha-acid remaining = initial alpha acid × a temperature factor × a storage-method factor, compounded over the days stored."
    >
      <NumericField label="Alpha acid at purchase (%)" value={initialAlphaAcidPct} onChange={setInitialAlphaAcidPct} />
      <NumericField label="Six-month loss (ratio)" value={percentLostSixMonths} onChange={setPercentLostSixMonths} />
      <NumericField label="Storage temperature (°C)" value={storageTempC} onChange={setStorageTempC} />
      <SelectField label="Storage method" value={storageMethod} options={HOP_STORAGE_METHOD_OPTIONS} onChange={(v) => setStorageMethod(v as HopStorageMethod)} />
      <NumericField label="Days stored (days)" value={days} onChange={setDays} />
      <ResultRow label="Temperature factor" value={temperatureFactor} fractionDigits={3} />
      <ResultRow label="Alpha acid now" value={alphaAcidNowPct} unit="%" fractionDigits={2} />
    </CalculatorCard>
  );
}
