import { useState } from 'react';
import { starterExtractGrams, starterGrowthRateBPerG, starterEndCellsBillions, formatHopMass, STARTER_TYPES } from '@truchabrew/calculations';
import { useConfig } from '../../context/ConfigContext';
import { CalculatorCard, NumericField, SelectField, ResultRow } from './CalculatorCard';

// Derived from the already-imported VALUE (STARTER_TYPES) rather than
// importing `StarterType` as a named type — see PitchRateCalculator.tsx's
// identical note on AC-23's runtime-export check.
type StarterType = (typeof STARTER_TYPES)[number];

const STARTER_TYPE_LABELS: Record<StarterType, string> = {
  stirPlate: 'Stir plate',
  shaken: 'Shaken',
  simple: 'Simple (non-agitated)',
};

const STARTER_TYPE_OPTIONS = STARTER_TYPES.map((t) => ({ value: t, label: STARTER_TYPE_LABELS[t] }));

/**
 * Wraps starterExtractGrams + starterGrowthRateBPerG + starterEndCellsBillions
 * (M8_P2 §1.4). The inoculation rate (initialCellsBillions / extract) is the
 * same sub-expression starterEndCellsBillions computes internally via
 * delegation (§2.1) — it is recomputed here only so the card can render it
 * and the growth-rate row as their own outputs (§2.2's input/output map),
 * not as a re-derivation of any value a function already returns outright.
 * The ONE permitted subtraction is new cells = endCells - initialCells
 * (§2.2). No result state — derived during render (§2.4).
 */
export function StarterGrowthCalculator() {
  const { config } = useConfig();
  const [starterVolumeL, setStarterVolumeL] = useState('2');
  const [starterGravitySg, setStarterGravitySg] = useState('1.037');
  const [initialCellsBillions, setInitialCellsBillions] = useState('100');
  const [starterType, setStarterType] = useState<StarterType>('stirPlate');

  const starterVolumeLValue = Number.parseFloat(starterVolumeL);
  const starterGravitySgValue = Number.parseFloat(starterGravitySg);
  const initialCellsBillionsValue = Number.parseFloat(initialCellsBillions);

  const extractGrams = starterExtractGrams({ starterVolumeL: starterVolumeLValue, starterGravitySg: starterGravitySgValue });
  const inoculationRateBPerG = initialCellsBillionsValue / extractGrams;
  const growthRateBPerG = starterGrowthRateBPerG(inoculationRateBPerG, starterType);

  const endCellsBillions = starterEndCellsBillions({
    initialCellsBillions: initialCellsBillionsValue,
    starterVolumeL: starterVolumeLValue,
    starterGravitySg: starterGravitySgValue,
    starterType,
  });

  const newCellsBillions = endCellsBillions - initialCellsBillionsValue;

  return (
    <CalculatorCard
      title="Yeast Starter Growth"
      description="Predicts how many cells a yeast starter will produce from its volume, gravity, and agitation method, so you can pitch the right amount."
      formula="Extract from starter volume × gravity; growth rate per gram of extract from the starter type; end cells = initial + new cells grown."
    >
      <NumericField label="Starter volume (L)" value={starterVolumeL} onChange={setStarterVolumeL} />
      <NumericField label="Starter gravity (SG)" value={starterGravitySg} onChange={setStarterGravitySg} />
      <NumericField label="Cells pitched (B)" value={initialCellsBillions} onChange={setInitialCellsBillions} />
      <SelectField label="Starter type" value={starterType} options={STARTER_TYPE_OPTIONS} onChange={(v) => setStarterType(v as StarterType)} />
      <ResultRow label="Extract" value={formatHopMass(extractGrams, config.unitSystem)} />
      <ResultRow label="Inoculation rate" value={inoculationRateBPerG} unit="B/g" fractionDigits={3} />
      <ResultRow label="Growth rate" value={growthRateBPerG} unit="B/g" fractionDigits={2} />
      <ResultRow label="New cells" value={newCellsBillions} unit="B" fractionDigits={1} />
      <ResultRow label="End cells" value={endCellsBillions} unit="B" fractionDigits={1} />
    </CalculatorCard>
  );
}
