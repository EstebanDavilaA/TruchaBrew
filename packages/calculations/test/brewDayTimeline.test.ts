// M18_P1 spec §2.1 — unit tests for buildBrewDayTimeline (AC-10..AC-17).
import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, Recipe, MashProfile } from '@truchabrew/shared-types';
import {
  buildBrewDayTimeline,
  calculateRecipeStats,
  BREW_DAY_STAGE_KEYS,
  MASH_OUT_MIN_TEMP_C,
  MIN_SEGMENT_DISPLAY_SEC,
} from '../src';

function baseEquipment(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
    id: 'eq-1',
    name: 'Test Rig',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 72,
    mashEfficiencyPct: 75,
    boilOffRateLPerHour: 3,
    trubChillerLossL: 1,
    hopUtilizationPct: 100,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3,
    grainAbsorptionLPerKg: 1,
    hopstandUtilizationFactor: 0.2,
    hopstandTemperatureC: 79,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 20,
    notes: '',
    ...overrides,
  };
}

function baseMashProfile(overrides: Partial<MashProfile> = {}): MashProfile {
  return {
    id: 'mash-1',
    name: 'Single Infusion',
    targetPh: 5.4,
    spargeTempC: null,
    steps: [{ id: 'step-1', name: 'Sacc Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
    ...overrides,
  };
}

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    name: 'Test IPA',
    author: 'Tester',
    styleName: 'IPA',
    equipment: baseEquipment(),
    fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 }],
    hops: [
      { id: 'h-boil-60', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { id: 'h-boil-10', name: 'Saaz', amountG: 50, alphaAcidPct: 4, use: 'Boil', boilMins: 10, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { id: 'h-whirl', name: 'Citra', amountG: 40, alphaAcidPct: 12, use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 79, type: 'Pellet' },
      { id: 'h-fw', name: 'First Wort Hop', amountG: 10, alphaAcidPct: 8, use: 'FirstWort', boilMins: null, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
    ],
    yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
    miscs: [
      { id: 'm-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' },
      { id: 'm-2', name: 'No Time Misc', type: 'Fining', use: 'Boil', timeMinutes: 0, amount: 1, unit: 'each' },
    ],
    notes: '',
    mashProfile: baseMashProfile(),
    fermentationProfile: null,
    ...overrides,
  };
}

describe('AC-10: timeline segment count & order', () => {
  it('exactly 4 segments in BREW_DAY_STAGE_KEYS order, prep duration 0', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });
    expect(model.segments.length).toBe(4);
    expect(model.segments.map((s) => s.stage)).toEqual([...BREW_DAY_STAGE_KEYS]);
    expect(model.segments[0].durationSec).toBe(0);
  });
});

describe('AC-11: segment width weighting', () => {
  it('60-min mash / 60-min boil / 20-min hopstand: widthFraction proportional to display duration, sums to 1', () => {
    const recipe = baseRecipe({
      mashProfile: baseMashProfile({
        steps: [{ id: 's1', name: 'Sacc', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
      }),
    });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });

    const displayDurations = [MIN_SEGMENT_DISPLAY_SEC, 3600, 3600, 1200];
    const total = displayDurations.reduce((a, b) => a + b, 0);
    const expectedFractions = displayDurations.map((d) => d / total);

    model.segments.forEach((seg, i) => {
      expect(seg.widthFraction).toBeCloseTo(expectedFractions[i], 9);
    });
    const sum = model.segments.reduce((s, seg) => s + seg.widthFraction, 0);
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(1e-9);

    expect(model.segments[0].startPosition).toBe(0);
    for (let i = 1; i < model.segments.length; i++) {
      expect(Math.abs(model.segments[i].startPosition - (model.segments[i - 1].startPosition + model.segments[i - 1].widthFraction))).toBeLessThanOrEqual(1e-9);
    }
  });
});

describe('AC-12: degenerate all-zero timeline', () => {
  it('no mash steps, boilTimeMin 0, no hopstand hops: totalDurationSec 0, all widthFraction 0.25, no NaN/Infinity, positions in [0,1]', () => {
    const recipe = baseRecipe({
      mashProfile: baseMashProfile({ steps: [] }),
      hops: [],
      miscs: [],
      equipment: baseEquipment({ boilTimeMin: 0 }),
    });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });

    expect(model.totalDurationSec).toBe(0);
    model.segments.forEach((seg) => {
      expect(seg.widthFraction).toBe(0.25);
      expect(Number.isNaN(seg.widthFraction)).toBe(false);
      expect(Number.isFinite(seg.widthFraction)).toBe(true);
    });
    model.milestones.forEach((m) => {
      expect(m.position).toBeGreaterThanOrEqual(0);
      expect(m.position).toBeLessThanOrEqual(1);
      expect(Number.isNaN(m.position)).toBe(false);
    });
  });
});

describe('AC-13: mash-out dot boundary', () => {
  it('emits exactly one mash-out milestone at 75.0C, none at 74.99C', () => {
    const at75 = baseRecipe({
      mashProfile: baseMashProfile({
        steps: [{ id: 's1', name: 'Mash Out', type: 'Temperature', stepTempC: 75.0, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 78 }],
      }),
    });
    const statsAt75 = calculateRecipeStats(at75);
    const modelAt75 = buildBrewDayTimeline({ recipe: at75, stats: statsAt75, strikeTempC: null });
    expect(modelAt75.milestones.filter((m) => m.kind === 'mash-out').length).toBe(1);

    const at7499 = baseRecipe({
      mashProfile: baseMashProfile({
        steps: [{ id: 's1', name: 'Mash Out', type: 'Temperature', stepTempC: 74.99, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 78 }],
      }),
    });
    const statsAt7499 = calculateRecipeStats(at7499);
    const modelAt7499 = buildBrewDayTimeline({ recipe: at7499, stats: statsAt7499, strikeTempC: null });
    expect(modelAt7499.milestones.filter((m) => m.kind === 'mash-out').length).toBe(0);

    expect(MASH_OUT_MIN_TEMP_C).toBe(75);
  });
});

describe('AC-14: sparge dot boundary', () => {
  it('emits one sparge milestone when spargeWaterL > 0, none at exactly 0', () => {
    const recipeWithSparge = baseRecipe({ equipment: baseEquipment({ mashWaterRatioLPerKg: 1, grainAbsorptionLPerKg: 0.1 }) });
    const statsWithSparge = calculateRecipeStats(recipeWithSparge);
    expect(statsWithSparge.spargeWaterL).toBeGreaterThan(0);
    const modelWithSparge = buildBrewDayTimeline({ recipe: recipeWithSparge, stats: statsWithSparge, strikeTempC: null });
    expect(modelWithSparge.milestones.filter((m) => m.kind === 'sparge').length).toBe(1);

    const recipeNoSparge = baseRecipe({ equipment: baseEquipment({ mashWaterRatioLPerKg: 10, grainAbsorptionLPerKg: 0 }) });
    const statsNoSparge = calculateRecipeStats(recipeNoSparge);
    expect(statsNoSparge.spargeWaterL).toBe(0);
    const modelNoSparge = buildBrewDayTimeline({ recipe: recipeNoSparge, stats: statsNoSparge, strikeTempC: null });
    expect(modelNoSparge.milestones.filter((m) => m.kind === 'sparge').length).toBe(0);
  });
});

describe('AC-15: addition dots match the tracker filter', () => {
  it('one addition per Boil hop with non-null boilMins, plus per Boil misc with timeMinutes > 0; FirstWort and zero-time misc produce none', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });
    const additions = model.milestones.filter((m) => m.kind === 'addition');
    // 2 boil hops + 1 qualifying misc = 3; FirstWort hop and zero-time misc excluded.
    expect(additions.length).toBe(3);
    expect(additions.some((a) => a.id === 'addition-hop-h-fw')).toBe(false);
    expect(additions.some((a) => a.id === 'addition-misc-m-2')).toBe(false);
  });
});

describe('AC-16: hopstand dot reads the profile temperature', () => {
  it('label contains 79 and not 80', () => {
    const recipe = baseRecipe({ equipment: baseEquipment({ hopstandTemperatureC: 79 }) });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });
    const dot = model.milestones.find((m) => m.kind === 'hopstand-start')!;
    expect(dot.label).toContain('79');
    expect(dot.label).not.toContain('80');
  });
});

describe('AC-17: milestone ordering determinism', () => {
  it('non-decreasing offsetSec, ties broken ascending by id, stable across calls', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model1 = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });
    const model2 = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });

    for (let i = 1; i < model1.milestones.length; i++) {
      expect(model1.milestones[i].offsetSec).toBeGreaterThanOrEqual(model1.milestones[i - 1].offsetSec);
    }
    expect(model1.milestones.map((m) => m.id)).toEqual(model2.milestones.map((m) => m.id));
  });
});
