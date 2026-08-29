// M18_P1 spec §2.1 — unit tests for buildBrewSheetModel (AC-1..AC-9).
import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, Recipe, CalculatedStats, MashProfile } from '@truchabrew/shared-types';
import { buildBrewSheetModel, calculateRecipeStats, sgToPlato, calculateSingleHopIbu, toHopUtilizationSettings, resolveSpargeTemperatureC } from '../src';

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
    fermentables: [
      { id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 4, colorSrm: 2, potentialSg: 1.037 },
      { id: 'f-2', name: 'Crystal 60', type: 'Grain', amountKg: 1, colorSrm: 60, potentialSg: 1.034 },
    ],
    hops: [
      { id: 'h-boil', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { id: 'h-whirl', name: 'Citra', amountG: 40, alphaAcidPct: 12, use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 79, type: 'Pellet' },
      { id: 'h-dry', name: 'Mosaic', amountG: 30, alphaAcidPct: 11.5, use: 'DryHop', boilMins: null, whirlpoolMins: null, whirlpoolTempC: null, dryHopDayOffset: 3, dryHopDurationDays: 4, type: 'Pellet' },
    ],
    yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
    miscs: [{ id: 'm-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' }],
    notes: '',
    mashProfile: baseMashProfile(),
    fermentationProfile: {
      id: 'ferm-1',
      name: 'Standard Ale',
      steps: [{ id: 'fs-1', name: 'Primary', type: 'Primary', stepTempC: 18, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
    },
    ...overrides,
  };
}

describe('AC-1: header & equipment block', () => {
  it('returns header verbatim and equipment mirrored from recipe.equipment', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'Batch #7', carbonationVolumesTarget: 2.4 });
    expect(model.header).toEqual({ batchName: 'Batch #7', recipeName: 'Test IPA', styleName: 'IPA', author: 'Tester', typeLabel: 'All Grain' });
    expect(model.equipment).toEqual({
      profileName: 'Test Rig',
      brewhouseEfficiencyPct: 72,
      mashEfficiencyPct: 75,
      batchSizeL: 20,
      boilTimeMin: 60,
    });
  });
});

describe('AC-2: vitals', () => {
  it('mirrors stats and computes platoOg from sgToPlato', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.vitals.og).toBe(stats.og);
    expect(model.vitals.fg).toBe(stats.fg);
    expect(model.vitals.abv).toBe(stats.abv);
    expect(model.vitals.ibu).toBe(stats.ibu);
    expect(model.vitals.buGu).toBe(stats.buGu);
    expect(model.vitals.srm).toBe(stats.srm);
    expect(model.vitals.ebc).toBe(stats.ebc);
    expect(model.vitals.platoOg).toBeCloseTo(parseFloat(sgToPlato(stats.og).toFixed(1)), 9);
  });
});

describe('AC-3: volumes & sparge-temp precedence', () => {
  it('mirrors stats volumes and resolves spargeTempC via resolveSpargeTemperatureC (override case)', () => {
    const recipe = baseRecipe({ mashProfile: baseMashProfile({ spargeTempC: 78 }) });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.volumes.mashWaterL).toBe(stats.mashWaterL);
    expect(model.volumes.spargeWaterL).toBe(stats.spargeWaterL);
    expect(model.volumes.totalWaterL).toBe(stats.totalWaterL);
    expect(model.volumes.preBoilVolumeL).toBe(stats.preBoilVolumeL);
    expect(model.volumes.preBoilGravity).toBe(stats.preBoilGravity);
    expect(model.volumes.batchSizeL).toBe(20);
    expect(model.volumes.postBoilVolumeL).toBe(stats.postBoilVolumeL);
    expect(model.volumes.spargeTempC).toBe(78);
    expect(model.volumes.spargeTempC).toBe(resolveSpargeTemperatureC(recipe.equipment, recipe.mashProfile));
  });

  it('inherits equipment.spargeTemperatureC when mashProfile.spargeTempC is null', () => {
    const recipe = baseRecipe({ mashProfile: baseMashProfile({ spargeTempC: null }) });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.volumes.spargeTempC).toBe(recipe.equipment.spargeTemperatureC);
  });
});

describe('AC-4: mash block', () => {
  it('preserves step order and computes strikeTempC for the first step', () => {
    const recipe = baseRecipe({
      mashProfile: baseMashProfile({
        steps: [
          { id: 's1', name: 'Step 1', type: 'Infusion', stepTempC: 67, stepTimeMin: 45, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 },
          { id: 's2', name: 'Step 2', type: 'Temperature', stepTempC: 76, stepTimeMin: 10, rampTimeMin: 5, infuseAmountL: null, infuseWaterTempC: 78 },
        ],
      }),
    });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.mash.rests.map((r) => r.id)).toEqual(['s1', 's2']);
    expect(model.mash.rests[0]).toMatchObject({ stepTempC: 67, stepTimeMin: 45, rampTimeMin: 0 });
    expect(model.mash.strikeTempC).not.toBeNull();
    expect(model.mash.profileName).toBe('Single Infusion');
  });

  it('returns null profileName/strikeTempC/targetPh and [] rests when mashProfile is null', () => {
    const recipe = baseRecipe({ mashProfile: null });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.mash.profileName).toBeNull();
    expect(model.mash.strikeTempC).toBeNull();
    expect(model.mash.targetPh).toBeNull();
    expect(model.mash.rests).toEqual([]);
  });
});

function sweepForNaN(value: unknown, path = 'root'): void {
  if (typeof value === 'number') {
    expect(Number.isNaN(value), `NaN at ${path}`).toBe(false);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => sweepForNaN(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) sweepForNaN(v, `${path}.${k}`);
  }
}

describe('AC-5: grist percentages and total', () => {
  it('sums totalKg to 3 decimals and percentOfGrist sums to ~100', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.fermentables.totalKg).toBeCloseTo(5, 9);
    const sum = model.fermentables.rows.reduce((s, r) => s + r.percentOfGrist, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.2);
  });

  it('zero-fermentable recipe yields totalKg 0, rows [], and no NaN anywhere in the model', () => {
    const recipe = baseRecipe({ fermentables: [] });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.fermentables.totalKg).toBe(0);
    expect(model.fermentables.rows).toEqual([]);
    sweepForNaN(model);
  });
});

describe('AC-6: hop rows, IBU contribution, timing labels', () => {
  it('ibuContribution matches calculateSingleHopIbu; DryHop is 0; Whirlpool label includes minutes and temp; percentOfTotalHops guarded', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    const settings = toHopUtilizationSettings(recipe.equipment);

    const boilRow = model.hops.rows.find((r) => r.id === 'h-boil')!;
    const expectedIbu = parseFloat(calculateSingleHopIbu(recipe.hops[0], stats.og, recipe.equipment.batchSizeL, settings).toFixed(1));
    expect(boilRow.ibuContribution).toBeCloseTo(expectedIbu, 9);

    const dryRow = model.hops.rows.find((r) => r.id === 'h-dry')!;
    expect(dryRow.ibuContribution).toBe(0);
    expect(dryRow.timingLabel).toBe('Day 3 for 4 d');

    const whirlRow = model.hops.rows.find((r) => r.id === 'h-whirl')!;
    expect(whirlRow.timingLabel).toContain('20');
    expect(whirlRow.timingLabel).toContain('79.0');

    const zeroHopsRecipe = baseRecipe({ hops: [] });
    const zeroStats = calculateRecipeStats(zeroHopsRecipe);
    const zeroModel = buildBrewSheetModel({ recipe: zeroHopsRecipe, stats: zeroStats, batchName: 'B', carbonationVolumesTarget: null });
    expect(zeroModel.hops.totalG).toBe(0);
    expect(zeroModel.hops.rows).toEqual([]);
  });
});

describe('AC-7: miscs, yeasts, fermentation rows', () => {
  it('maps 1:1 in source order with all listed fields', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.miscs).toEqual([{ id: 'm-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', amount: 1, unit: 'each', timeMinutes: 10 }]);
    expect(model.yeasts).toEqual([{ id: 'y-1', name: 'US-05', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 75, amountPkg: 1 }]);
    expect(model.fermentation.profileName).toBe('Standard Ale');
    expect(model.fermentation.steps).toEqual([{ id: 'fs-1', name: 'Primary', type: 'Primary', stepTempC: 18, stepTimeDays: 14, rampDays: 0, pressurePsi: null }]);
  });

  it('returns null profileName and [] steps when fermentationProfile is null', () => {
    const recipe = baseRecipe({ fermentationProfile: null });
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null });
    expect(model.fermentation.profileName).toBeNull();
    expect(model.fermentation.steps).toEqual([]);
  });
});

describe('AC-8: carbonation passthrough', () => {
  it('mirrors the input verbatim, including null', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    expect(buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: 2.6 }).carbonationVolumes).toBe(2.6);
    expect(buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: null }).carbonationVolumes).toBeNull();
  });
});

describe('AC-9: purity & determinism', () => {
  it('two calls are deeply equal and input is not mutated', () => {
    const recipe = baseRecipe();
    const stats: CalculatedStats = calculateRecipeStats(recipe);
    const preClone = structuredClone({ recipe, stats });

    const model1 = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: 2.4 });
    const model2 = buildBrewSheetModel({ recipe, stats, batchName: 'B', carbonationVolumesTarget: 2.4 });

    expect(model1).toEqual(model2);
    expect({ recipe, stats }).toEqual(preClone);
  });
});
