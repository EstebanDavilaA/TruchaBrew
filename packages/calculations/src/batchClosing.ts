import type { BeerVolumeSource, CarbonationType, ClosingSnapshot, Recipe } from '@truchabrew/shared-types';
import { abvBalling, apparentAttenuationPct, calculateVolumes, totalExtractPoints, gravityAtVolume, mashEfficiency } from './brewingMath';
import { primingSugarG as computePrimingSugarG, forceCarbonationPsi } from './carbonation';

// M5_P2 spec §2.3. No function in this module performs I/O, reads the
// current wall-clock time, generates an id, or touches a random source.

/**
 * Measured mash efficiency, extracted VERBATIM from the derivation previously
 * inlined at apps/web/src/pages/BatchDetail.tsx:97-114. `null` iff
 * `measuredPreBoilGravity === null` OR
 * `recipeSnapshot.equipment.mashEfficiencyPct <= 0` (the second guard exists
 * because that value is the denominator; at exactly 0 the division yields NaN,
 * which mashEfficiency's own `<= 0` guard cannot catch since `NaN <= 0` is
 * false). Never returns NaN or Infinity.
 */
export function measuredMashEfficiencyPct(recipeSnapshot: Recipe, measuredPreBoilGravity: number | null): number | null {
  if (measuredPreBoilGravity === null) return null;
  const { equipment, fermentables } = recipeSnapshot;
  if (equipment.mashEfficiencyPct <= 0) return null;

  const volumes = calculateVolumes(equipment);
  const extractPoints = totalExtractPoints(fermentables);
  const unroundedPreBoilGravity = gravityAtVolume(extractPoints, equipment.mashEfficiencyPct, volumes.preBoilVolumeL);

  // maxPossibleGravityPoints = estimated points / efficiency fraction —
  // "what the points would have been at 100% mash efficiency".
  const estPoints = (unroundedPreBoilGravity - 1.0) * 1000;
  const maxPoints = estPoints / (equipment.mashEfficiencyPct / 100);
  return mashEfficiency((measuredPreBoilGravity - 1.0) * 1000, maxPoints);
}

export interface ResolvedBeerVolume {
  beerVolumeL: number;
  beerVolumeSource: BeerVolumeSource;
}

/** `measuredBottlingSizeL !== null` wins. Never a falsy check — a stored 0 is not absence. */
export function resolveBeerVolume(measuredBottlingSizeL: number | null, recipeBatchSizeL: number): ResolvedBeerVolume {
  if (measuredBottlingSizeL !== null) {
    return { beerVolumeL: measuredBottlingSizeL, beerVolumeSource: 'measured' };
  }
  return { beerVolumeL: recipeBatchSizeL, beerVolumeSource: 'recipe' };
}

export interface ClosingSnapshotInput {
  frozenAt: string; // supplied by the caller; never read from a clock here
  measuredOg: number; // non-null by the route's completion gate
  measuredFg: number; // non-null by the route's completion gate
  measuredPreBoilGravity: number | null;
  measuredBottlingSizeL: number | null;
  recipeSnapshot: Recipe;
  peakFermentationTempC: number | null;
  carbonationType: CarbonationType | null;
  carbonationVolumesTarget: number | null;
  carbonationTempC: number | null;
}

const SUGAR_FAMILY: readonly CarbonationType[] = ['Sugar', 'KegSugar'];
const FORCE_FAMILY: readonly CarbonationType[] = ['KegForce', 'KegForceQuick'];

/**
 * Pure. Never throws. Never returns NaN or Infinity in any numeric field.
 * `abv` is `abvBalling(og, fg)` and `apparentAttenuationPct` is
 * `apparentAttenuationPct(og, fg)` — both IMPORTED from brewingMath.ts, never
 * reimplemented. Both unrounded.
 */
export function buildClosingSnapshot(input: ClosingSnapshotInput): ClosingSnapshot {
  const {
    frozenAt,
    measuredOg,
    measuredFg,
    measuredPreBoilGravity,
    measuredBottlingSizeL,
    recipeSnapshot,
    peakFermentationTempC,
    carbonationType,
    carbonationVolumesTarget,
    carbonationTempC,
  } = input;

  const originalGravity = measuredOg;
  const finalGravity = measuredFg;
  const abv = abvBalling(originalGravity, finalGravity);
  const attenuation = apparentAttenuationPct(originalGravity, finalGravity);
  const mashEfficiencyPct = measuredMashEfficiencyPct(recipeSnapshot, measuredPreBoilGravity);
  const { beerVolumeL, beerVolumeSource } = resolveBeerVolume(measuredBottlingSizeL, recipeSnapshot.equipment.batchSizeL);

  let primingSugarGValue: number | null = null;
  let primingSugarEquivGPerL: number | null = null;
  if (
    carbonationType !== null &&
    SUGAR_FAMILY.includes(carbonationType) &&
    carbonationVolumesTarget !== null &&
    peakFermentationTempC !== null &&
    beerVolumeL > 0
  ) {
    primingSugarGValue = computePrimingSugarG({
      volumesCO2Target: carbonationVolumesTarget,
      peakFermentationTempC,
      beerVolumeL,
    });
    primingSugarEquivGPerL = primingSugarGValue / beerVolumeL;
  }

  let carbonationForcePsi: number | null = null;
  if (
    carbonationType !== null &&
    FORCE_FAMILY.includes(carbonationType) &&
    carbonationVolumesTarget !== null &&
    carbonationTempC !== null
  ) {
    carbonationForcePsi = forceCarbonationPsi({ volumesCO2: carbonationVolumesTarget, tempC: carbonationTempC });
  }

  return {
    frozenAt,
    originalGravity,
    finalGravity,
    abv,
    apparentAttenuationPct: attenuation,
    mashEfficiencyPct,
    peakFermentationTempC,
    beerVolumeL,
    beerVolumeSource,
    primingSugarG: primingSugarGValue,
    primingSugarEquivGPerL,
    carbonationForcePsi,
  };
}
