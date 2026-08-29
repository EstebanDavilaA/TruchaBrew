// M18_P1 spec §1.3 — expected-target derivation for the five Brew Day
// Measurements fields. Pure. Never returns a formatted fallback for a
// missing value — always the { value: null, placeholder: null, source: null }
// triple; the caller branches.
import type { CalculatedStats, EquipmentProfile } from '@truchabrew/shared-types';

export type MeasurementFieldKey = 'preBoilGravity' | 'mashPh' | 'boilSizeL' | 'boilTimeMin' | 'og';

export type MeasurementTargetSource = 'stats' | 'equipment' | 'waterChemistry' | 'mashProfile' | null;

export interface MeasurementTarget {
  field: MeasurementFieldKey;
  value: number | null;
  placeholder: string | null;
  source: MeasurementTargetSource;
}

export interface MeasurementTargets {
  preBoilGravity: MeasurementTarget;
  mashPh: MeasurementTarget;
  boilSizeL: MeasurementTarget;
  boilTimeMin: MeasurementTarget;
  og: MeasurementTarget;
}

export interface MeasurementTargetsInput {
  stats: CalculatedStats | null;
  equipment: EquipmentProfile;
  predictedMashPh: number | null;
  mashProfileTargetPh: number | null;
}

function nullTarget(field: MeasurementFieldKey): MeasurementTarget {
  return { field, value: null, placeholder: null, source: null };
}

function numericTarget(field: MeasurementFieldKey, rawValue: number, decimals: number, source: MeasurementTargetSource): MeasurementTarget {
  const value = parseFloat(rawValue.toFixed(decimals));
  return { field, value, placeholder: value.toFixed(decimals), source };
}

/** Pure. See §1.3. Invariant: value === null iff placeholder === null iff source === null. */
export function deriveMeasurementTargets(input: MeasurementTargetsInput): MeasurementTargets {
  const { stats, equipment, predictedMashPh, mashProfileTargetPh } = input;

  const preBoilGravity =
    stats !== null ? numericTarget('preBoilGravity', stats.preBoilGravity, 3, 'stats') : nullTarget('preBoilGravity');

  const og = stats !== null ? numericTarget('og', stats.og, 3, 'stats') : nullTarget('og');

  const boilSizeL =
    stats !== null ? numericTarget('boilSizeL', stats.preBoilVolumeL, 1, 'stats') : nullTarget('boilSizeL');

  // boilTimeMin does not depend on `stats` (Ambiguity 7).
  const boilTimeMin = numericTarget('boilTimeMin', equipment.boilTimeMin, 0, 'equipment');

  let mashPh: MeasurementTarget;
  if (predictedMashPh !== null) {
    mashPh = numericTarget('mashPh', predictedMashPh, 2, 'waterChemistry');
  } else if (mashProfileTargetPh !== null) {
    mashPh = numericTarget('mashPh', mashProfileTargetPh, 2, 'mashProfile');
  } else {
    mashPh = nullTarget('mashPh');
  }

  return { preBoilGravity, mashPh, boilSizeL, boilTimeMin, og };
}
