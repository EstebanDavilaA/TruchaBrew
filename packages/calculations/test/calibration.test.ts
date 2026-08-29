import { describe, it, expect } from 'vitest';
import { evaluateBatchCalibration, calculateBJCPScore } from '../src';
import type { Recipe } from '@truchabrew/shared-types';

describe('M17_P1 AC-5: evaluateBatchCalibration', () => {
  const dummyRecipe: Recipe = {
    id: 'rec-1',
    name: 'Test IPA',
    author: 'Brewer',
    styleName: 'American IPA',
    equipment: {
      id: 'eq-1',
      name: 'Standard 20L',
      batchSizeL: 20,
      boilTimeMin: 60,
      boilOffRateLPerHour: 3.0,
      trubChillerLossL: 2.0,
      mashEfficiencyPct: 75.0,
      brewhouseEfficiencyPct: 70.0,
      mashTunDeadSpaceL: 0,
      grainAbsorptionLPerKg: 0.96,
      mashWaterRatioLPerKg: 3.0,
      spargeTemperatureC: 76,
      grainTemperatureC: 20,
      mashTunHeatCapacityL: 0,
      hopstandTemperatureC: 80,
      hopUtilizationPct: 100,
      hopstandUtilizationFactor: 0.1,
      derivedFromEquipmentId: null,
      notes: '',
    },
    fermentables: [
      {
        id: 'f-1',
        name: 'Pale Malt',
        amountKg: 5.0,
        potentialSg: 1.037,
        colorSrm: 2.5,
        type: 'Grain',
      },
    ],
    hops: [],
    yeasts: [],
    miscs: [],
    mashProfile: {
      id: 'mp-1',
      name: 'Single Infusion',
      targetPh: 5.3,
      spargeTempC: null,
      steps: [{ id: 's-1', name: 'Sacc', type: 'Infusion', stepTempC: 66, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 75 }],
    },
    fermentationProfile: { id: 'fp-1', name: 'Ale', steps: [] },
    notes: '',
  };

  it('evaluates achieved mash and brewhouse efficiency, boil-off, and trub loss from measured values', () => {
    const result = evaluateBatchCalibration({
      recipe: dummyRecipe,
      measuredPreBoilGravity: 1.042,
      measuredOg: 1.050,
      measuredFg: 1.010,
      measuredPreBoilSizeL: 25.0,
      measuredPostBoilSizeL: 22.0,
      measuredBottlingSizeL: 20.0,
      measuredBoilTimeMin: 60,
    });

    expect(result.canCalibrate).toBe(true);
    expect(result.estimatedBrewhouseEfficiencyPct).toBe(70.0);
    expect(result.estimatedMashEfficiencyPct).toBe(75.0);
    expect(result.currentBoilOffRateLPerHour).toBe(3.0);
    expect(result.currentTrubLossL).toBe(2.0);

    // Boil off: (25 - 22) / 1hr = 3.0 L/hr
    expect(result.achievedBoilOffRateLPerHour).toBe(3.0);
    // Trub loss: 22 - 20 = 2.0 L
    expect(result.achievedTrubLossL).toBe(2.0);
    // Achieved Brewhouse eff: 50 * 20*0.264172 / (5.0*2.20462 * 37) = 264.172 / 407.855 = 64.77%
    expect(result.achievedBrewhouseEfficiencyPct).toBeCloseTo(64.8, 1);
  });

  it('handles null / missing inputs gracefully without throwing', () => {
    const result = evaluateBatchCalibration({
      recipe: dummyRecipe,
      measuredPreBoilGravity: null,
      measuredOg: null,
      measuredFg: null,
    });

    expect(result.canCalibrate).toBe(false);
    expect(result.achievedMashEfficiencyPct).toBeNull();
    expect(result.achievedBrewhouseEfficiencyPct).toBeNull();
    expect(result.achievedBoilOffRateLPerHour).toBeNull();
    expect(result.achievedTrubLossL).toBeNull();
  });
});

describe('M17_P1 AC-6: calculateBJCPScore', () => {
  it('computes 50-point score and maps to Outstanding (45-50) & 5 stars', () => {
    const result = calculateBJCPScore({
      aroma: 11,
      appearance: 3,
      flavor: 19,
      mouthfeel: 5,
      overall: 9,
    });

    expect(result.totalScore).toBe(47);
    expect(result.tier).toBe('Outstanding');
    expect(result.suggestedStarRating).toBe(5);
  });

  it('maps to Excellent (38-44) & 4 stars', () => {
    const result = calculateBJCPScore({
      aroma: 9,
      appearance: 3,
      flavor: 16,
      mouthfeel: 4,
      overall: 8,
    });

    expect(result.totalScore).toBe(40);
    expect(result.tier).toBe('Excellent');
    expect(result.suggestedStarRating).toBe(4);
  });

  it('maps to Very Good (30-37) & 3 stars', () => {
    const result = calculateBJCPScore({
      aroma: 7,
      appearance: 2,
      flavor: 13,
      mouthfeel: 3,
      overall: 7,
    });

    expect(result.totalScore).toBe(32);
    expect(result.tier).toBe('Very Good');
    expect(result.suggestedStarRating).toBe(3);
  });

  it('maps to Good (21-29) & 2 stars', () => {
    const result = calculateBJCPScore({
      aroma: 5,
      appearance: 2,
      flavor: 10,
      mouthfeel: 2,
      overall: 5,
    });

    expect(result.totalScore).toBe(24);
    expect(result.tier).toBe('Good');
    expect(result.suggestedStarRating).toBe(2);
  });

  it('maps to Fair (14-20) & 1 star', () => {
    const result = calculateBJCPScore({
      aroma: 4,
      appearance: 1,
      flavor: 6,
      mouthfeel: 2,
      overall: 4,
    });

    expect(result.totalScore).toBe(17);
    expect(result.tier).toBe('Fair');
    expect(result.suggestedStarRating).toBe(1);
  });

  it('maps to Problematic (0-13) & 1 star and clamps overflowing values', () => {
    const result = calculateBJCPScore({
      aroma: 100, // should clamp to 12
      appearance: 100, // should clamp to 3
      flavor: 100, // should clamp to 20
      mouthfeel: 100, // should clamp to 5
      overall: 100, // should clamp to 10
    });

    expect(result.totalScore).toBe(50);
    expect(result.tier).toBe('Outstanding');
    expect(result.suggestedStarRating).toBe(5);
  });
});
