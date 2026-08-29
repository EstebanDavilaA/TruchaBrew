import type { EquipmentCreateInput, RecipeWriteInput } from '@truchabrew/shared-types';

/** A full equipment POST/PUT body, all 17 mutable fields at realistic values. */
export function fullEquipmentInput(overrides: Partial<EquipmentCreateInput> = {}): EquipmentCreateInput {
  return {
    name: 'Test Equipment Profile',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75,
    mashEfficiencyPct: 80,
    boilOffRateLPerHour: 3.5,
    trubChillerLossL: 2.0,
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

/** A full-featured write input covering all four line-item categories. */
export function fullRecipeInput(overrides: Partial<RecipeWriteInput> = {}): RecipeWriteInput {
  return {
    name: 'Trucha Test IPA',
    author: 'Tester',
    styleName: '21A. American IPA',
    notes: 'Test notes',
    equipmentId: 'eq-1',
    fermentables: [
      { name: 'Pale Ale Malt (2-Row)', type: 'Grain', amountKg: 5.005, colorSrm: 3.5, potentialSg: 1.038 },
      { name: 'Munich Malt (10 SRM)', type: 'Grain', amountKg: 0.5, colorSrm: 10.0, potentialSg: 1.035 },
    ],
    hops: [
      { name: 'Magnum', amountG: 20, alphaAcidPct: 12.35, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { name: 'Citra', amountG: 30, alphaAcidPct: 12.5, use: 'Whirlpool', boilMins: null, whirlpoolMins: 15, whirlpoolTempC: 79.0, type: 'Pellet' },
      { name: 'Simcoe', amountG: 50, alphaAcidPct: 13.0, use: 'DryHop', boilMins: null, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
    ],
    yeasts: [
      { name: 'US-05 SafAle American', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 78, amountPkg: 1 },
    ],
    miscs: [{ name: 'Gypsum', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 4, unit: 'g' }],
    mashProfileId: null,
    fermentationProfileId: null,
    waterSourceId: null,
    waterTargetId: null,
    ...overrides,
  };
}

export function emptyRecipeInput(overrides: Partial<RecipeWriteInput> = {}): RecipeWriteInput {
  return {
    name: 'Empty Recipe',
    author: '',
    styleName: '',
    notes: '',
    equipmentId: 'eq-1',
    fermentables: [],
    hops: [],
    yeasts: [],
    miscs: [],
    mashProfileId: null,
    fermentationProfileId: null,
    waterSourceId: null,
    waterTargetId: null,
    ...overrides,
  };
}
