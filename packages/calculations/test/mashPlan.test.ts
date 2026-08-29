import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, FermentableItem, MashProfile, MashStep, Recipe } from '@truchabrew/shared-types';
import { calculateMashPlan, calculateRecipeStats, infusionVolumeL, calculateWaterVolumes, calculateVolumes } from '../src';

function baseEquipment(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
    id: 'eq-test',
    name: 'Test Equipment',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2,
    hopUtilizationPct: 87,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.26,
    hopstandTemperatureC: 79.0,
    spargeTemperatureC: 76.0,
    mashTunHeatCapacityL: 0.0,
    grainTemperatureC: 20.0,
    notes: '',
    ...overrides,
  };
}

function baseFermentable(overrides: Partial<FermentableItem> = {}): FermentableItem {
  return {
    id: 'f-test',
    name: 'Test Malt',
    type: 'Grain',
    amountKg: 5,
    colorSrm: 3,
    potentialSg: 1.037,
    ...overrides,
  };
}

function mashStep(overrides: Partial<MashStep> = {}): MashStep {
  return {
    id: 'step-test',
    name: 'Test Step',
    type: 'Infusion',
    stepTempC: 67,
    stepTimeMin: 60,
    rampTimeMin: 0,
    infuseAmountL: null,
    infuseWaterTempC: 100,
    ...overrides,
  };
}

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r-test',
    name: 'Test Recipe',
    author: 'Tester',
    styleName: 'Test Style',
    equipment: baseEquipment(),
    fermentables: [baseFermentable()],
    hops: [],
    yeasts: [],
    miscs: [],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
    ...overrides,
  };
}

describe('AC-35: calculateMashPlan no-profile contract', () => {
  it('mashProfile: null returns an object with exactly the hasMashProfile key', () => {
    const plan = calculateMashPlan(baseRecipe({ mashProfile: null }));
    expect(plan.hasMashProfile).toBe(false);
    expect(Object.keys(plan)).toEqual(['hasMashProfile']);
  });
});

describe('AC-36: zero-step profile yields a null strike temperature', () => {
  it('steps: [] -> strikeTemperatureC null, totalInfusionWaterL 0, mashWaterBalanceL 0, finite strikeWaterL', () => {
    const mashProfile: MashProfile = { id: 'mp-1', name: 'Empty Mash', targetPh: 5.4, spargeTempC: null, steps: [] };
    const recipe = baseRecipe({ mashProfile });
    const plan = calculateMashPlan(recipe);
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(plan.steps).toEqual([]);
    expect(plan.strikeTemperatureC).toBeNull();
    expect(plan.totalInfusionWaterL).toBe(0);
    expect(plan.mashWaterBalanceL).toBe(0);
    expect(Number.isFinite(plan.strikeWaterL)).toBe(true);
  });

  it('the iff holds in both directions: a 1-step profile has a non-null strikeTemperatureC', () => {
    const mashProfile: MashProfile = {
      id: 'mp-2',
      name: '1-Step Mash',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [mashStep({ id: 's-0', stepTempC: 67 })],
    };
    const plan = calculateMashPlan(baseRecipe({ mashProfile }));
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(plan.strikeTemperatureC).not.toBeNull();
  });
});

describe('AC-37: step 0 never reports an infusion', () => {
  it('even when steps[0].type is Infusion and infuseAmountL is 12', () => {
    const mashProfile: MashProfile = {
      id: 'mp-3',
      name: 'Mash',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [mashStep({ id: 's-0', type: 'Infusion', stepTempC: 67, infuseAmountL: 12 })],
    };
    const plan = calculateMashPlan(baseRecipe({ mashProfile }));
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(plan.steps[0].infusionVolumeL).toBeNull();
    expect(plan.steps[0].infusionSource).toBe('none');
    expect(plan.steps[0].mashVolumeAfterL).toBe(plan.strikeWaterL);
    expect(plan.totalInfusionWaterL).toBe(0); // the stored 12 never leaks in
  });
});

describe('AC-38: computed vs stored infusion', () => {
  it('a 3-step profile: computed, stored-non-zero, and stored-zero all behave per the documented contract', () => {
    const mashProfile: MashProfile = {
      id: 'mp-4',
      name: '3-Step Mash',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [
        mashStep({ id: 's-0', type: 'Temperature', stepTempC: 52 }),
        mashStep({ id: 's-1', type: 'Infusion', stepTempC: 67, infuseAmountL: null }),
        mashStep({ id: 's-2', type: 'Infusion', stepTempC: 76, infuseAmountL: 4.5 }),
      ],
    };
    const recipe = baseRecipe({ mashProfile, fermentables: [baseFermentable({ amountKg: 5 })] });
    const plan = calculateMashPlan(recipe);
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    const expectedStep1 = infusionVolumeL({
      grainWeightKg: 5,
      currentTempC: 52, // steps[0].stepTempC
      targetTempC: 67,
      infusionWaterTempC: 100,
      currentMashVolumeL: plan.strikeWaterL,
    });
    expect(plan.steps[1].infusionSource).toBe('computed');
    expect(Math.abs(plan.steps[1].infusionVolumeL! - expectedStep1)).toBeLessThanOrEqual(1e-9);

    expect(plan.steps[2].infusionSource).toBe('stored');
    expect(plan.steps[2].infusionVolumeL).toBe(4.5);
  });

  it('infuseAmountL: 0 yields "stored" and exactly 0, not a computed value', () => {
    const mashProfile: MashProfile = {
      id: 'mp-5',
      name: 'Zero Override',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [
        mashStep({ id: 's-0', type: 'Infusion', stepTempC: 52 }),
        mashStep({ id: 's-1', type: 'Infusion', stepTempC: 67, infuseAmountL: 0 }),
      ],
    };
    const plan = calculateMashPlan(baseRecipe({ mashProfile }));
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(plan.steps[1].infusionSource).toBe('stored');
    expect(plan.steps[1].infusionVolumeL).toBe(0);
  });
});

describe('AC-39: non-infusion steps never consume water', () => {
  it('a Decoction or Temperature step at position >= 1 ignores a non-null infuseAmountL', () => {
    const mashProfile: MashProfile = {
      id: 'mp-6',
      name: 'Decoction Mash',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [
        mashStep({ id: 's-0', type: 'Infusion', stepTempC: 52 }),
        mashStep({ id: 's-1', type: 'Decoction', stepTempC: 67, infuseAmountL: 9 }),
        mashStep({ id: 's-2', type: 'Temperature', stepTempC: 76, infuseAmountL: 9 }),
      ],
    };
    const plan = calculateMashPlan(baseRecipe({ mashProfile }));
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    for (const step of [plan.steps[1], plan.steps[2]]) {
      expect(step.infusionVolumeL).toBeNull();
      expect(step.infusionSource).toBe('none');
    }
    expect(plan.steps[1].mashVolumeAfterL).toBe(plan.steps[0].mashVolumeAfterL);
    expect(plan.steps[2].mashVolumeAfterL).toBe(plan.steps[1].mashVolumeAfterL);
    expect(plan.totalInfusionWaterL).toBe(0);
  });
});

describe('AC-40: running volume and balance identity', () => {
  it('mashVolumeAfterL is strikeWaterL plus the cumulative sum of non-null infusion volumes', () => {
    const mashProfile: MashProfile = {
      id: 'mp-7',
      name: 'Identity Mash',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [
        mashStep({ id: 's-0', type: 'Infusion', stepTempC: 52 }),
        mashStep({ id: 's-1', type: 'Infusion', stepTempC: 67, infuseAmountL: null }),
        mashStep({ id: 's-2', type: 'Infusion', stepTempC: 76, infuseAmountL: 3 }),
      ],
    };
    const plan = calculateMashPlan(baseRecipe({ mashProfile }));
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    let running = plan.strikeWaterL;
    let sum = 0;
    for (const step of plan.steps) {
      if (step.infusionVolumeL !== null) {
        running += step.infusionVolumeL;
        sum += step.infusionVolumeL;
      }
      expect(step.mashVolumeAfterL).toBeCloseTo(running, 9);
    }
    expect(plan.totalInfusionWaterL).toBeCloseTo(sum, 9);
    expect(plan.mashWaterBalanceL).toBeCloseTo(-plan.totalInfusionWaterL, 9);
  });
});

describe('AC-41: mash plan degenerate recipe', () => {
  it('zero fermentables + a 2-step profile: totalGrainKg 0, strikeWaterL 0, strikeTemperatureC === steps[0].stepTempC, no NaN/Infinity', () => {
    const mashProfile: MashProfile = {
      id: 'mp-8',
      name: 'Degenerate',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [mashStep({ id: 's-0', stepTempC: 67 }), mashStep({ id: 's-1', stepTempC: 76, infuseAmountL: null })],
    };
    const recipe = baseRecipe({ mashProfile, fermentables: [] });
    const plan = calculateMashPlan(recipe);
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    expect(plan.totalGrainKg).toBe(0);
    expect(plan.strikeWaterL).toBe(0);
    expect(plan.strikeTemperatureC).toBe(67);

    function sweep(value: unknown): void {
      if (typeof value === 'number') {
        expect(Number.isFinite(value)).toBe(true);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(sweep);
        return;
      }
      if (value !== null && typeof value === 'object') {
        Object.values(value).forEach(sweep);
      }
    }
    sweep(plan);
  });
});

describe('AC-42: plan sparge temperature is resolved, not copied', () => {
  it('spargeTempC null -> equipment value, source "equipment"', () => {
    const equipment = baseEquipment({ spargeTemperatureC: 76 });
    const mashProfile: MashProfile = { id: 'mp-9', name: 'Sparge', targetPh: 5.4, spargeTempC: null, steps: [] };
    const plan = calculateMashPlan(baseRecipe({ equipment, mashProfile }));
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(plan.spargeTemperatureC).toBe(76);
    expect(plan.spargeTemperatureSource).toBe('equipment');
  });

  it('spargeTempC === 0 -> 0, source "mashProfile"', () => {
    const equipment = baseEquipment({ spargeTemperatureC: 76 });
    const mashProfile: MashProfile = { id: 'mp-10', name: 'Sparge Zero', targetPh: 5.4, spargeTempC: 0, steps: [] };
    const plan = calculateMashPlan(baseRecipe({ equipment, mashProfile }));
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(plan.spargeTemperatureC).toBe(0);
    expect(plan.spargeTemperatureSource).toBe('mashProfile');
  });
});

describe('AC-43: plan reads the recipe\'s own equipment', () => {
  it('two recipes identical but for equipment.grainTemperatureC produce different strikeTemperatureC and identical stats', () => {
    const mashProfile: MashProfile = {
      id: 'mp-11',
      name: 'Equipment Sensitivity',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [mashStep({ id: 's-0', stepTempC: 67 })],
    };
    const recipeA = baseRecipe({ mashProfile, equipment: baseEquipment({ grainTemperatureC: 10 }) });
    const recipeB = baseRecipe({ mashProfile, equipment: baseEquipment({ grainTemperatureC: 25 }) });

    const planA = calculateMashPlan(recipeA);
    const planB = calculateMashPlan(recipeB);
    if (!planA.hasMashProfile || !planB.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(planA.strikeTemperatureC).not.toBe(planB.strikeTemperatureC);

    expect(calculateRecipeStats(recipeA)).toEqual(calculateRecipeStats(recipeB));
  });

  it('two recipes identical but for equipment.mashTunHeatCapacityL produce different strikeTemperatureC and identical stats', () => {
    const mashProfile: MashProfile = {
      id: 'mp-12',
      name: 'Tun Sensitivity',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [mashStep({ id: 's-0', stepTempC: 67 })],
    };
    const recipeA = baseRecipe({ mashProfile, equipment: baseEquipment({ mashTunHeatCapacityL: 0 }) });
    const recipeB = baseRecipe({ mashProfile, equipment: baseEquipment({ mashTunHeatCapacityL: 8 }) });

    const planA = calculateMashPlan(recipeA);
    const planB = calculateMashPlan(recipeB);
    if (!planA.hasMashProfile || !planB.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(planA.strikeTemperatureC).not.toBe(planB.strikeTemperatureC);

    expect(calculateRecipeStats(recipeA)).toEqual(calculateRecipeStats(recipeB));
  });
});

describe('strikeWaterL matches the exported water-volumes accessor exactly (Resolved Ambiguities)', () => {
  it('strikeWaterL === calculateWaterVolumes(...).mashWaterL, unrounded', () => {
    const equipment = baseEquipment();
    const recipe = baseRecipe({
      equipment,
      mashProfile: { id: 'mp-13', name: 'Cross-check', targetPh: 5.4, spargeTempC: null, steps: [mashStep({ id: 's-0' })] },
    });
    const plan = calculateMashPlan(recipe);
    if (!plan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    const totalGrainKg = recipe.fermentables.reduce((s, f) => s + f.amountKg, 0);
    const preBoilVolumeL = calculateVolumes(equipment).preBoilVolumeL;
    const expected = calculateWaterVolumes(equipment, totalGrainKg, preBoilVolumeL).mashWaterL;
    expect(plan.strikeWaterL).toBe(expected);
  });
});
