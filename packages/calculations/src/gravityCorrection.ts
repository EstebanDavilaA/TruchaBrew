// M8_P2 spec §2.1 / Resolved Ambiguities §5. One conserved quantity — total
// extract points (points * volume) — evaluated three ways. No gravity-points
// arithmetic of its own: P(x) is always the IMPORTED sgToPointsExact
// (never sgToPoints, which rounds), volume->gallons is always the IMPORTED
// litersToGallons, and lb->kg divides by POUNDS_PER_KG IMPORTED from
// constants.ts. This module declares no constants of its own.
import { sgToPointsExact, litersToGallons } from './units';
import { POUNDS_PER_KG } from './constants';

export interface GravityCorrectionInput {
  volumeL: number;
  currentSg: number;
  targetSg: number;
}

/**
 * Dilute (gravity too high): V_target = V * P_current / P_target, so
 * dilutionWaterL = V * (P_current / P_target - 1). No clamping — a target
 * ABOVE the current gravity returns a negative (meaningful) result.
 */
export function dilutionWaterL(input: GravityCorrectionInput): number {
  const { volumeL, currentSg, targetSg } = input;
  return volumeL * (sgToPointsExact(currentSg) / sgToPointsExact(targetSg) - 1);
}

export interface DmeCorrectionInput extends GravityCorrectionInput {
  dmePotentialSg: number;
}

/**
 * Add DME (gravity too low): the extra points must come from extract, using
 * the engine's own gravity basis (gravityAtVolume: points are
 * lb * points-per-lb-per-gal / gal). No clamping — a target BELOW the
 * current gravity returns a negative (meaningful) result.
 */
export function dmeToAddKg(input: DmeCorrectionInput): number {
  const { volumeL, currentSg, targetSg, dmePotentialSg } = input;
  return (
    ((sgToPointsExact(targetSg) - sgToPointsExact(currentSg)) * litersToGallons(volumeL)) /
    sgToPointsExact(dmePotentialSg) /
    POUNDS_PER_KG
  );
}

export interface BoilCorrectionInput extends GravityCorrectionInput {
  boilOffRateLPerHour: number;
}

/**
 * Boil longer (gravity too low): the same identity read the other way. No
 * clamping — a target ABOVE the current gravity returns a negative
 * (meaningful) result, and boilOffRateLPerHour === 0 returns +/-Infinity
 * (or NaN when current === target) with no guard.
 */
export function additionalBoilMinutes(input: BoilCorrectionInput): number {
  const { volumeL, currentSg, targetSg, boilOffRateLPerHour } = input;
  return ((volumeL - (volumeL * sgToPointsExact(currentSg)) / sgToPointsExact(targetSg)) / boilOffRateLPerHour) * 60;
}
