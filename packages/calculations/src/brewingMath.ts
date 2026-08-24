import type {
  Recipe,
  CalculatedStats,
  HopItem,
  HopUse,
  FermentableItem,
  YeastItem,
  EquipmentProfile,
  AbvFormulaStrategy,
  IbuFormulaStrategy,
} from '@truchabrew/shared-types';
import {
  TINSETH_BIGNESS_COEFF,
  TINSETH_BIGNESS_BASE,
  TINSETH_TIME_RATE,
  TINSETH_TIME_DIVISOR,
  MOREY_COEFF,
  MOREY_EXPONENT,
  AVERAGE_ATTENUATION_BASELINE,
  DEFAULT_ATTENUATION_PCT,
} from './constants';
import { kgToLb, litersToGallons, sgToPointsExact, srmToEbc } from './units';
import { calculateAltitudeHopUtilization } from './mash';
// M7_P1 amendment §2.2.3 — calculateRecipeStats's optional strategy
// dispatch. Circular module reference (config.ts imports calculateVolumes/
// totalExtractPoints/gravityAtVolume/classifyHopUse from this file): safe
// here because both functions below are only ever CALLED from inside
// calculateRecipeStats's body, never at module-evaluation time, so ESM's
// live-binding hoisting resolves them correctly regardless of which module
// finishes initializing first.
import { calculateAbvWithStrategy, calculateRecipeIbuWithStrategy } from './config';

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * Malt Color Units contribution of a single fermentable.
 * `grainColorSrm` deliberately named — the Morey slot takes grain color in
 * SRM (not Lovibond); see M1_P1 spec "MCU colour basis" resolved ambiguity.
 */
export function mcuContribution(weightLb: number, grainColorSrm: number, volumeGal: number): number {
  if (volumeGal <= 0) return 0;
  return (weightLb * grainColorSrm) / volumeGal;
}

export function moreySrm(mcuTotal: number): number {
  if (mcuTotal <= 0) return 0;
  return MOREY_COEFF * Math.pow(mcuTotal, MOREY_EXPONENT);
}

// ---------------------------------------------------------------------------
// Gravity, attenuation, ABV
// ---------------------------------------------------------------------------

export interface VolumeSet {
  batchSizeL: number;
  postBoilVolumeL: number; // batchSizeL + trubChillerLossL
  preBoilVolumeL: number; // postBoilVolumeL + boilOffRateLPerHour * (boilTimeMin / 60)
}

export function calculateVolumes(equipment: EquipmentProfile): VolumeSet {
  const kettleLossL = equipment.kettleLossL ?? 0;
  const postBoilVolumeL = equipment.batchSizeL + equipment.trubChillerLossL + kettleLossL;
  const preBoilVolumeL = postBoilVolumeL + equipment.boilOffRateLPerHour * (equipment.boilTimeMin / 60);
  return {
    batchSizeL: equipment.batchSizeL,
    postBoilVolumeL,
    preBoilVolumeL,
  };
}

/** Sum over fermentables of kgToLb(amountKg) * sgToPointsExact(potentialSg). Empty array -> 0. */
export function totalExtractPoints(fermentables: FermentableItem[]): number {
  return fermentables.reduce((sum, f) => sum + kgToLb(f.amountKg) * sgToPointsExact(f.potentialSg), 0);
}

/**
 * Gravity of a volume of wort given a total extract-points term and an
 * efficiency percentage. Returns exactly 1.0 for any degenerate input.
 */
export function gravityAtVolume(extractPointsLbTimesPoints: number, efficiencyPct: number, volumeL: number): number {
  if (volumeL <= 0 || extractPointsLbTimesPoints <= 0 || efficiencyPct <= 0) return 1.0;
  return 1 + (extractPointsLbTimesPoints * (efficiencyPct / 100)) / litersToGallons(volumeL) / 1000;
}

/** Empty yeast list falls back to DEFAULT_ATTENUATION_PCT. */
export function averageAttenuationPct(yeasts: YeastItem[]): number {
  if (yeasts.length === 0) return DEFAULT_ATTENUATION_PCT;
  return yeasts.reduce((sum, y) => sum + y.attenuationPct, 0) / yeasts.length;
}

export function estimateFg(og: number, attenuationPct: number): number {
  return 1 + (og - 1) * (1 - attenuationPct / 100);
}

export function apparentAttenuationPct(og: number, fg: number): number {
  if (og <= 1.0) return 0;
  return ((og - fg) / (og - 1)) * 100;
}

/** Balling-derived ABV estimate. Never negative — clamps at 0. */
export function abvBalling(og: number, fg: number): number {
  const abv = ((76.08 * (og - fg)) / (1.775 - og)) * (fg / 0.794);
  return Math.max(0, abv);
}

export function buGuRatio(ibu: number, og: number): number {
  if (og <= 1.0) return 0;
  return ibu / ((og - 1) * 1000);
}

export function rbRatio(buGu: number, apparentAttenuationFraction: number): number {
  return buGu * (1 + (apparentAttenuationFraction - AVERAGE_ATTENUATION_BASELINE));
}

// ---------------------------------------------------------------------------
// IBU
// ---------------------------------------------------------------------------

export type HopUtilizationClass = 'boil' | 'hopstand' | 'none';

/** Exhaustive over HopUse — no default branch. */
export function classifyHopUse(use: HopUse): HopUtilizationClass {
  switch (use) {
    case 'Boil':
      return 'boil';
    case 'FirstWort':
      return 'boil';
    case 'Aroma':
      return 'hopstand';
    case 'Whirlpool':
      return 'hopstand';
    case 'DryHop':
      return 'none';
  }
}

export function tinsethBignessFactor(wortGravity: number): number {
  return TINSETH_BIGNESS_COEFF * Math.pow(TINSETH_BIGNESS_BASE, wortGravity - 1.0);
}

export function tinsethBoilTimeFactor(minutes: number): number {
  return (1 - Math.exp(-TINSETH_TIME_RATE * minutes)) / TINSETH_TIME_DIVISOR;
}

export interface HopUtilizationSettings {
  hopUtilizationPct: number; // 100 = textbook Tinseth
  hopstandUtilizationFactor: number; // applied to 'Aroma' and 'Whirlpool' only
}

/** Trivial, pure projection. Exists so the web app cannot drift from the engine. */
export function toHopUtilizationSettings(equipment: EquipmentProfile): HopUtilizationSettings {
  return {
    hopUtilizationPct: equipment.hopUtilizationPct,
    hopstandUtilizationFactor: equipment.hopstandUtilizationFactor,
  };
}

/**
 * Tinseth IBU formula for a single hop addition.
 * `settings` is required — there is no default and no fallback; both terms
 * are brewhouse properties and must come from the caller's EquipmentProfile.
 * The hop variety's Pellet/Leaf/Cryo field is not read — it no longer affects any calculated number.
 */
export function calculateSingleHopIbu(
  hop: HopItem,
  wortGravity: number,
  batchVolumeL: number,
  settings: HopUtilizationSettings,
): number {
  if (classifyHopUse(hop.use) === 'none') return 0;

  const timeMinutes = classifyHopUse(hop.use) === 'boil' ? hop.boilMins : hop.whirlpoolMins;

  if (
    timeMinutes === null ||
    timeMinutes <= 0 ||
    hop.amountG <= 0 ||
    hop.alphaAcidPct <= 0 ||
    batchVolumeL <= 0 ||
    wortGravity <= 1.0
  ) {
    return 0;
  }

  let utilization = tinsethBignessFactor(wortGravity) * tinsethBoilTimeFactor(timeMinutes);

  if (classifyHopUse(hop.use) === 'hopstand') {
    utilization *= settings.hopstandUtilizationFactor;
  }

  utilization *= settings.hopUtilizationPct / 100;

  return (((hop.alphaAcidPct / 100) * hop.amountG * 1000) / batchVolumeL) * utilization;
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export interface WaterVolumes {
  mashWaterL: number; // unrounded
  grainAbsorptionL: number; // unrounded
  spargeWaterL: number; // unrounded
  totalWaterL: number; // unrounded
}

/**
 * Every term is derived from `equipment` and the two scalars — no module-level
 * brewhouse constant is read. Returns unrounded quantities; rounding is the
 * caller's business (calculateRecipeStats step 11 is the only rounder).
 */
export function calculateWaterVolumes(
  equipment: EquipmentProfile,
  totalGrainKg: number,
  preBoilVolumeL: number,
): WaterVolumes {
  const deadSpaceL = equipment.mashTunDeadSpaceL ?? 0;
  const mashWaterL = totalGrainKg * equipment.mashWaterRatioLPerKg + deadSpaceL;
  const grainAbsorptionL = totalGrainKg * equipment.grainAbsorptionLPerKg;
  const spargeWaterL = Math.max(0, preBoilVolumeL - (mashWaterL - grainAbsorptionL - deadSpaceL));
  const totalWaterL = mashWaterL + spargeWaterL;
  return { mashWaterL, grainAbsorptionL, spargeWaterL, totalWaterL };
}

// ---------------------------------------------------------------------------
// Stateful integration
// ---------------------------------------------------------------------------

/**
 * M7_P1 amendment §2.2.3. Binding back-compat rule: when `options` is
 * omitted, or a field within it is omitted, behavior is EXACTLY today's —
 * ABV via abvBalling, IBU via the existing calculateSingleHopIbu loop. The
 * omitted-field default is legacy behavior, NOT DEFAULT_USER_CONFIG's
 * 'simple'/'tinseth' — every existing caller and every existing
 * brewingMath.test.ts assertion stays numerically identical. Only a caller
 * that explicitly opts in (useRecipeEditor.ts, BatchDetail.tsx's fallback
 * path) sees a different number.
 */
export interface RecipeStatsOptions {
  abvFormula?: AbvFormulaStrategy;
  ibuFormula?: IbuFormulaStrategy;
}

export function calculateRecipeStats(recipe: Recipe, options?: RecipeStatsOptions): CalculatedStats {
  const { equipment } = recipe;

  // 1. Volumes.
  const volumes = calculateVolumes(equipment);
  const batchSizeL = volumes.batchSizeL;
  const batchGal = litersToGallons(batchSizeL);

  // 2. Accumulate totalGrainKg, extractPoints, totalMcu in one pass over fermentables.
  let totalGrainKg = 0;
  let totalMcu = 0;
  recipe.fermentables.forEach((f) => {
    totalGrainKg += f.amountKg;
    totalMcu += mcuContribution(kgToLb(f.amountKg), f.colorSrm, batchGal);
  });
  const extractPoints = totalExtractPoints(recipe.fermentables);

  // 3-4. OG at fermenter volume / pre-boil gravity at pre-boil volume.
  //      OG must be computed before the IBU loop — og feeds Tinseth's wort-gravity input.
  const og = gravityAtVolume(extractPoints, equipment.brewhouseEfficiencyPct, batchSizeL);
  const preBoilGravity = gravityAtVolume(extractPoints, equipment.mashEfficiencyPct, volumes.preBoilVolumeL);

  // 5-6. FG, ABV, attenuation. options?.abvFormula opts a caller into the
  // configured strategy (§2.2.3); omitted -> legacy abvBalling, unchanged.
  const fg = estimateFg(og, averageAttenuationPct(recipe.yeasts));
  const abv = options?.abvFormula !== undefined ? calculateAbvWithStrategy(og, fg, options.abvFormula) : abvBalling(og, fg);
  const attenuationPct = apparentAttenuationPct(og, fg);

  // 7. IBU. options?.ibuFormula opts a caller into the strategy engine
  // (§2.2.3/AC-22 — calculateRecipeIbuWithStrategy recomputes OG internally
  // via the identical gravityAtVolume path, so it agrees with this
  // function's own `og` above); omitted -> legacy calculateSingleHopIbu
  // loop, unchanged. totalHopG is strategy-independent either way.
  const hopSettings = toHopUtilizationSettings(equipment);
  let totalHopG = 0;
  recipe.hops.forEach((hop) => {
    totalHopG += hop.amountG;
  });
  let totalIbu =
    options?.ibuFormula !== undefined
      ? calculateRecipeIbuWithStrategy(recipe, options.ibuFormula)
      : recipe.hops.reduce((sum, hop) => sum + calculateSingleHopIbu(hop, og, batchSizeL, hopSettings), 0);

  if (equipment.altitudeMeters && equipment.altitudeMeters > 0) {
    totalIbu = calculateAltitudeHopUtilization(totalIbu, equipment.altitudeMeters);
  }

  // 8. Colour (BUG-016: delegates to srmToEbc from units.ts).
  const srm = moreySrm(totalMcu);
  const ebc = srmToEbc(srm);

  // 9. BU:GU & RBR.
  const buGu = buGuRatio(totalIbu, og);
  const rbr = rbRatio(buGu, attenuationPct / 100);

  // 10. Water volumes.
  const { mashWaterL, spargeWaterL, totalWaterL } = calculateWaterVolumes(equipment, totalGrainKg, volumes.preBoilVolumeL);

  // 11. Rounding, applied only at this final step.
  return {
    og: parseFloat(og.toFixed(3)),
    fg: parseFloat(fg.toFixed(3)),
    abv: parseFloat(abv.toFixed(1)),
    ibu: Math.round(totalIbu),
    srm: parseFloat(srm.toFixed(1)),
    ebc: parseFloat(ebc.toFixed(1)),
    buGu: parseFloat(buGu.toFixed(2)),
    rbr: parseFloat(rbr.toFixed(2)),
    totalGrainKg: parseFloat(totalGrainKg.toFixed(2)),
    totalHopG: Math.round(totalHopG),
    mashWaterL: parseFloat(mashWaterL.toFixed(1)),
    spargeWaterL: parseFloat(spargeWaterL.toFixed(1)),
    totalWaterL: parseFloat(totalWaterL.toFixed(1)),
    preBoilVolumeL: parseFloat(volumes.preBoilVolumeL.toFixed(1)),
    preBoilGravity: parseFloat(preBoilGravity.toFixed(3)),
    attenuationPct: parseFloat(attenuationPct.toFixed(1)),
    postBoilVolumeL: parseFloat(volumes.postBoilVolumeL.toFixed(1)),
  };
}

export function mashEfficiency(actualPreBoilGravityPoints: number, maxPossibleGravityPoints: number): number | null {
  if (maxPossibleGravityPoints <= 0) return null;
  return (actualPreBoilGravityPoints / maxPossibleGravityPoints) * 100;
}
