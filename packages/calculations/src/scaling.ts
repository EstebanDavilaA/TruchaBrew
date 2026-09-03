import type { EquipmentProfile, Recipe } from '@truchabrew/shared-types';

/**
 * Rounds `value` to `decimals` decimal places using a standard round-half-up
 * approach on the scaled integer, avoiding the string-parsing quirks of
 * `toFixed` at the boundary of representable doubles.
 */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** 0 when either volume is <= 0 (degenerate). Otherwise target / current. */
export function scaleFactor(currentBatchSizeL: number, targetBatchSizeL: number): number {
  if (currentBatchSizeL <= 0 || targetBatchSizeL <= 0) return 0;
  return targetBatchSizeL / currentBatchSizeL;
}

/** True iff scaling would change anything: factor is finite, > 0, and not exactly 1. */
export function canScale(currentBatchSizeL: number, targetBatchSizeL: number): boolean {
  const factor = scaleFactor(currentBatchSizeL, targetBatchSizeL);
  return Number.isFinite(factor) && factor > 0 && factor !== 1;
}

/**
 * Volume-bearing fields scale; ratio-invariant fields do not.
 * newId is injected by the caller — this function never generates an id.
 *
 * `boilOffRateLPerHour` is scaled linearly with batch size, which is a known
 * approximation (evaporation is physically driven by kettle surface area,
 * ~ratio^(2/3), not volume). Linear scaling is chosen so that
 * `preBoilVolumeL` scales by exactly the ratio, which keeps pre-boil gravity
 * and every water volume exactly invariant. See M2_P1 spec, Resolved
 * Ambiguities: "Boil-off scales linearly with batch size".
 */
export function deriveScaledEquipment(
  source: EquipmentProfile,
  targetBatchSizeL: number,
  newId: string,
): EquipmentProfile {
  const r = scaleFactor(source.batchSizeL, targetBatchSizeL);
  return {
    id: newId,
    name: `${source.name} (${targetBatchSizeL} L)`,
    batchSizeL: targetBatchSizeL,
    boilTimeMin: source.boilTimeMin,
    brewhouseEfficiencyPct: source.brewhouseEfficiencyPct,
    mashEfficiencyPct: source.mashEfficiencyPct,
    boilOffRateLPerHour: roundTo(source.boilOffRateLPerHour * r, 3),
    trubChillerLossL: roundTo(source.trubChillerLossL * r, 3),
    hopUtilizationPct: source.hopUtilizationPct,
    derivedFromEquipmentId: source.derivedFromEquipmentId ?? source.id,

    // The 8 M3 fields all copy verbatim — none of them scales with batch
    // size (see M3_P1 spec §2.3): the per-kg water rates still produce
    // volumes that scale by exactly `r` because the grain bill does, the
    // utilisation/temperature fields are dimensionless or physical
    // constants of the kit, and the mash tun's heat capacity does not grow
    // just because the target batch is bigger.
    mashWaterRatioLPerKg: source.mashWaterRatioLPerKg,
    grainAbsorptionLPerKg: source.grainAbsorptionLPerKg,
    hopstandUtilizationFactor: source.hopstandUtilizationFactor,
    hopstandTemperatureC: source.hopstandTemperatureC,
    spargeTemperatureC: source.spargeTemperatureC,
    mashTunHeatCapacityL: source.mashTunHeatCapacityL,
    grainTemperatureC: source.grainTemperatureC,
    notes: source.notes,
  };
}

/**
 * Returns a recipe deep-equal to `recipe` when canScale() is false.
 * Otherwise returns a new Recipe with scaled amounts and `equipment` replaced
 * by `scaledEquipment`. Line-item ids, names, types, uses and times are preserved.
 * Yeasts are never scaled — pitch-rate scaling is M8's calculator, and
 * silently doubling packet counts would be a fabricated number.
 */
export function scaleRecipe(
  recipe: Recipe,
  targetBatchSizeL: number,
  scaledEquipment: EquipmentProfile,
): Recipe {
  if (!canScale(recipe.equipment.batchSizeL, targetBatchSizeL)) {
    return recipe;
  }
  const r = scaleFactor(recipe.equipment.batchSizeL, targetBatchSizeL);

  return {
    ...recipe,
    equipment: scaledEquipment,
    fermentables: recipe.fermentables.map((f) => ({
      ...f,
      amountKg: roundTo(f.amountKg * r, 3),
    })),
    hops: recipe.hops.map((h) => ({
      ...h,
      amountG: roundTo(h.amountG * r, 1),
    })),
    yeasts: recipe.yeasts.map((y) => ({ ...y })),
    miscs: recipe.miscs.map((m) => ({
      ...m,
      amount: roundTo(m.amount * r, 2),
    })),
  };
}
