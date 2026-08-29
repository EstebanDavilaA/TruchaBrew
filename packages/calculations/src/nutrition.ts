// M9_P2 — nutrition (calories, carbs, alcohol) from a batch's closing
// snapshot OG/FG, via the standard real-extract model. New module; see
// .gsd/active/M9_P2_feature_spec.md §2.1 / Resolved Ambiguity 4. No I/O, no
// randomness. `sgToPlato` is IMPORTED from ./config, never re-derived.
import type { ClosingSnapshot, BeerNutrition } from '@truchabrew/shared-types';
import { sgToPlato } from './config';

export const NUTRITION_SERVING_ML = 355;
export const REAL_EXTRACT_OE_COEFF = 0.1808;
export const REAL_EXTRACT_AE_COEFF = 0.8192;

// Module-private (Resolved Ambiguity 4 / §1.1 — not part of the exported
// surface, same precedent as carbonation.ts's private constants).
const CAL_ABW_COEFF = 6.9;
const CAL_RE_COEFF = 4.0;
const RE_OFFSET = 0.1;
const ABW_DIVISOR_BASE = 2.0665;
const ABW_DIVISOR_OE_COEFF = 0.010665;

/** REAL_EXTRACT_OE_COEFF * originalPlato + REAL_EXTRACT_AE_COEFF * apparentPlato. In that term order. */
export function realExtractPlato(originalPlato: number, apparentPlato: number): number {
  return REAL_EXTRACT_OE_COEFF * originalPlato + REAL_EXTRACT_AE_COEFF * apparentPlato;
}

/** (originalPlato - realExtract) / (2.0665 - 0.010665 * originalPlato). UNCLAMPED; may be negative. */
export function alcoholByWeightPct(originalPlato: number, realExtract: number): number {
  return (originalPlato - realExtract) / (ABW_DIVISOR_BASE - ABW_DIVISOR_OE_COEFF * originalPlato);
}

/**
 * Exactly the operation order pinned in Resolved Ambiguity 4. Nothing is
 * clamped, nothing is rounded. Never throws.
 */
export function beerNutrition(originalGravity: number, finalGravity: number): BeerNutrition {
  const originalPlato = sgToPlato(originalGravity);
  const apparentPlato = sgToPlato(finalGravity);
  const realExtract = realExtractPlato(originalPlato, apparentPlato);
  const abwPct = alcoholByWeightPct(originalPlato, realExtract);

  const caloriesPer100Ml = (CAL_ABW_COEFF * abwPct + CAL_RE_COEFF * (realExtract - RE_OFFSET)) * finalGravity;
  const carbsGPer100Ml = (realExtract - RE_OFFSET) * finalGravity;
  const alcoholGPer100Ml = abwPct * finalGravity;

  const servingFactor = NUTRITION_SERVING_ML / 100;

  return {
    originalPlato,
    apparentPlato,
    realExtractPlato: realExtract,
    abwPct,
    caloriesPer100Ml,
    carbsGPer100Ml,
    alcoholGPer100Ml,
    caloriesPerServing: caloriesPer100Ml * servingFactor,
    carbsGPerServing: carbsGPer100Ml * servingFactor,
    alcoholGPerServing: alcoholGPer100Ml * servingFactor,
  };
}

/**
 * null in, null out. Otherwise beerNutrition(snapshot.originalGravity,
 * snapshot.finalGravity). Returns null — NEVER a zeroed BeerNutrition.
 */
export function nutritionFromClosingSnapshot(snapshot: ClosingSnapshot | null): BeerNutrition | null {
  if (snapshot === null) return null;
  return beerNutrition(snapshot.originalGravity, snapshot.finalGravity);
}
