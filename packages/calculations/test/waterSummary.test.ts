// M19_P1 spec §3 — unit tests for calculateWaterSummary (AC-1, AC-1b, AC-2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CalculatedStats, EquipmentProfile, Recipe } from '@truchabrew/shared-types';
import { calculateWaterSummary } from '../src';

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

function baseStats(overrides: Partial<CalculatedStats> = {}): CalculatedStats {
  return {
    og: 1.0472,
    fg: 1.012,
    abv: 4.6,
    ibu: 34,
    srm: 8,
    ebc: 16,
    buGu: 0.6,
    rbr: 0.5,
    totalGrainKg: 5,
    totalHopG: 70,
    mashWaterL: 15,
    spargeWaterL: 10,
    totalWaterL: 25,
    preBoilVolumeL: 34.65,
    preBoilGravity: 1.0398,
    attenuationPct: 75,
    postBoilVolumeL: 21,
    ...overrides,
  };
}

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r-1',
    name: 'Test Recipe',
    author: 'Tester',
    styleName: 'American IPA',
    equipment: baseEquipment(),
    fermentables: [],
    hops: [],
    yeasts: [],
    miscs: [],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
    ...overrides,
  };
}

describe('AC-1: water summary math', () => {
  it('mashWaterL/spargeWaterL/totalWaterL mirror stats fields', () => {
    const result = calculateWaterSummary({
      recipe: baseRecipe(),
      stats: baseStats(),
      equipment: baseEquipment(),
      predictedMashPh: 5.31,
    });
    expect(result.mashWaterL).toBe(15);
    expect(result.spargeWaterL).toBe(10);
    expect(result.totalWaterL).toBe(25);
  });

  it('totalMashVolumeL === mashWaterL + totalGrainKg * 0.65', () => {
    const result = calculateWaterSummary({
      recipe: baseRecipe(),
      stats: baseStats({ mashWaterL: 15, totalGrainKg: 5 }),
      equipment: baseEquipment(),
      predictedMashPh: null,
    });
    expect(result.totalMashVolumeL).toBeCloseTo(15 + 5 * 0.65, 9);
  });

  it('spargeTempC rung 1: recipe.mashProfile.spargeTempC wins when set', () => {
    const recipe = baseRecipe({
      mashProfile: { id: 'mp-1', name: 'Single Infusion', targetPh: 5.4, spargeTempC: 78, steps: [] },
    });
    const result = calculateWaterSummary({
      recipe,
      stats: baseStats(),
      equipment: baseEquipment({ spargeTemperatureC: 76 }),
      predictedMashPh: null,
    });
    expect(result.spargeTempC).toBe(78);
  });

  it('spargeTempC rung 2: falls back to equipment.spargeTemperatureC when mashProfile.spargeTempC is null', () => {
    const recipe = baseRecipe({
      mashProfile: { id: 'mp-1', name: 'Single Infusion', targetPh: 5.4, spargeTempC: null, steps: [] },
    });
    const result = calculateWaterSummary({
      recipe,
      stats: baseStats(),
      equipment: baseEquipment({ spargeTemperatureC: 74 }),
      predictedMashPh: null,
    });
    expect(result.spargeTempC).toBe(74);
  });

  it('spargeTempC rung 3: falls back to 76 when both mashProfile and equipment are absent/null', () => {
    const result = calculateWaterSummary({
      recipe: baseRecipe({ mashProfile: null }),
      stats: baseStats(),
      equipment: baseEquipment({ spargeTemperatureC: undefined as unknown as number }),
      predictedMashPh: null,
    });
    expect(result.spargeTempC).toBe(76);
  });

  it('predictedMashPh passes through verbatim, unrounded and unclamped', () => {
    const result = calculateWaterSummary({
      recipe: baseRecipe(),
      stats: baseStats(),
      equipment: baseEquipment(),
      predictedMashPh: 5.314159265,
    });
    expect(result.predictedMashPh).toBe(5.314159265);
  });
});

describe('AC-1b: calculateWaterSummary computes no chemistry', () => {
  it('waterSummary.ts source contains no import of or call to water.ts chemistry functions', () => {
    const source = readFileSync(join(__dirname, '../src/waterSummary.ts'), 'utf-8');
    expect(source).not.toMatch(/from ['"]\.\/water['"]/);
    expect(source).not.toMatch(/predictMashPh/);
    expect(source).not.toMatch(/calculateFinishedIons/);
    expect(source).not.toMatch(/calculateResidualAlkalinity/);
  });
});

describe('AC-2: null safety', () => {
  it('stats: null yields 0 for mashWaterL/spargeWaterL/totalWaterL/totalMashVolumeL without throwing', () => {
    expect(() =>
      calculateWaterSummary({
        recipe: baseRecipe(),
        stats: null,
        equipment: baseEquipment(),
        predictedMashPh: null,
      }),
    ).not.toThrow();
    const result = calculateWaterSummary({
      recipe: baseRecipe(),
      stats: null,
      equipment: baseEquipment(),
      predictedMashPh: null,
    });
    expect(result.mashWaterL).toBe(0);
    expect(result.spargeWaterL).toBe(0);
    expect(result.totalWaterL).toBe(0);
    expect(result.totalMashVolumeL).toBe(0);
  });

  it('stats: null still resolves spargeTempC from the recipe/equipment/76 chain', () => {
    const recipe = baseRecipe({
      mashProfile: { id: 'mp-1', name: 'Single Infusion', targetPh: 5.4, spargeTempC: 80, steps: [] },
    });
    const result = calculateWaterSummary({
      recipe,
      stats: null,
      equipment: baseEquipment(),
      predictedMashPh: null,
    });
    expect(result.spargeTempC).toBe(80);
  });

  it('predictedMashPh: null returns null, never 0/NaN/placeholder', () => {
    const result = calculateWaterSummary({
      recipe: baseRecipe(),
      stats: baseStats(),
      equipment: baseEquipment(),
      predictedMashPh: null,
    });
    expect(result.predictedMashPh).toBeNull();
  });

  it('empty-grist input (totalGrainKg === 0) yields totalMashVolumeL === mashWaterL', () => {
    const result = calculateWaterSummary({
      recipe: baseRecipe(),
      stats: baseStats({ mashWaterL: 12, totalGrainKg: 0 }),
      equipment: baseEquipment(),
      predictedMashPh: null,
    });
    expect(result.totalMashVolumeL).toBe(12);
  });
});
