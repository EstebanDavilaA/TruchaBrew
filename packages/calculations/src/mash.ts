import type { EquipmentProfile, MashProfile, MashStepType, Recipe } from '@truchabrew/shared-types';
import { STRIKE_GRAIN_HEAT_COEFF, INFUSION_GRAIN_HEAT_COEFF } from './constants';
import { calculateVolumes, calculateWaterVolumes } from './brewingMath';

// ---------------------------------------------------------------------------
// Altitude & boiling point physics — M11_P1 §2.1
// ---------------------------------------------------------------------------

/**
 * Calculates water boiling point at a given altitude in meters.
 * T_boil(h) = 100.0 - (0.00335 * h)
 */
export function calculateBoilingPoint(altitudeMeters: number): number {
  const h = Math.max(0, altitudeMeters);
  return 100.0 - 0.00335 * h;
}

/**
 * Altitude hop utilization scaling factor:
 * F_alt = max(0.5, 1.0 - 0.008 * (100.0 - T_boil))
 * IBU_adjusted = IBU_standard * F_alt
 */
export function calculateAltitudeHopUtilization(standardIbu: number, altitudeMeters: number): number {
  const tBoil = calculateBoilingPoint(altitudeMeters);
  const factor = Math.max(0.5, 1.0 - 0.008 * (100.0 - tBoil));
  return standardIbu * factor;
}

// ---------------------------------------------------------------------------
// Strike temperature — build-spec §3.5 & M11_P1 §2.1
// ---------------------------------------------------------------------------

export interface StrikeTemperatureInput {
  targetMashTempC: number;
  grainTemperatureC: number;
  waterVolumeL: number;
  grainWeightKg: number;
  mashTunHeatCapacityL?: number;
  calcStrikeWithThermalMass?: boolean;
  mashTunWeightKg?: number;
  mashTunHeatCapacity?: number;
}

export function strikeTempExceedsEnzymeLimit(strikeTempC: number): boolean {
  return strikeTempC > 78.0;
}

export interface StrikeTemperatureResult {
  strikeTemperatureC: number;
  strikeTempExceedsEnzymeLimit: boolean;
}

/**
 * Energy balance for a grist and vessel thermal mass.
 *
 * When calcStrikeWithThermalMass === false:
 * T_strike = T_target + (0.40 * W_grain / V_strike) * (T_target - T_grain)
 *
 * When calcStrikeWithThermalMass === true:
 * T_strike = T_target + ((0.40 * W_grain + c_tun * W_tun) / V_strike) * (T_target - T_grain)
 * (default c_tun = 0.12 for stainless steel).
 *
 * Backwards compatibility: If calcStrikeWithThermalMass is omitted and
 * mashTunHeatCapacityL > 0, mashTunHeatCapacityL is used.
 */
export function strikeTemperatureC(input: StrikeTemperatureInput): number {
  const {
    targetMashTempC,
    grainTemperatureC,
    waterVolumeL,
    grainWeightKg,
    mashTunHeatCapacityL = 0,
    calcStrikeWithThermalMass = false,
    mashTunWeightKg = 0,
    mashTunHeatCapacity = 0.12,
  } = input;

  if (grainWeightKg <= 0) return targetMashTempC;
  if (waterVolumeL <= 0) return targetMashTempC;

  const tunThermalEquivalent = calcStrikeWithThermalMass
    ? mashTunWeightKg * mashTunHeatCapacity
    : mashTunHeatCapacityL;

  return (
    targetMashTempC +
    ((targetMashTempC - grainTemperatureC) * (STRIKE_GRAIN_HEAT_COEFF * grainWeightKg + tunThermalEquivalent)) /
      waterVolumeL
  );
}

export function calculateStrikeTemperature(input: StrikeTemperatureInput): StrikeTemperatureResult {
  const temp = strikeTemperatureC(input);
  return {
    strikeTemperatureC: temp,
    strikeTempExceedsEnzymeLimit: strikeTempExceedsEnzymeLimit(temp),
  };
}

// ---------------------------------------------------------------------------
// Infusion volume — build-spec §3.5
// ---------------------------------------------------------------------------

export interface InfusionVolumeInput {
  grainWeightKg: number;
  currentTempC: number;
  targetTempC: number;
  infusionWaterTempC: number;
  currentMashVolumeL: number;
}

/**
 * build-spec §3.5. Returns litres, unrounded, never negative, never NaN.
 *
 * Degenerate guards, evaluated in order:
 *  - targetTempC <= currentTempC                -> 0 (not an infusion)
 *  - infusionWaterTempC <= targetTempC           -> 0 (guards the zero/negative denominator)
 *  - grainWeightKg <= 0 AND currentMashVolumeL <= 0 -> 0 (nothing to heat)
 *
 * The guards make the numerator strictly positive and the denominator
 * strictly positive whenever they are passed, so the result is strictly
 * positive whenever it is reached. There is no clamp.
 */
export function infusionVolumeL(input: InfusionVolumeInput): number {
  const { grainWeightKg, currentTempC, targetTempC, infusionWaterTempC, currentMashVolumeL } = input;

  if (targetTempC <= currentTempC) return 0;
  if (infusionWaterTempC <= targetTempC) return 0;
  if (grainWeightKg <= 0 && currentMashVolumeL <= 0) return 0;

  return (
    ((targetTempC - currentTempC) * (INFUSION_GRAIN_HEAT_COEFF * grainWeightKg + currentMashVolumeL)) /
    (infusionWaterTempC - targetTempC)
  );
}

// ---------------------------------------------------------------------------
// Sparge temperature resolution
// ---------------------------------------------------------------------------

/**
 * The ONE rule. `mashProfile.spargeTempC !== null` wins; otherwise the
 * brewhouse default. Never a falsy check — 0 is a legitimate stored value.
 */
export function resolveSpargeTemperatureC(equipment: EquipmentProfile, mashProfile: MashProfile | null): number {
  if (mashProfile !== null && mashProfile.spargeTempC !== null) {
    return mashProfile.spargeTempC;
  }
  return equipment.spargeTemperatureC;
}

// ---------------------------------------------------------------------------
// Mash plan assembly
// ---------------------------------------------------------------------------

export interface MashPlanStep {
  stepId: string;
  name: string;
  type: MashStepType;
  position: number;
  stepTempC: number;
  stepTimeMin: number;
  rampTimeMin: number;
  infusionVolumeL: number | null;              // null iff infusionSource === 'none'
  infusionSource: 'computed' | 'stored' | 'none';
  infuseWaterTempC: number;
  mashVolumeAfterL: number;                    // running total, unrounded
}

export type MashPlan =
  | { hasMashProfile: false }
  | {
      hasMashProfile: true;
      profileId: string;
      profileName: string;
      targetPh: number;
      spargeTemperatureC: number;
      spargeTemperatureSource: 'mashProfile' | 'equipment';
      totalGrainKg: number;
      strikeWaterL: number;
      strikeTemperatureC: number | null;   // null iff steps.length === 0
      steps: MashPlanStep[];
      totalInfusionWaterL: number;
      mashWaterBalanceL: number;           // signed; negative = schedule wants more water
    };

/** Pure. Reads only `recipe`. Never throws. */
export function calculateMashPlan(recipe: Recipe): MashPlan {
  const { mashProfile, equipment } = recipe;

  if (mashProfile === null) {
    return { hasMashProfile: false };
  }

  const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + f.amountKg, 0);
  const preBoilVolumeL = calculateVolumes(equipment).preBoilVolumeL;
  const waterVolumes = calculateWaterVolumes(equipment, totalGrainKg, preBoilVolumeL);
  const strikeWaterL = waterVolumes.mashWaterL;

  const spargeTemperatureSource: 'mashProfile' | 'equipment' =
    mashProfile.spargeTempC !== null ? 'mashProfile' : 'equipment';
  const spargeTemperatureC = resolveSpargeTemperatureC(equipment, mashProfile);

  const steps: MashPlanStep[] = [];
  let runningVolumeL = strikeWaterL;
  let totalInfusionWaterL = 0;

  mashProfile.steps.forEach((step, position) => {
    // Step 0 never reports an infusion — the strike water is reported
    // separately, once, at the plan level (Resolved Ambiguities).
    const isFirstStep = position === 0;
    const isInfusionStep = !isFirstStep && step.type === 'Infusion';

    let stepInfusionVolumeL: number | null = null;
    let infusionSource: 'computed' | 'stored' | 'none' = 'none';

    if (isInfusionStep) {
      if (step.infuseAmountL !== null) {
        stepInfusionVolumeL = step.infuseAmountL;
        infusionSource = 'stored';
      } else {
        const previousStepTempC = mashProfile.steps[position - 1].stepTempC;
        stepInfusionVolumeL = infusionVolumeL({
          grainWeightKg: totalGrainKg,
          currentTempC: previousStepTempC,
          targetTempC: step.stepTempC,
          infusionWaterTempC: step.infuseWaterTempC,
          currentMashVolumeL: runningVolumeL,
        });
        infusionSource = 'computed';
      }
      runningVolumeL += stepInfusionVolumeL;
      totalInfusionWaterL += stepInfusionVolumeL;
    }

    steps.push({
      stepId: step.id,
      name: step.name,
      type: step.type,
      position,
      stepTempC: step.stepTempC,
      stepTimeMin: step.stepTimeMin,
      rampTimeMin: step.rampTimeMin,
      infusionVolumeL: stepInfusionVolumeL,
      infusionSource,
      infuseWaterTempC: step.infuseWaterTempC,
      mashVolumeAfterL: runningVolumeL,
    });
  });

  const strikeTemperatureCValue: number | null =
    mashProfile.steps.length === 0
      ? null
      : strikeTemperatureC({
          targetMashTempC: mashProfile.steps[0].stepTempC,
          grainTemperatureC: equipment.grainTemperatureC,
          waterVolumeL: strikeWaterL,
          grainWeightKg: totalGrainKg,
          mashTunHeatCapacityL: equipment.mashTunHeatCapacityL,
          calcStrikeWithThermalMass: equipment.calcStrikeWithThermalMass,
          mashTunWeightKg: equipment.mashTunWeightKg,
          mashTunHeatCapacity: equipment.mashTunHeatCapacity,
        });

  const mashWaterBalanceL = waterVolumes.mashWaterL - (strikeWaterL + totalInfusionWaterL);

  return {
    hasMashProfile: true,
    profileId: mashProfile.id,
    profileName: mashProfile.name,
    targetPh: mashProfile.targetPh,
    spargeTemperatureC,
    spargeTemperatureSource,
    totalGrainKg,
    strikeWaterL,
    strikeTemperatureC: strikeTemperatureCValue,
    steps,
    totalInfusionWaterL,
    mashWaterBalanceL,
  };
}
