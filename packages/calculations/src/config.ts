// Unit conversion + formula-strategy engine (M7_P1 spec §2.1). Pure
// functions only — no I/O, no React, no fastify. Storage stays canonical
// metric/SG (spec Key Behavior 1); these functions exist purely for
// display-layer and strategy-driven recalculation, never to mutate a stored
// value.
import type {
  Recipe,
  HopItem,
  AbvFormulaStrategy,
  IbuFormulaStrategy,
  UserConfig,
  GravityUnit,
  TemperatureUnit,
  UnitSystem,
} from '@truchabrew/shared-types';
import { calculateVolumes, totalExtractPoints, gravityAtVolume, classifyHopUse } from './brewingMath';
import {
  TINSETH_BIGNESS_COEFF,
  TINSETH_BIGNESS_BASE,
  TINSETH_TIME_RATE,
  TINSETH_TIME_DIVISOR,
} from './constants';

// ---------------------------------------------------------------------------
// Gravity: SG <-> Plato
// ---------------------------------------------------------------------------

// Coefficients exactly as the M7_P1 spec's Resolved Ambiguities §2:
// °P = -668.96 + 1262.45*SG - 776.43*SG^2 + 182.94*SG^3
const PLATO_C0 = -668.96;
const PLATO_C1 = 1262.45;
const PLATO_C2 = -776.43;
const PLATO_C3 = 182.94;

export function sgToPlato(sg: number): number {
  return PLATO_C0 + PLATO_C1 * sg + PLATO_C2 * sg * sg + PLATO_C3 * sg * sg * sg;
}

/**
 * Numeric inverse of sgToPlato via bisection — the cubic has no clean closed
 * form inverse over the relevant [0.98, 1.20] SG domain (Plato roughly
 * [-3, 48]). Bisection converges to well under the 1e-4 round-trip tolerance
 * AC-1 requires in well under 60 iterations for any physically meaningful
 * input; sgToPlato is monotonically increasing across the whole domain used
 * here, so bisection is safe (no local extrema in-range).
 */
export function platoToSg(plato: number): number {
  let lo = 0.9;
  let hi = 1.3;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const midPlato = sgToPlato(mid);
    if (midPlato < plato) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Temperature: °C <-> °F
// ---------------------------------------------------------------------------

// °F = C * 9/5 + 32 (spec Key Behaviors 4).
export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

// ---------------------------------------------------------------------------
// Mass: kg <-> lb
// ---------------------------------------------------------------------------

// NOTE: an equivalent `kgToLb` already exists in ./units.ts (used throughout
// the existing calc engine) and is re-exported at the package root via
// `export * from './units'` in index.ts. This module defines its own
// kgToLb per the M7_P1 spec §2.1 signature list, but index.ts deliberately
// does NOT re-export this copy (see index.ts comment) to avoid a duplicate-
// export ambiguity — both compute the identical value (1 kg = 2.20462 lb).
const LB_PER_KG = 2.20462;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

// ---------------------------------------------------------------------------
// Volume: L <-> US gal
// ---------------------------------------------------------------------------

const US_GAL_PER_L = 0.264172;

export function lToUsGal(l: number): number {
  return l * US_GAL_PER_L;
}

export function usGalToL(gal: number): number {
  return gal / US_GAL_PER_L;
}

// ---------------------------------------------------------------------------
// Volume: L <-> Imperial gal (M7_P2 §1.2/§2.1)
// ---------------------------------------------------------------------------

const IMP_GAL_PER_L = 0.219969;

export function lToImpGal(l: number): number {
  return l * IMP_GAL_PER_L;
}

export function impGalToL(gal: number): number {
  return gal / IMP_GAL_PER_L;
}

// ---------------------------------------------------------------------------
// ABV strategies
// ---------------------------------------------------------------------------

/**
 * Simple: (OG-FG)*131.25. Balling: 132.715*(OG-FG)/FG. Both exactly as the
 * M7_P1 spec's Resolved Ambiguities §2. Never negative — clamped at 0, same
 * convention as the existing engine's abvBalling in brewingMath.ts.
 */
export function calculateAbvWithStrategy(og: number, fg: number, strategy: AbvFormulaStrategy): number {
  if (strategy === 'simple') {
    return Math.max(0, (og - fg) * 131.25);
  }
  // balling
  if (fg === 0) return 0;
  return Math.max(0, (132.715 * (og - fg)) / fg);
}

// ---------------------------------------------------------------------------
// IBU strategies
// ---------------------------------------------------------------------------

// AC-22 fix: this strategy path previously carried its own local Tinseth
// constants, with TINSETH_BIGNESS_BASE pinned at 0.0001254 — a duplicate of
// the pre-existing engine's canonical 0.000125 (./constants.ts, sourced from
// the original M1_P1 build spec's worked/verified example and Tinseth's own
// published bigness-factor constant). The two diverging silently broke
// AC-22's exact-equality clause at gravities away from the small fixture
// that happened to hide the drift. There is now exactly one Tinseth bigness
// constant in the repository, imported above from ./constants, used by both
// this strategy path and brewingMath.ts's engine loop.

/**
 * Utilization = BinetFactor * TimeFactor * hopUtilizationPct/100 — exactly
 * the M7_P1 spec's Resolved Ambiguities §2 formula (the third factor was
 * missing entirely before this fix, critic finding F-1 / AC-4 / AC-22).
 * `hopUtilizationPct` is a brewhouse property (EquipmentProfile), not a
 * module constant — same discipline brewingMath.ts's calculateSingleHopIbu
 * already applies via HopUtilizationSettings, so this consolidates onto the
 * one source of truth rather than inventing a second one.
 */
function tinsethUtilization(wortGravity: number, minutes: number, hopUtilizationPct: number): number {
  const binetFactor = TINSETH_BIGNESS_COEFF * Math.pow(TINSETH_BIGNESS_BASE, wortGravity - 1);
  const timeFactor = (1 - Math.exp(-TINSETH_TIME_RATE * minutes)) / TINSETH_TIME_DIVISOR;
  return binetFactor * timeFactor * (hopUtilizationPct / 100);
}

// Rager constants exactly as the M7_P1 spec's Resolved Ambiguities §2.
const RAGER_UTIL_BASE = 0.1811;
const RAGER_UTIL_COEFF = 0.0838;
const RAGER_UTIL_TIME_OFFSET = 31.32;
const RAGER_UTIL_TIME_DIVISOR = 14.6;
const RAGER_GA_GRAVITY_OFFSET = 1.05;
const RAGER_GA_DIVISOR = 0.2;

function ragerUtilization(minutes: number): number {
  return RAGER_UTIL_BASE + RAGER_UTIL_COEFF * Math.tanh((minutes - RAGER_UTIL_TIME_OFFSET) / RAGER_UTIL_TIME_DIVISOR);
}

function ragerGravityAdjustment(boilGravity: number): number {
  return Math.max(0, (boilGravity - RAGER_GA_GRAVITY_OFFSET) / RAGER_GA_DIVISOR);
}

/**
 * The timing input a hop addition uses for an IBU formula: boilMins for a
 * 'boil'-classified use (Boil/FirstWort), whirlpoolMins for a
 * 'hopstand'-classified use (Aroma/Whirlpool), null for DryHop (no IBU
 * contribution — classifyHopUse already encodes this exhaustively).
 */
function hopTimingMinutes(hop: HopItem): number | null {
  const cls = classifyHopUse(hop.use);
  if (cls === 'none') return null;
  return cls === 'boil' ? hop.boilMins : hop.whirlpoolMins;
}

/**
 * `hopUtilizationPct` and `hopstandUtilizationFactor` are read off the
 * recipe's own EquipmentProfile (AC-22 consolidation) — the identical two
 * brewhouse properties brewingMath.ts's calculateSingleHopIbu already
 * requires via HopUtilizationSettings. hopstandUtilizationFactor applies
 * only to 'hopstand'-classified hops (Aroma/Whirlpool), exactly mirroring
 * the existing engine's behavior, so the two implementations agree to
 * within floating-point rounding on every fixture (AC-22).
 */
function singleHopIbuTinseth(
  hop: HopItem,
  wortGravity: number,
  batchVolumeL: number,
  hopUtilizationPct: number,
  hopstandUtilizationFactor: number,
): number {
  const minutes = hopTimingMinutes(hop);
  if (minutes === null || minutes <= 0 || hop.amountG <= 0 || hop.alphaAcidPct <= 0 || batchVolumeL <= 0 || wortGravity <= 1.0) {
    return 0;
  }
  let utilization = tinsethUtilization(wortGravity, minutes, hopUtilizationPct);
  if (classifyHopUse(hop.use) === 'hopstand') {
    utilization *= hopstandUtilizationFactor;
  }
  return (((hop.alphaAcidPct / 100) * hop.amountG * 1000) / batchVolumeL) * utilization;
}

/**
 * Rager IBU for a single hop addition, exactly as the spec's formula:
 * IBU = weightGrams * (alphaPct/100) * Utilization * 1000 / (volumeLiters * (1+GA))
 * `boilGravity` is fed the recipe's OG — the same "post-boil/fermenter
 * gravity" input the existing engine's Tinseth implementation uses for its
 * own wortGravity parameter (brewingMath.ts step 7 comment: "IBU loop — fed
 * post-boil OG, not preBoilGravity"). The spec text names the term
 * "boilGravity" without defining which recipe-stage gravity that is; OG is
 * used here for consistency with the sole other gravity input this codebase
 * ever feeds an IBU formula — flagged as a judgment call, not spec text.
 */
function singleHopIbuRager(hop: HopItem, boilGravity: number, batchVolumeL: number): number {
  const minutes = hopTimingMinutes(hop);
  if (minutes === null || minutes <= 0 || hop.amountG <= 0 || hop.alphaAcidPct <= 0 || batchVolumeL <= 0) {
    return 0;
  }
  const utilization = ragerUtilization(minutes);
  const ga = ragerGravityAdjustment(boilGravity);
  return (hop.amountG * (hop.alphaAcidPct / 100) * utilization * 1000) / (batchVolumeL * (1 + ga));
}

/**
 * ============================================================================
 * UNAPPROVED LITERATURE-DERIVED CANDIDATE — NOT SPEC TEXT. READ BEFORE USE.
 * ============================================================================
 * The M7_P1 spec's Resolved Ambiguities §2 gives complete, testable
 * closed-form formulas for Tinseth and Rager, but for Garetz says only:
 * "Uses Garetz temperature, concentration, and elevation factor
 * adjustments" — no formula, no coefficients, no table. Garetz's own
 * published method (Ray Daniels' "Using Hops" chapter, and Garetz's original
 * "Comprehensive Guide to Hops and Bitterness," Zymurgy 1993) is
 * table-driven (boil-time-vs-gravity utilization tables plus separate
 * concentration/temperature/elevation correction tables), not a small
 * closed-form equation, and its elevation term needs an altitude input that
 * does not exist anywhere in this codebase's EquipmentProfile or Recipe
 * types — M3_P1's spec explicitly omitted `altitude` from EquipmentProfile
 * as "inert" (M3_P1 §4 deviation 3). Reproducing Garetz's method faithfully
 * is therefore not possible from the spec text or this codebase's existing
 * domain model alone.
 *
 * This function is a CANDIDATE STAND-IN, authored by the executor from
 * memory of commonly published approximations of the Garetz method (as
 * several open-source hop-utilization calculators implement it) — it is
 * NOT verified against Garetz's original tables and NOT blessed by the
 * approved spec. It builds on the Tinseth utilization base (the closest
 * complete formula this spec does pin) and applies:
 *   - a gravity/"concentration" correction scaling with boil gravity above
 *     1.050 (same 0.2 SG-per-unit slope Rager's own GA term uses, since no
 *     Garetz-specific slope is available to cite), and
 *   - the elevation and boiling-point temperature corrections FIXED AT 1.0
 *     (i.e. no adjustment — sea-level, 100C boil), because no altitude
 *     field exists anywhere in this system to drive a real one.
 * Treat this function's numeric output as illustrative only. It is wired
 * into calculateRecipeIbuWithStrategy('garetz') so the type contract and
 * UI selector are fully functional end-to-end, but DO NOT rely on its
 * bitterness numbers being correct. Flagged explicitly for critic/planner
 * attention — awaiting explicit human sign-off on either (a) a cited,
 * verifiable Garetz formula to replace this candidate, or (b) removing
 * 'garetz' from the selectable enum until one exists.
 */
function singleHopIbuGaretzCandidate(hop: HopItem, boilGravity: number, batchVolumeL: number): number {
  const minutes = hopTimingMinutes(hop);
  if (minutes === null || minutes <= 0 || hop.amountG <= 0 || hop.alphaAcidPct <= 0 || batchVolumeL <= 0 || boilGravity <= 1.0) {
    return 0;
  }
  // hopUtilizationPct fixed at 100 (textbook) for this candidate — the
  // Garetz placeholder's disclosure block above pins its own correction
  // factors independently of the brewhouse hopUtilizationPct/
  // hopstandUtilizationFactor terms AC-22 wires through Tinseth; changing
  // that here is out of this fix's scope (AC-4/AC-22 name only Tinseth).
  const utilization = tinsethUtilization(boilGravity, minutes, 100);
  // Concentration/gravity correction factor — see disclosure above; not a
  // cited Garetz constant.
  const concentrationFactor = 1 + Math.max(0, (boilGravity - RAGER_GA_GRAVITY_OFFSET) / RAGER_GA_DIVISOR) * 0.1;
  // Elevation + temperature corrections fixed at sea-level/100C — no
  // altitude input exists in this codebase (see disclosure above).
  const elevationFactor = 1.0;
  const temperatureFactor = 1.0;
  return (
    ((((hop.alphaAcidPct / 100) * hop.amountG * 1000) / batchVolumeL) * utilization) /
    (concentrationFactor * elevationFactor * temperatureFactor)
  );
}

/** Recipe OG (fermenter-volume gravity) — the same term calculateRecipeStats computes at its step 3, recomputed here so this module has no dependency on a pre-computed CalculatedStats object. */
function computeRecipeOg(recipe: Recipe): number {
  const volumes = calculateVolumes(recipe.equipment);
  const extractPoints = totalExtractPoints(recipe.fermentables);
  return gravityAtVolume(extractPoints, recipe.equipment.brewhouseEfficiencyPct, volumes.batchSizeL);
}

/**
 * Total recipe IBU under the given strategy. Recomputes OG internally (see
 * computeRecipeOg) rather than accepting a pre-computed CalculatedStats, so
 * callers can recalculate IBU for a strategy other than the recipe's
 * currently-displayed one without re-running the whole stats pipeline.
 * 'garetz' uses the unapproved literature-derived candidate documented
 * above singleHopIbuGaretzCandidate — see that function's disclosure.
 */
export function calculateRecipeIbuWithStrategy(recipe: Recipe, strategy: IbuFormulaStrategy): number {
  const og = computeRecipeOg(recipe);
  const batchVolumeL = recipe.equipment.batchSizeL;

  const perHop = (hop: HopItem): number => {
    if (strategy === 'tinseth') {
      return singleHopIbuTinseth(hop, og, batchVolumeL, recipe.equipment.hopUtilizationPct, recipe.equipment.hopstandUtilizationFactor);
    }
    if (strategy === 'rager') return singleHopIbuRager(hop, og, batchVolumeL);
    return singleHopIbuGaretzCandidate(hop, og, batchVolumeL);
  };

  return recipe.hops.reduce((sum, hop) => sum + perHop(hop), 0);
}

// ---------------------------------------------------------------------------
// Amendment §2.2.1 — pure display helpers + DEFAULT_USER_CONFIG
// ---------------------------------------------------------------------------

/**
 * Byte-identical to migration 0010's seeded default row (Resolved
 * Ambiguities §3). Doubles as ConfigContext's render-only fallback before
 * the mount-time GET resolves / if it fails — see §2.2.2's binding rule:
 * this value may be RENDERED but must never be PUT.
 */
export const DEFAULT_USER_CONFIG: UserConfig = {
  id: 'default',
  unitSystem: 'metric',
  gravityUnit: 'sg',
  temperatureUnit: 'celsius',
  ibuFormula: 'tinseth',
  abvFormula: 'simple',
};

const EM_DASH = '—';

/**
 * `sg.toFixed(3)` for 'sg' (preserves today's rendering exactly, no suffix);
 * full-precision-then-round-once for 'plato' (§2.2.1's "no rounding before
 * conversion" rule — rounding sg to 3 decimals first and converting after is
 * the defect this binds against). Non-finite input -> em-dash, never "NaN °P".
 */
export function formatGravity(sg: number, unit: GravityUnit): string {
  if (!Number.isFinite(sg)) return EM_DASH;
  if (unit === 'sg') return sg.toFixed(3);
  return `${sgToPlato(sg).toFixed(1)} °P`;
}

/**
 * `fractionDigits` defaults to 1 per §2.2.1. Non-finite input -> em-dash.
 */
export function formatTemperature(celsius: number, unit: TemperatureUnit, fractionDigits = 1): string {
  if (!Number.isFinite(celsius)) return EM_DASH;
  if (unit === 'celsius') return `${celsius.toFixed(fractionDigits)} °C`;
  return `${celsiusToFahrenheit(celsius).toFixed(fractionDigits)} °F`;
}

/**
 * A converter, not a formatter — returns NaN unchanged for non-finite input
 * rather than fabricating a zero (§2.2.1, binding). 'metric' is the identity
 * (not a rounded value); 'us'/'imperial' both use the avoirdupois pound
 * (kg * POUNDS_PER_KG === kgToLb(kg) above), deliberately identical.
 */
export function convertMass(kg: number, system: UnitSystem): number {
  if (!Number.isFinite(kg)) return NaN;
  if (system === 'metric') return kg;
  return kg * LB_PER_KG;
}

export function massUnitLabel(system: UnitSystem): 'kg' | 'lb' {
  return system === 'metric' ? 'kg' : 'lb';
}

/** `fractionDigits` defaults to 2 per §2.2.1. Non-finite input -> em-dash. */
export function formatMass(kg: number, system: UnitSystem, fractionDigits = 2): string {
  if (!Number.isFinite(kg)) return EM_DASH;
  return `${convertMass(kg, system).toFixed(fractionDigits)} ${massUnitLabel(system)}`;
}

// ---------------------------------------------------------------------------
// M7_P2 §2.1 — Hop mass (g <-> oz) and Volume (L <-> US/Imperial gal)
// ---------------------------------------------------------------------------

// Exact avoirdupois ounce definition (M7_P2 Resolved Ambiguity 4).
const GRAMS_PER_OUNCE = 28.349523125;

/**
 * A converter, not a formatter — returns NaN unchanged for non-finite input
 * (Resolved Ambiguity 10). 'metric' is the identity (not rounded);
 * 'us'/'imperial' both use the avoirdupois ounce — deliberately identical
 * (Deviation 3).
 */
export function convertHopMass(grams: number, system: UnitSystem): number {
  if (!Number.isFinite(grams)) return NaN;
  if (system === 'metric') return grams;
  return grams / GRAMS_PER_OUNCE;
}

export function hopMassUnitLabel(system: UnitSystem): 'g' | 'oz' {
  return system === 'metric' ? 'g' : 'oz';
}

/**
 * `fractionDigits` defaults to 1 for 'metric', 2 for 'us'/'imperial'
 * (Resolved Ambiguity 3 — finer precision than formatMass since hop
 * quantities are one to two orders of magnitude smaller). Explicit
 * `fractionDigits` overrides both branches unconditionally. Non-finite
 * input -> em-dash.
 */
export function formatHopMass(grams: number, system: UnitSystem, fractionDigits?: number): string {
  if (!Number.isFinite(grams)) return EM_DASH;
  const d = fractionDigits ?? (system === 'metric' ? 1 : 2);
  return `${convertHopMass(grams, system).toFixed(d)} ${hopMassUnitLabel(system)}`;
}

/**
 * A converter, not a formatter — returns NaN unchanged for non-finite input
 * (Resolved Ambiguity 10). 'metric' is the identity (not rounded); 'us'
 * delegates to the existing lToUsGal export rather than carrying a second
 * inline multiplication (§2.4, the M7_P1 AC-22 lesson); 'imperial' uses the
 * new lToImpGal converter — the two are NOT the same factor (Resolved
 * Ambiguity 2).
 */
export function convertVolume(litres: number, system: UnitSystem): number {
  if (!Number.isFinite(litres)) return NaN;
  if (system === 'metric') return litres;
  if (system === 'us') return lToUsGal(litres);
  return lToImpGal(litres);
}

export function volumeUnitLabel(system: UnitSystem): 'L' | 'gal' | 'imp gal' {
  if (system === 'metric') return 'L';
  if (system === 'us') return 'gal';
  return 'imp gal';
}

/**
 * `fractionDigits` defaults to 1 for 'metric', 2 for 'us'/'imperial'
 * (Resolved Ambiguity 3). Explicit `fractionDigits` overrides both branches
 * unconditionally. Non-finite input -> em-dash.
 */
export function formatVolume(litres: number, system: UnitSystem, fractionDigits?: number): string {
  if (!Number.isFinite(litres)) return EM_DASH;
  const d = fractionDigits ?? (system === 'metric' ? 1 : 2);
  return `${convertVolume(litres, system).toFixed(d)} ${volumeUnitLabel(system)}`;
}
