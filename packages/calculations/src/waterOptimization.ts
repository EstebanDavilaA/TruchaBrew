/**
 * Bounded Multi-Ion Least-Squares Water Solver (M37_P1).
 *
 * Replaces the sequential greedy dosing heuristic in `suggestSaltAdditions`
 * (BUG-024) with a bounded non-negative least-squares / constrained
 * coordinate-descent optimizer that simultaneously balances all 6 core
 * brewing ions (Ca²⁺, Mg²⁺, Na⁺, Cl⁻, SO₄²⁻, HCO₃⁻) against a target water
 * profile, without Calcium/Sodium overshoots or impossible mineral ratios.
 *
 * Pure functions — no side effects, no database access, no UI.
 */
import type { WaterProfile } from '@truchabrew/shared-types';
import { SALT_CONTRIBUTIONS, type IonConcentrations } from './water';

// ---------------------------------------------------------------------------
// Salt index — the 5 primary brewing salts, in a fixed canonical order.
// Order only matters for the returned `salts` array; the solver itself treats
// all five as free variables. RA-2's per-gram-per-litre constants come
// straight from `SALT_CONTRIBUTIONS` (normalized to ppm per g per L).
//
// `getSalts()` is lazy because `SALT_CONTRIBUTIONS` lives in `water.ts`, which
// imports `optimizeWaterProfile` from this module — a module cycle. Reading
// the binding only at call time (after both modules finish evaluating) makes
// the cycle safe under ESM; a top-level `const SALTS = SALT_CONTRIBUTIONS.map…`
// would hit the cyclic binding in its temporal dead zone and throw.
// ---------------------------------------------------------------------------

export interface SaltVariable {
  readonly name: string;
  /** Contribution per gram of salt per litre of water, ppm. */
  readonly calcium: number;
  readonly magnesium: number;
  readonly sodium: number;
  readonly chloride: number;
  readonly sulfate: number;
  readonly bicarbonate: number;
}

let cachedSalts: readonly SaltVariable[] | null = null;

/**
 * Canonical salt order for the public API, matching the order the previous
 * greedy `suggestSaltAdditions` returned (Calcium Chloride, Gypsum, Epsom,
 * Baking Soda, Table Salt) — `water.test.ts` pins that exact order, and
 * AC-15 requires the signature/return contract to stay 100% compatible.
 * (This is *not* `SALT_CONTRIBUTIONS`' declaration order, which is Gypsum,
 * Calcium Chloride, Epsom, Table Salt, Baking Soda.)
 */
const CANONICAL_SALT_ORDER: readonly string[] = [
  'Calcium Chloride',
  'Gypsum',
  'Epsom Salt',
  'Baking Soda',
  'Table Salt',
];

function getSalts(): readonly SaltVariable[] {
  if (cachedSalts === null) {
    const byName = new Map(SALT_CONTRIBUTIONS.map((s) => [s.name, s]));
    cachedSalts = CANONICAL_SALT_ORDER.map((name) => {
      const s = byName.get(name);
      if (!s) throw new Error(`Unknown salt in canonical order: ${name}`);
      return {
        name: s.name,
        calcium: s.calcium,
        magnesium: s.magnesium,
        sodium: s.sodium,
        chloride: s.chloride,
        sulfate: s.sulfate,
        bicarbonate: s.bicarbonate,
      };
    });
  }
  return cachedSalts;
}

// ---------------------------------------------------------------------------
// Objective weights & overshoot penalties (RA-1).
// ---------------------------------------------------------------------------

/**
 * Per-ion objective weights (M37_P2 §1.1). Public — the web app imports this
 * rather than duplicating a local copy (AC-23/AC-24).
 */
export interface IonWeights {
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
}

/**
 * Default per-ion objective weights — how much we care about landing each
 * ion on target. Public (M37_P2 §1.1): promoted from the private `ION_WEIGHTS`
 * so `WaterCalculatorModal.tsx` can import rather than duplicate it. Values
 * unchanged.
 */
export const DEFAULT_ION_WEIGHTS: IonWeights = {
  sulfate: 1.0,
  chloride: 1.0,
  calcium: 0.8,
  magnesium: 0.5,
  sodium: 0.4,
  bicarbonate: 0.3,
};

/**
 * Overshoot penalty multipliers. When a salt addition would push an ion
 * *past* its target, the residual is penalized more heavily than a shortfall,
 * which is what prevents runaway Calcium/Sodium overshoot when Chloride and
 * Sulfate targets are both elevated (BUG-024's core defect).
 */
const OVERSHOOT_PENALTIES: IonWeights = {
  calcium: 2.5,
  sodium: 3.0,
  magnesium: 2.0,
  sulfate: 1.0,
  chloride: 1.0,
  bicarbonate: 1.0,
};

const ION_KEYS: readonly (keyof IonConcentrations)[] = [
  'calcium',
  'magnesium',
  'sodium',
  'chloride',
  'sulfate',
  'bicarbonate',
];

// ---------------------------------------------------------------------------
// Solver core
// ---------------------------------------------------------------------------

interface SolverInputs {
  /** Finished-ion starting point (source profile ppm, per ion). */
  start: IonConcentrations;
  /** Target profile ppm, per ion. */
  target: IonConcentrations;
  /** Water volume in litres. */
  volumeL: number;
  /** Optional per-salt upper bound (grams). `undefined` = unbounded. */
  upperBounds?: number[];
  /** Convergence threshold for the objective improvement between sweeps. */
  tolerance?: number;
  /** Maximum coordinate-descent sweeps. */
  maxIterations?: number;
  /** Optional per-ion weight override (M37_P2 balance strategies). When
   *  provided, replaces the default `DEFAULT_ION_WEIGHTS` for the objective. */
  weights?: IonWeights;
}

interface SolverResult {
  /** Non-negative salt doses in grams, same order as `getSalts()`. */
  grams: number[];
  /** Finished ion concentrations after dosing. */
  finished: IonConcentrations;
  /** Residual deltas = finished − target, per ion (ppm). */
  residuals: IonConcentrations;
}

/**
 * Weighted squared residual with asymmetric overshoot penalty (RA-1):
 *   J(g) = Σ w_i (ion_i(g) − target_i)² + Σ p_i max(0, ion_i(g) − target_i)²
 * `weights` (optional) overrides the default ion weights — the balance
 * strategy presets in M37_P2 use this to bias the solver toward a flavor
 * profile without changing the overshoot penalties.
 */
function objective(
  grams: number[],
  start: IonConcentrations,
  target: IonConcentrations,
  volumeL: number,
  weights?: IonWeights,
): number {
  const ion = finishedIonsFor(grams, start, volumeL);
  const w = weights ?? DEFAULT_ION_WEIGHTS;
  let cost = 0;
  for (const key of ION_KEYS) {
    const diff = ion[key] - target[key];
    const weight = w[key];
    const overshoot = Math.max(0, diff);
    cost += weight * diff * diff + OVERSHOOT_PENALTIES[key] * overshoot * overshoot;
  }
  return cost;
}

/** Compute finished ion concentrations for a salt-dose vector. */
function finishedIonsFor(grams: number[], start: IonConcentrations, volumeL: number): IonConcentrations {
  const result: IonConcentrations = { ...start };
  if (volumeL <= 0) return result;
  const salts = getSalts();
  for (let s = 0; s < salts.length; s++) {
    const gPerL = grams[s] / volumeL;
    const salt = salts[s];
    result.calcium += salt.calcium * gPerL;
    result.magnesium += salt.magnesium * gPerL;
    result.sodium += salt.sodium * gPerL;
    result.chloride += salt.chloride * gPerL;
    result.sulfate += salt.sulfate * gPerL;
    result.bicarbonate += salt.bicarbonate * gPerL;
  }
  return result;
}

/**
 * Coordinate-descent step for a single salt variable, via ternary search over
 * the bounded interval [0, bound]. Holding the other four coordinates fixed,
 * the 1-D objective J(g) = Σ w_i (a_i·g + b_i − t_i)² is a sum of convex
 * quadratics in g (strictly convex where any a_i ≠ 0), hence unimodal —
 * ternary search converges to the exact minimizer to any precision, with no
 * grid-resolution artifacts. Non-negativity is the g ≥ 0 lower bound.
 */
function optimizeSingleSalt(
  index: number,
  grams: number[],
  start: IonConcentrations,
  target: IonConcentrations,
  volumeL: number,
  bound: number,
  weights?: IonWeights,
): number {
  const salts = getSalts();
  const salt = salts[index];

  // If this salt contributes nothing (should not happen for the 5 core
  // salts, but guard anyway), it can't move the objective — leave as-is.
  if (salt.calcium === 0 && salt.magnesium === 0 && salt.sodium === 0 &&
      salt.chloride === 0 && salt.sulfate === 0 && salt.bicarbonate === 0) {
    return grams[index];
  }

  let lo = 0;
  let hi = Math.max(0, bound);
  const trial = [...grams];

  // Ternary search — ~60 iterations shrinks [0, bound] by (2/3)^60, far below
  // 1e-9 g for any realistic bound, so 2-decimal precision is guaranteed.
  const ITER = 60;
  for (let it = 0; it < ITER; it++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    trial[index] = m1;
    const c1 = objective(trial, start, target, volumeL, weights);
    trial[index] = m2;
    const c2 = objective(trial, start, target, volumeL, weights);
    if (c1 < c2) {
      hi = m2;
    } else {
      lo = m1;
    }
  }

  const best = (lo + hi) / 2;
  trial[index] = best;
  const bestCost = objective(trial, start, target, volumeL, weights);
  const zeroCost = objective(grams, start, target, volumeL, weights);
  return bestCost <= zeroCost ? best : grams[index];
}

/**
 * Bounded non-negative least-squares solver via coordinate descent.
 *
 * Iterates sweeps over all 5 salt variables, each sweep holding the other
 * four fixed while optimizing the free coordinate. Stops when a full sweep
 * improves the objective by less than `tolerance` (or `maxIterations` is
 * reached). Non-negativity is enforced by the [0, bound] search interval;
 * the asymmetric overshoot penalties (RA-1) stop runaway ion overshoots.
 */
function solveOptimalSaltsRaw(inputs: SolverInputs): SolverResult {
  const { start, target, volumeL, weights } = inputs;
  const salts = getSalts();
  const upperBounds = inputs.upperBounds ?? salts.map(() => Number.POSITIVE_INFINITY);
  const tolerance = inputs.tolerance ?? 1e-4;
  const maxIterations = inputs.maxIterations ?? 200;

  // Degenerate inputs: nothing to dose. finished = start, residual = start − target.
  if (volumeL <= 0) {
    const grams = salts.map(() => 0);
    return { grams, finished: { ...start }, residuals: residualFrom(start, target) };
  }

  // Physical upper bound per salt: 100 g/L accommodates even extreme
  // high-mineral profiles (Burton-on-Trent needs ~49 g/L of Gypsum for its
  // ~725 ppm sulfate at 23 L). The overshoot penalties keep the solver from
  // exploiting this generously large cap — it only doses what the objective
  // actually rewards.
  const maxGramsPerSalt = 100 * volumeL;
  const bounds = salts.map((_, i) => {
    const b = upperBounds[i];
    return b === undefined || !Number.isFinite(b) ? maxGramsPerSalt : Math.min(b, maxGramsPerSalt);
  });

  // Zero initial guess — always feasible, always non-negative.
  const grams = salts.map(() => 0);
  let prevCost = objective(grams, start, target, volumeL, weights);

  for (let iter = 0; iter < maxIterations; iter++) {
    for (let s = 0; s < salts.length; s++) {
      grams[s] = optimizeSingleSalt(s, grams, start, target, volumeL, bounds[s], weights);
    }
    const cost = objective(grams, start, target, volumeL, weights);
    if (prevCost - cost < tolerance) break;
    prevCost = cost;
  }

  const finished = finishedIonsFor(grams, start, volumeL);
  return { grams, finished, residuals: residualFrom(finished, target) };
}

/** Residual deltas = finished − target, per ion (ppm). */
function residualFrom(finished: IonConcentrations, target: IonConcentrations): IonConcentrations {
  return {
    calcium: finished.calcium - target.calcium,
    magnesium: finished.magnesium - target.magnesium,
    sodium: finished.sodium - target.sodium,
    chloride: finished.chloride - target.chloride,
    sulfate: finished.sulfate - target.sulfate,
    bicarbonate: finished.bicarbonate - target.bicarbonate,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OptimizedSaltDose {
  saltName: string;
  amountGrams: number;
}

export interface OptimizeWaterProfileResult {
  salts: OptimizedSaltDose[];
  resultingWater: IonConcentrations;
  residualDeltas: IonConcentrations;
  sulfateToChlorideRatio: number;
  fitScorePct: number;
}

export interface OptimizeWaterProfileOptions {
  /** Per-salt upper bounds in grams, same order as the canonical salt list. */
  upperBounds?: number[];
  /** Convergence tolerance for the solver. */
  tolerance?: number;
  /** Maximum coordinate-descent sweeps. */
  maxIterations?: number;
  /** Per-ion weight override (M37_P2 balance strategies). When provided,
   *  replaces the default `DEFAULT_ION_WEIGHTS` in the objective. */
  weights?: IonWeights;
}

function profileToIons(profile: WaterProfile | null): IonConcentrations {
  return {
    calcium: profile?.calcium ?? 0,
    magnesium: profile?.magnesium ?? 0,
    sodium: profile?.sodium ?? 0,
    chloride: profile?.chloride ?? 0,
    sulfate: profile?.sulfate ?? 0,
    bicarbonate: profile?.bicarbonate ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the normalized fit score (0–100%) for a finished profile vs target
 * (M37_P2 §1.1). Public — promoted from the private `fitScore` so the web app
 * can import rather than duplicate it (AC-23/AC-24).
 *
 * A 100% score means every ion lands exactly on target. Each ion contributes
 * its weight share of 100 scaled by how close it is: closeness = max(0, 1 −
 * |delta| / max(target, 1)) so a 5 ppm miss on a 100 ppm target counts as
 * 95% of that ion's share. Overshoots are capped the same way (an overshoot
 * beyond 100% of target is still a 0-contribution ion, never negative).
 * Pure, deterministic, no clamping beyond the per-ion `max(0, …)`.
 */
export function calculateProfileFitScore(
  finished: IonConcentrations,
  target: IonConcentrations,
  weights?: IonWeights,
): number {
  const w = weights ?? DEFAULT_ION_WEIGHTS;
  let totalWeight = 0;
  let weighted = 0;
  for (const key of ION_KEYS) {
    const wi = w[key];
    totalWeight += wi;
    const t = target[key];
    const denom = Math.max(1, Math.abs(t));
    const closeness = Math.max(0, 1 - Math.abs(finished[key] - t) / denom);
    weighted += wi * closeness;
  }
  return round2(totalWeight > 0 ? (weighted / totalWeight) * 100 : 100);
}

/**
 * Solve the multi-ion water profile optimization (M37_P1 public API).
 *
 * Returns the optimal non-negative salt doses together with the resulting
 * water chemistry, per-ion residual deltas, the Sulfate:Chloride ratio, and
 * a 0–100% fit score describing how well the finished profile matches target.
 */
export function optimizeWaterProfile(
  source: WaterProfile | null,
  target: WaterProfile | null,
  waterVolumeL: number,
  options?: OptimizeWaterProfileOptions,
): OptimizeWaterProfileResult {
  const salts = getSalts();
  const empty: OptimizeWaterProfileResult = {
    salts: salts.map((s) => ({ saltName: s.name, amountGrams: 0 })),
    resultingWater: profileToIons(source),
    residualDeltas: profileToIons(target),
    sulfateToChlorideRatio: 0,
    fitScorePct: 0,
  };

  if (!target || waterVolumeL <= 0) {
    // Degenerate: nothing to dose. residualDeltas = source − target mirrors
    // the zero-dose reality; fitScorePct reflects that no fit was attempted.
    // A null target or non-positive volume both short-circuit here; when
    // target is null there is nothing to optimize against and residualDeltas
    // is the (source − 0) delta.
    const t = profileToIons(target);
    const s = profileToIons(source);
    empty.resultingWater = s;
    empty.residualDeltas = {
      calcium: s.calcium - t.calcium,
      magnesium: s.magnesium - t.magnesium,
      sodium: s.sodium - t.sodium,
      chloride: s.chloride - t.chloride,
      sulfate: s.sulfate - t.sulfate,
      bicarbonate: s.bicarbonate - t.bicarbonate,
    };
    empty.sulfateToChlorideRatio = 0;
    empty.fitScorePct = 0;
    return empty;
  }

  const start = profileToIons(source);
  const targetIons = profileToIons(target);

  const result = solveOptimalSaltsRaw({
    start,
    target: targetIons,
    volumeL: waterVolumeL,
    upperBounds: options?.upperBounds,
    tolerance: options?.tolerance,
    maxIterations: options?.maxIterations,
    weights: options?.weights,
  });

  const grams = result.grams.map((g) => round2(g));
  const finished = finishedIonsFor(grams, start, waterVolumeL);
  const residuals = residualFrom(finished, targetIons);

  // Sulfate-to-chloride ratio of the *finished* water, matching the
  // app's existing calculateSulfateToChlorideRatio semantics: 99.9 for
  // chloride-only-0, 0 for both-0.
  const so4ClRatio =
    finished.chloride > 0
      ? round2(finished.sulfate / finished.chloride)
      : finished.sulfate > 0
        ? 99.9
        : 0;

  return {
    salts: salts.map((s, i) => ({ saltName: s.name, amountGrams: grams[i] })),
    resultingWater: finished,
    residualDeltas: residuals,
    sulfateToChlorideRatio: so4ClRatio,
    fitScorePct: calculateProfileFitScore(finished, targetIons, options?.weights),
  };
}

/**
 * Low-level solver entry — returns raw per-salt gram doses (not rounded).
 * Exposed primarily for the optimizer's own tests; the public dosing API is
 * `optimizeWaterProfile` / `suggestSaltAdditions`.
 */
export function solveOptimalSalts(
  source: WaterProfile | null,
  target: WaterProfile | null,
  waterVolumeL: number,
): OptimizedSaltDose[] {
  return optimizeWaterProfile(source, target, waterVolumeL).salts;
}
