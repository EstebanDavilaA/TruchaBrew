// M8_P2 spec §2.1 / Resolved Ambiguities §2-3. Pure functions only — no I/O,
// no React. All numeric coefficients are module-private except the three
// exported preset records/constants named in §1.2.
import { sgToPlato } from './config';

// ---------------------------------------------------------------------------
// Pitch rate (build-spec §3.6, adopted literally — Resolved Ambiguities §2)
// ---------------------------------------------------------------------------

export type PitchRatePreset = 'ale' | 'highGravityAle' | 'lager';

/**
 * Recommended pitch rates in million cells/mL/°P (build-spec §3.6).
 * `highGravityAle` is pinned at 1.25, the TOP of the source's 1.0-1.25
 * range — see spec §4 Deviation 3.
 */
export const PITCH_RATE_PRESETS: Readonly<Record<PitchRatePreset, number>> = {
  ale: 0.75,
  highGravityAle: 1.25,
  lager: 1.5,
};

/**
 * No default parameter, contrary to build-spec §3.6's `= 21` — the default
 * lives here, in the exported constant, and callers pass it explicitly
 * (Resolved Ambiguities §2, M8_P1 Ambiguity 3(d)'s rule applied consistently).
 */
export const DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH = 21;

export interface TargetCellsInput {
  ogPlato: number;
  volumeL: number;
  pitchRateMillionCellsPerMlPerP: number;
}

/** build-spec §3.6, verbatim: pitchRate * ogPlato * volumeL (billions of cells). */
export function targetCellsBillions(input: TargetCellsInput): number {
  return input.pitchRateMillionCellsPerMlPerP * input.ogPlato * input.volumeL;
}

/** build-spec §3.6, verbatim: (1 - monthlyDecayPct/100) ** months. */
export function viabilityAfterMonths(months: number, monthlyDecayPct: number): number {
  return Math.pow(1 - monthlyDecayPct / 100, months);
}

export interface ViableCellsInput {
  packCellsBillions: number;
  months: number;
  monthlyDecayPct: number; // no default — caller passes DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH
}

/** Delegates to viabilityAfterMonths — no second decay path. */
export function viableCellsBillions(input: ViableCellsInput): number {
  return input.packCellsBillions * viabilityAfterMonths(input.months, input.monthlyDecayPct);
}

// ---------------------------------------------------------------------------
// Braukaiser starter growth (Resolved Ambiguities §3 — pinned from secondary
// sources; see spec §4 Deviation 2 for the full citation disclosure)
// ---------------------------------------------------------------------------

export type StarterType = 'stirPlate' | 'shaken' | 'simple';

export const STARTER_TYPES: readonly StarterType[] = ['stirPlate', 'shaken', 'simple'];

// Module-private (§1.2) — the published two-piece stir-plate fit.
const STIR_PLATE_PLATEAU_RATE = 1.4;
const STIR_PLATE_BREAKPOINT_IR = 1.4;
const STIR_PLATE_DECLINE_INTERCEPT = 2.33;
const STIR_PLATE_DECLINE_SLOPE = 0.67;

// Module-private (§1.2) — shaken / non-agitated ("simple") plateaus and
// their shared zero-growth ceiling.
const SHAKEN_RATE = 0.62;
const SIMPLE_RATE = 0.4;
const NON_STIRRED_MAX_IR = 3.5;

export interface StarterInput {
  starterVolumeL: number;
  starterGravitySg: number;
}

/**
 * Litres -> grams of wort via SG, then x °P/100 to get grams of extract.
 * sgToPlato is IMPORTED, never re-derived (Resolved Ambiguities §3).
 */
export function starterExtractGrams(input: StarterInput): number {
  return input.starterVolumeL * 1000 * input.starterGravitySg * (sgToPlato(input.starterGravitySg) / 100);
}

/**
 * Growth rate (billions of new cells per gram of extract), as a function of
 * inoculation rate (billions of cells pitched per gram of extract).
 *
 * Non-finite handling is an explicit LEADING guard here (Resolved
 * Ambiguities §3) — the branch structure below would otherwise return a
 * finite number for a non-finite `ir`, silently fabricating a growth rate.
 *
 * `max(0, ...)` on the stirPlate decline branch is the published curve's
 * OWN zero floor (its zero crossing is 2.33/0.67 = 3.4776...), not a
 * defensive guard — it is the only clamp in this phase besides this leading
 * non-finite passthrough.
 *
 * Exhaustive switch over StarterType, no `default` — an unknown StarterType
 * is structurally unrepresentable (§2.3).
 */
export function starterGrowthRateBPerG(inoculationRateBPerG: number, starterType: StarterType): number {
  if (!Number.isFinite(inoculationRateBPerG)) return NaN;

  switch (starterType) {
    case 'stirPlate':
      return inoculationRateBPerG < STIR_PLATE_BREAKPOINT_IR
        ? STIR_PLATE_PLATEAU_RATE
        : Math.max(0, STIR_PLATE_DECLINE_INTERCEPT - STIR_PLATE_DECLINE_SLOPE * inoculationRateBPerG);
    case 'shaken':
      return inoculationRateBPerG < NON_STIRRED_MAX_IR ? SHAKEN_RATE : 0;
    case 'simple':
      return inoculationRateBPerG < NON_STIRRED_MAX_IR ? SIMPLE_RATE : 0;
  }
}

export interface StarterGrowthInput extends StarterInput {
  initialCellsBillions: number;
  starterType: StarterType;
}

/**
 * initialCellsBillions + starterGrowthRateBPerG(ir, starterType) * extract,
 * where ir = initialCellsBillions / extract. Both starterExtractGrams and
 * starterGrowthRateBPerG are DELEGATED to, not inlined (§2.1).
 */
export function starterEndCellsBillions(input: StarterGrowthInput): number {
  const { initialCellsBillions, starterVolumeL, starterGravitySg, starterType } = input;
  const extract = starterExtractGrams({ starterVolumeL, starterGravitySg });
  const inoculationRateBPerG = initialCellsBillions / extract;
  const growthRateBPerG = starterGrowthRateBPerG(inoculationRateBPerG, starterType);
  return initialCellsBillions + growthRateBPerG * extract;
}
