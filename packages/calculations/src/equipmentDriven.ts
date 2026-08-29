import type { Recipe } from '@truchabrew/shared-types';
import { totalExtractPoints } from './brewingMath';
import { litersToGallons } from './units';
import { measuredMashEfficiencyPct } from './batchClosing';

// ---------------------------------------------------------------------------
// Post-Brew Equipment & Recipe Calibration Types & Functions (FEAT-002, FEAT-015)
// ---------------------------------------------------------------------------

export interface CalibrationEvaluationInput {
  recipe: Recipe;
  measuredPreBoilGravity: number | null;
  measuredOg: number | null;
  measuredFg: number | null;
  measuredPreBoilSizeL?: number | null;
  measuredPostBoilSizeL?: number | null;
  measuredBottlingSizeL?: number | null;
  measuredBoilTimeMin?: number | null;
}

export interface CalibrationEvaluationResult {
  canCalibrate: boolean;
  estimatedBrewhouseEfficiencyPct: number;
  achievedBrewhouseEfficiencyPct: number | null;
  estimatedMashEfficiencyPct: number;
  achievedMashEfficiencyPct: number | null;
  currentBoilOffRateLPerHour: number;
  achievedBoilOffRateLPerHour: number | null;
  currentTrubLossL: number;
  achievedTrubLossL: number | null;
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

export function evaluateBatchCalibration(input: CalibrationEvaluationInput): CalibrationEvaluationResult {
  const { recipe, measuredPreBoilGravity, measuredOg, measuredPreBoilSizeL, measuredPostBoilSizeL, measuredBottlingSizeL, measuredBoilTimeMin } = input;
  const eq = recipe.equipment;

  const estimatedBrewhouseEfficiencyPct = eq.brewhouseEfficiencyPct;
  const estimatedMashEfficiencyPct = eq.mashEfficiencyPct;
  const currentBoilOffRateLPerHour = eq.boilOffRateLPerHour;
  const currentTrubLossL = eq.trubChillerLossL;

  // 1. Achieved Mash Efficiency
  const rawMashEff = measuredMashEfficiencyPct(recipe, measuredPreBoilGravity);
  const achievedMashEfficiencyPct = rawMashEff !== null ? Number(clamp(30.0, 100.0, rawMashEff).toFixed(1)) : null;

  // 2. Achieved Brewhouse Efficiency
  let achievedBrewhouseEfficiencyPct: number | null = null;
  const packagedVol = measuredBottlingSizeL ?? measuredPostBoilSizeL ?? null;
  if (measuredOg !== null && packagedVol !== null && packagedVol > 0) {
    const potentialPoints = totalExtractPoints(recipe.fermentables);
    if (potentialPoints > 0) {
      const actualPoints = (measuredOg - 1.0) * 1000 * litersToGallons(packagedVol);
      const rawBrewhouseEff = (actualPoints / potentialPoints) * 100;
      achievedBrewhouseEfficiencyPct = Number(clamp(30.0, 95.0, rawBrewhouseEff).toFixed(1));
    }
  }

  // 3. Achieved Boil-Off Rate
  let achievedBoilOffRateLPerHour: number | null = null;
  if (
    measuredPreBoilSizeL !== null &&
    measuredPreBoilSizeL !== undefined &&
    measuredPostBoilSizeL !== null &&
    measuredPostBoilSizeL !== undefined &&
    measuredPreBoilSizeL > measuredPostBoilSizeL
  ) {
    const boilMin = measuredBoilTimeMin && measuredBoilTimeMin > 0 ? measuredBoilTimeMin : eq.boilTimeMin;
    if (boilMin > 0) {
      const boilHours = boilMin / 60;
      const rawBoilOff = (measuredPreBoilSizeL - measuredPostBoilSizeL) / boilHours;
      achievedBoilOffRateLPerHour = Number(clamp(0.5, 10.0, rawBoilOff).toFixed(2));
    }
  }

  // 4. Achieved Trub / Chiller Loss
  let achievedTrubLossL: number | null = null;
  if (
    measuredPostBoilSizeL !== null &&
    measuredPostBoilSizeL !== undefined &&
    measuredBottlingSizeL !== null &&
    measuredBottlingSizeL !== undefined
  ) {
    const rawTrubLoss = Math.max(0, measuredPostBoilSizeL - measuredBottlingSizeL);
    achievedTrubLossL = Number(clamp(0.0, 10.0, rawTrubLoss).toFixed(2));
  }

  const canCalibrate =
    achievedMashEfficiencyPct !== null ||
    achievedBrewhouseEfficiencyPct !== null ||
    achievedBoilOffRateLPerHour !== null ||
    achievedTrubLossL !== null;

  return {
    canCalibrate,
    estimatedBrewhouseEfficiencyPct,
    achievedBrewhouseEfficiencyPct,
    estimatedMashEfficiencyPct,
    achievedMashEfficiencyPct,
    currentBoilOffRateLPerHour,
    achievedBoilOffRateLPerHour,
    currentTrubLossL,
    achievedTrubLossL,
  };
}

// ---------------------------------------------------------------------------
// BJCP Structured Sensory Evaluation & Scoring (FEAT-015)
// ---------------------------------------------------------------------------

export interface SensoryScoreInput {
  aroma: number; // 0-12
  appearance: number; // 0-3
  flavor: number; // 0-20
  mouthfeel: number; // 0-5
  overall: number; // 0-10
}

export type BJCPTier = 'Outstanding' | 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Problematic';

export interface BJCPScoreResult {
  totalScore: number; // 0-50
  tier: BJCPTier;
  suggestedStarRating: number; // 1-5
}

export function calculateBJCPScore(input: SensoryScoreInput): BJCPScoreResult {
  const aroma = clamp(0, 12, input.aroma || 0);
  const appearance = clamp(0, 3, input.appearance || 0);
  const flavor = clamp(0, 20, input.flavor || 0);
  const mouthfeel = clamp(0, 5, input.mouthfeel || 0);
  const overall = clamp(0, 10, input.overall || 0);

  const totalScore = aroma + appearance + flavor + mouthfeel + overall;

  let tier: BJCPTier = 'Problematic';
  let suggestedStarRating = 1;

  if (totalScore >= 45) {
    tier = 'Outstanding';
    suggestedStarRating = 5;
  } else if (totalScore >= 38) {
    tier = 'Excellent';
    suggestedStarRating = 4;
  } else if (totalScore >= 30) {
    tier = 'Very Good';
    suggestedStarRating = 3;
  } else if (totalScore >= 21) {
    tier = 'Good';
    suggestedStarRating = 2;
  } else if (totalScore >= 14) {
    tier = 'Fair';
    suggestedStarRating = 1;
  } else {
    tier = 'Problematic';
    suggestedStarRating = 1;
  }

  return {
    totalScore,
    tier,
    suggestedStarRating,
  };
}
