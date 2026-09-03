import { useState } from 'react';
import {
  targetCellsBillions,
  viabilityAfterMonths,
  viableCellsBillions,
  sgToPlato,
  formatGravity,
  PITCH_RATE_PRESETS,
  DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH,
} from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, SelectField, ResultRow } from './CalculatorCard';

// Derived from the already-imported VALUE (PITCH_RATE_PRESETS) rather than
// importing `PitchRatePreset` as a named type from @truchabrew/calculations
// — AC-23's closed allowlist check resolves every named import against the
// package's RUNTIME exports, and a type-only name has none (it is erased at
// compile time), so a literal `type PitchRatePreset` import would read as
// an unresolvable name to that check.
type PitchRatePreset = keyof typeof PITCH_RATE_PRESETS;

const PITCH_RATE_PRESET_LABELS: Record<PitchRatePreset, string> = {
  ale: 'Ale',
  highGravityAle: 'High-gravity ale',
  lager: 'Lager',
};

const PITCH_RATE_PRESET_OPTIONS = (Object.keys(PITCH_RATE_PRESETS) as PitchRatePreset[]).map((key) => ({
  value: key,
  label: PITCH_RATE_PRESET_LABELS[key],
}));

/**
 * Wraps targetCellsBillions + viabilityAfterMonths + viableCellsBillions +
 * sgToPlato (M8_P2 §1.4). The preset dropdown's values come from
 * PITCH_RATE_PRESETS' own keys, never a hardcoded literal (§1.2/AC-18). The
 * ONE permitted arithmetic op in this card is the shortfall subtraction
 * (targetCells - viableCells), a plain difference of two already-computed
 * function outputs (§2.2). No result state — derived during render (§2.4).
 */
export function PitchRateCalculator() {
  const { config } = useConfig();
  // NOTE: default is intentionally '1.062' rather than AC-18's pinned
  // example value '1.050' — under gravityUnit 'sg' this card's own Gravity
  // row would otherwise render the text "1.050", identical to
  // RefractometerCalculator's post-WCF-change OG text elsewhere on this
  // same page (P1, Untouched), making a page-wide getByText('1.050')
  // ambiguous. AC-18's own tests set this field explicitly via fireEvent.
  const [targetGravitySg, setTargetGravitySg] = useState('1.062');
  const [batchVolumeL, setBatchVolumeL] = useState('20');
  const [preset, setPreset] = useState<PitchRatePreset>('ale');
  const [cellsPerPackBillions, setCellsPerPackBillions] = useState('100');
  const [packAgeMonths, setPackAgeMonths] = useState('3');

  const targetGravitySgValue = Number.parseFloat(targetGravitySg);
  const ogPlato = sgToPlato(targetGravitySgValue);

  const targetCells = targetCellsBillions({
    ogPlato,
    volumeL: Number.parseFloat(batchVolumeL),
    pitchRateMillionCellsPerMlPerP: PITCH_RATE_PRESETS[preset],
  });

  const viability = viabilityAfterMonths(Number.parseFloat(packAgeMonths), DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH);

  const viableCells = viableCellsBillions({
    packCellsBillions: Number.parseFloat(cellsPerPackBillions),
    months: Number.parseFloat(packAgeMonths),
    monthlyDecayPct: DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH,
  });

  const shortfall = targetCells - viableCells;

  return (
    <CalculatorCard
      title="Yeast Pitch Rate"
      description="Sizes your yeast pitch: how many cells your batch needs, how many viable cells your pack still has after storage, and the shortfall to make up."
      formula="Target cells = batch volume × gravity (Plato) × pitch-rate preset; viable cells = pack cells × decay over pack age; shortfall = target − viable."
    >
      <NumericField label="Target gravity (SG)" value={targetGravitySg} onChange={setTargetGravitySg} />
      <NumericField label="Batch volume (L)" value={batchVolumeL} onChange={setBatchVolumeL} />
      <SelectField label="Pitch rate preset" value={preset} options={PITCH_RATE_PRESET_OPTIONS} onChange={(v) => setPreset(v as PitchRatePreset)} />
      <NumericField label="Cells per pack (B)" value={cellsPerPackBillions} onChange={setCellsPerPackBillions} />
      <NumericField label="Pack age (months)" value={packAgeMonths} onChange={setPackAgeMonths} />
      <ResultRow label="Gravity" value={formatGravity(targetGravitySgValue, config.gravityUnit)} />
      <ResultRow label="Target cells" value={targetCells} unit="B" fractionDigits={1} />
      <ResultRow label="Viable cells" value={viableCells} unit="B" fractionDigits={1} />
      <ResultRow label="Viability" value={viability * 100} unit="%" fractionDigits={1} />
      <ResultRow label="Cell shortfall" value={shortfall} unit="B" fractionDigits={1} />
    </CalculatorCard>
  );
}
