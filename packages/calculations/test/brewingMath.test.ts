import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, FermentableItem, HopItem, Recipe, YeastItem } from '@truchabrew/shared-types';
import {
  calculateRecipeStats,
  calculateSingleHopIbu,
  calculateVolumes,
  calculateWaterVolumes,
  classifyHopUse,
  moreySrm,
  mcuContribution,
  gravityAtVolume,
  averageAttenuationPct,
  mashEfficiency,
  type HopUtilizationSettings,
} from '../src/brewingMath';
import { srmToEbc, kgToLb, litersToGallons } from '../src/units';

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
    // Retired-constant values (M3_P1 §1.5) — keeps every existing numeric
    // expectation in this file bit-identical to its pre-M3 value.
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

/** Default hop-utilisation settings matching the retired constants (0.26 / 87). */
function baseHopSettings(overrides: Partial<HopUtilizationSettings> = {}): HopUtilizationSettings {
  return {
    hopUtilizationPct: 87,
    hopstandUtilizationFactor: 0.26,
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

function baseHop(overrides: Partial<HopItem> = {}): HopItem {
  return {
    id: 'h-test',
    name: 'Test Hop',
    amountG: 30,
    alphaAcidPct: 10,
    use: 'Boil',
    boilMins: 60, whirlpoolMins: 60, whirlpoolTempC: 79.0,
    type: 'Pellet',
    ...overrides,
  };
}

function baseYeast(overrides: Partial<YeastItem> = {}): YeastItem {
  return {
    id: 'y-test',
    name: 'Test Yeast',
    type: 'Ale',
    form: 'Dry',
    laboratory: 'Test Lab',
    attenuationPct: 75,
    amountPkg: 1,
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
    hops: [baseHop()],
    yeasts: [baseYeast()],
    miscs: [],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
    ...overrides,
  };
}

describe('AC-4: OG uses brewhouse efficiency at batch volume', () => {
  it('matches the hand-computed value and is unaffected by mashEfficiencyPct alone', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    expect(stats.og).toBeCloseTo(1.058, 3);

    const recipeDifferentMash = baseRecipe({
      equipment: baseEquipment({ mashEfficiencyPct: 55 }),
    });
    const statsDifferentMash = calculateRecipeStats(recipeDifferentMash);
    expect(statsDifferentMash.og).toBe(stats.og); // bit-identical
    expect(statsDifferentMash.preBoilGravity).not.toBe(stats.preBoilGravity); // moved
  });
});

describe('AC-5: pre-boil gravity uses mash efficiency at pre-boil volume', () => {
  it('preBoilVolumeL is correct and unaffected by brewhouseEfficiencyPct alone', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    expect(stats.preBoilVolumeL).toBe(25.5);

    const recipeDifferentBrewhouse = baseRecipe({
      equipment: baseEquipment({ brewhouseEfficiencyPct: 40 }),
    });
    const statsDifferentBrewhouse = calculateRecipeStats(recipeDifferentBrewhouse);
    expect(statsDifferentBrewhouse.preBoilGravity).toBe(stats.preBoilGravity); // bit-identical
  });
});

describe('AC-6: pellet bump is gone', () => {
  it('Pellet and Leaf hops produce exactly equal IBU', () => {
    const pellet = baseHop({ type: 'Pellet' });
    const leaf = baseHop({ type: 'Leaf' });
    const ibuPellet = calculateSingleHopIbu(pellet, 1.05, 20, baseHopSettings());
    const ibuLeaf = calculateSingleHopIbu(leaf, 1.05, 20, baseHopSettings());
    expect(ibuPellet).toBe(ibuLeaf);
  });
});

describe('AC-7: hopUtilizationPct scales IBU linearly', () => {
  it('scales the ratio 0.87 between 87 and 100, and is exactly 0 at 0', () => {
    const hop = baseHop();
    const ibu100 = calculateSingleHopIbu(hop, 1.05, 20, baseHopSettings({ hopUtilizationPct: 100 }));
    const ibu87 = calculateSingleHopIbu(hop, 1.05, 20, baseHopSettings({ hopUtilizationPct: 87 }));
    expect(Math.abs(ibu87 / ibu100 - 0.87)).toBeLessThanOrEqual(1e-9);
    expect(calculateSingleHopIbu(hop, 1.05, 20, baseHopSettings({ hopUtilizationPct: 0 }))).toBe(0);
  });
});

describe('AC-8: Aroma and Whirlpool share hopstand utilisation', () => {
  it('Aroma and Whirlpool are equal, and both equal Boil x 0.26', () => {
    const aroma = baseHop({ use: 'Aroma', boilMins: 20, whirlpoolMins: 20, whirlpoolTempC: 79.0 });
    const whirlpool = baseHop({ use: 'Whirlpool', boilMins: 20, whirlpoolMins: 20, whirlpoolTempC: 79.0 });
    const boil = baseHop({ use: 'Boil', boilMins: 20, whirlpoolMins: 20, whirlpoolTempC: 79.0 });

    const ibuAroma = calculateSingleHopIbu(aroma, 1.05, 20, baseHopSettings());
    const ibuWhirlpool = calculateSingleHopIbu(whirlpool, 1.05, 20, baseHopSettings());
    const ibuBoil = calculateSingleHopIbu(boil, 1.05, 20, baseHopSettings());

    expect(ibuAroma).toBe(ibuWhirlpool);
    expect(Math.abs(ibuAroma - ibuBoil * 0.26)).toBeLessThanOrEqual(1e-9);
  });
});

describe('AC-9: whirlpool 15-minute clamp removed', () => {
  it('30-minute whirlpool yields strictly greater IBU than 15-minute', () => {
    const wp15 = baseHop({ use: 'Whirlpool', boilMins: 15, whirlpoolMins: 15, whirlpoolTempC: 79.0 });
    const wp30 = baseHop({ use: 'Whirlpool', boilMins: 30, whirlpoolMins: 30, whirlpoolTempC: 79.0 });
    const ibu15 = calculateSingleHopIbu(wp15, 1.05, 20, baseHopSettings());
    const ibu30 = calculateSingleHopIbu(wp30, 1.05, 20, baseHopSettings());
    expect(ibu30).toBeGreaterThan(ibu15);
  });
});

describe('AC-10: degenerate hop inputs return exactly 0', () => {
  it('DryHop with any time is 0', () => {
    expect(calculateSingleHopIbu(baseHop({ use: 'DryHop', boilMins: 60, whirlpoolMins: 60, whirlpoolTempC: 79.0 }), 1.05, 20, baseHopSettings())).toBe(0);
  });
  it('timeMinutes 0 is 0', () => {
    expect(calculateSingleHopIbu(baseHop({ boilMins: 0, whirlpoolMins: 0, whirlpoolTempC: 79.0 }), 1.05, 20, baseHopSettings())).toBe(0);
  });
  it('timeMinutes -5 is 0', () => {
    expect(calculateSingleHopIbu(baseHop({ boilMins: -5, whirlpoolMins: -5, whirlpoolTempC: 79.0 }), 1.05, 20, baseHopSettings())).toBe(0);
  });
  it('amountG 0 is 0', () => {
    expect(calculateSingleHopIbu(baseHop({ amountG: 0 }), 1.05, 20, baseHopSettings())).toBe(0);
  });
  it('alphaAcidPct 0 is 0', () => {
    expect(calculateSingleHopIbu(baseHop({ alphaAcidPct: 0 }), 1.05, 20, baseHopSettings())).toBe(0);
  });
  it('batchVolumeL 0 is 0, no Infinity/NaN', () => {
    const result = calculateSingleHopIbu(baseHop(), 1.05, 0, baseHopSettings());
    expect(result).toBe(0);
    expect(Number.isFinite(result)).toBe(true);
  });
  it('wortGravity 1.0 is 0 (no extract present)', () => {
    expect(calculateSingleHopIbu(baseHop(), 1.0, 20, baseHopSettings())).toBe(0);
  });
});

describe('AC-11: FirstWort classifies as boil', () => {
  it('classifyHopUse and IBU parity with Boil', () => {
    expect(classifyHopUse('FirstWort')).toBe('boil');
    const firstWort = baseHop({ use: 'FirstWort' });
    const boil = baseHop({ use: 'Boil' });
    expect(calculateSingleHopIbu(firstWort, 1.05, 20, baseHopSettings())).toBe(calculateSingleHopIbu(boil, 1.05, 20, baseHopSettings()));
  });
});

describe('AC-12: Tinseth is fed OG, not pre-boil gravity', () => {
  it('raising trubChillerLossL moves preBoilGravity but leaves total ibu bit-identical', () => {
    const recipeLowLoss = baseRecipe({ equipment: baseEquipment({ trubChillerLossL: 2 }) });
    const recipeHighLoss = baseRecipe({ equipment: baseEquipment({ trubChillerLossL: 8 }) });

    const statsLow = calculateRecipeStats(recipeLowLoss);
    const statsHigh = calculateRecipeStats(recipeHighLoss);

    expect(statsHigh.preBoilGravity).not.toBe(statsLow.preBoilGravity);
    expect(statsHigh.og).toBe(statsLow.og);
    expect(statsHigh.ibu).toBe(statsLow.ibu);
  });
});

describe('AC-13: Morey / MCU degenerate input', () => {
  it('moreySrm(0) === 0, moreySrm(-1) === 0, mcuContribution(5,3,0) === 0', () => {
    expect(moreySrm(0)).toBe(0);
    expect(moreySrm(-1)).toBe(0);
    expect(mcuContribution(5, 3, 0)).toBe(0);
    expect(Number.isFinite(moreySrm(0))).toBe(true);
  });
});

describe('AC-13b: gravityAtVolume degenerate input', () => {
  it('returns exactly 1.0 for any degenerate argument', () => {
    expect(gravityAtVolume(100, 75, 0)).toBe(1.0);
    expect(gravityAtVolume(0, 75, 20)).toBe(1.0);
    expect(gravityAtVolume(100, 0, 20)).toBe(1.0);
    expect(gravityAtVolume(100, -5, 20)).toBe(1.0);
  });
});

describe('AC-14: empty recipe', () => {
  it('returns finite zeroed stats without throwing', () => {
    const recipe = baseRecipe({ fermentables: [], hops: [], yeasts: [] });
    const stats = calculateRecipeStats(recipe);
    expect(stats.og).toBe(1);
    expect(stats.fg).toBe(1);
    expect(stats.abv).toBe(0);
    expect(stats.ibu).toBe(0);
    expect(stats.srm).toBe(0);
    expect(stats.ebc).toBe(0);
    expect(stats.buGu).toBe(0);
    expect(stats.rbr).toBe(0);
    expect(stats.attenuationPct).toBe(0);
    expect(Object.values(stats).every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe('AC-15: empty yeast list falls back, does not crash', () => {
  it('averageAttenuationPct([]) === 75 and stats stay finite with fg < og', () => {
    expect(averageAttenuationPct([])).toBe(75);
    const recipe = baseRecipe({ yeasts: [] });
    const stats = calculateRecipeStats(recipe);
    expect(stats.fg).toBeLessThan(stats.og);
    expect(Number.isFinite(stats.abv)).toBe(true);
  });
});

describe('hop.type never affects IBU (no successor branch on type)', () => {
  it('Cryo, Leaf, Pellet all identical', () => {
    const results = (['Pellet', 'Leaf', 'Cryo'] as const).map((type) =>
      calculateSingleHopIbu(baseHop({ type }), 1.06, 20, baseHopSettings()),
    );
    expect(new Set(results).size).toBe(1);
  });
});


describe('M4_P1 AC-3 & AC-6: mashEfficiency calculations', () => {
  it('AC-3: Calculates correct percentage', () => {
    expect(mashEfficiency(50, 100)).toBe(50);
    expect(mashEfficiency(75, 100)).toBe(75);
    expect(mashEfficiency(30, 40)).toBe(75);
  });

  // AC-6 (amended): null iff maxPossibleGravityPoints <= 0 — a degenerate
  // DENOMINATOR, asserted in both directions. This function knows nothing
  // about "measured vs estimated" gravity; that caller-side condition is
  // AC-9, tested at the UI layer in BatchDetail.test.tsx.
  it('AC-6: returns null iff maxPossibleGravityPoints <= 0', () => {
    expect(mashEfficiency(50, 0)).toBeNull();
    expect(mashEfficiency(50, -5)).toBeNull();
    expect(mashEfficiency(0, 0)).toBeNull();
  });

  it('AC-6: returns a real number — never null — whenever maxPossibleGravityPoints > 0, including a genuine zero reading', () => {
    expect(mashEfficiency(50, 100)).toBe(50);
    expect(mashEfficiency(30, 40)).toBe(75);
    // A real 0 measured-points reading is a number, not an absence — must
    // NOT be conflated with the denominator-degenerate null case.
    expect(mashEfficiency(0, 100)).toBe(0);
  });

  it('AC-6: every numeric result is finite, never NaN or Infinity', () => {
    const cases = [
      mashEfficiency(50, 0),
      mashEfficiency(50, -5),
      mashEfficiency(0, 0),
      mashEfficiency(50, 100),
      mashEfficiency(30, 40),
      mashEfficiency(0, 100),
    ];
    for (const result of cases) {
      if (result === null) continue;
      expect(Number.isNaN(result)).toBe(false);
      expect(Number.isFinite(result)).toBe(true);
    }
  });
});

describe('M4_P1 AC-5: calculateSingleHopIbu uses new fields correctly', () => {
  it('AC-5: Uses boilMins for Boil use', () => {
    const hop = baseHop({ use: 'Boil', boilMins: 60, whirlpoolMins: 0 });
    const ibu = calculateSingleHopIbu(hop, 1.050, 20, baseHopSettings());
    expect(ibu).toBeGreaterThan(0);
  });
  it('AC-5: Uses whirlpoolMins for Whirlpool use', () => {
    const hop = baseHop({ use: 'Whirlpool', boilMins: 0, whirlpoolMins: 30 });
    const ibu = calculateSingleHopIbu(hop, 1.050, 20, baseHopSettings());
    expect(ibu).toBeGreaterThan(0);
  });
  it('AC-5: Returns 0 for DryHop', () => {
    const hop = baseHop({ use: 'DryHop', boilMins: 60, whirlpoolMins: 30 });
    const ibu = calculateSingleHopIbu(hop, 1.050, 20, baseHopSettings());
    expect(ibu).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// M7_P1 amendment (2026-08-13) — §2.2.3's calculateRecipeStats(recipe,
// options?) back-compat contract (AC-21). Narrow named exception per §1.4:
// new cases only, every assertion above this point is untouched.
// ---------------------------------------------------------------------------

describe('AC-21: calculateRecipeStats options back-compat', () => {
  it('calculateRecipeStats(recipe) and calculateRecipeStats(recipe, {}) are deeply equal', () => {
    const recipe = baseRecipe();
    expect(calculateRecipeStats(recipe)).toEqual(calculateRecipeStats(recipe, {}));
  });

  it('omitting options leaves ABV/IBU exactly at the pre-amendment (legacy) values', () => {
    const recipe = baseRecipe();
    const legacy = calculateRecipeStats(recipe);
    const explicitEmpty = calculateRecipeStats(recipe, { abvFormula: undefined, ibuFormula: undefined });
    expect(explicitEmpty).toEqual(legacy);
  });

  it('abvFormula: "simple" produces a different abv than the legacy default at a fixture where Simple and Balling disagree at one decimal', () => {
    const recipe = baseRecipe({
      equipment: baseEquipment({ batchSizeL: 20, brewhouseEfficiencyPct: 100 }),
      fermentables: [baseFermentable({ amountKg: 20, potentialSg: 1.09, colorSrm: 3 })],
    });
    const legacy = calculateRecipeStats(recipe);
    const simple = calculateRecipeStats(recipe, { abvFormula: 'simple' });
    expect(simple.abv).not.toBe(legacy.abv);
  });

  it('ibuFormula: "tinseth" opt-in does not change the default recipe\'s IBU (AC-22 consequence)', () => {
    const recipe = baseRecipe();
    const legacy = calculateRecipeStats(recipe);
    const explicitTinseth = calculateRecipeStats(recipe, { ibuFormula: 'tinseth' });
    expect(explicitTinseth.ibu).toBe(legacy.ibu);
  });
});

// ---------------------------------------------------------------------------
// M11_P1 AC-10, AC-11, AC-16: Physics & Calculations Depth
// ---------------------------------------------------------------------------
describe('M11_P1 AC-10: Reversible Water Volume & Loss Accounting', () => {
  it('calculateWaterVolumes includes mashTunDeadSpaceL in strike water and preserves total balance', () => {
    const eqZero = baseEquipment({ mashWaterRatioLPerKg: 3.0, grainAbsorptionLPerKg: 0.96, mashTunDeadSpaceL: 0 });
    const volumesZero = calculateWaterVolumes(eqZero, 5.0, 25.5);
    expect(volumesZero.mashWaterL).toBe(15.0);

    const eqDeadSpace = baseEquipment({ mashWaterRatioLPerKg: 3.0, grainAbsorptionLPerKg: 0.96, mashTunDeadSpaceL: 1.5 });
    const volumesDeadSpace = calculateWaterVolumes(eqDeadSpace, 5.0, 25.5);
    // Strike water increases by 1.5L
    expect(volumesDeadSpace.mashWaterL).toBe(16.5);
    // Sparge water and total water account for the loss
    expect(volumesDeadSpace.totalWaterL).toBe(volumesZero.totalWaterL + 1.5);
  });

  it('calculateVolumes accounts for kettleLossL in preBoilVolume and postBoilVolume', () => {
    const eqBase = baseEquipment({ batchSizeL: 20, trubChillerLossL: 2, kettleLossL: 0, boilOffRateLPerHour: 3.5, boilTimeMin: 60 });
    const vBase = calculateVolumes(eqBase);
    expect(vBase.postBoilVolumeL).toBe(22);
    expect(vBase.preBoilVolumeL).toBe(25.5);

    const eqKettleLoss = baseEquipment({ batchSizeL: 20, trubChillerLossL: 2, kettleLossL: 1.5, boilOffRateLPerHour: 3.5, boilTimeMin: 60 });
    const vLoss = calculateVolumes(eqKettleLoss);
    expect(vLoss.postBoilVolumeL).toBe(23.5);
    expect(vLoss.preBoilVolumeL).toBe(27.0);
  });
});

describe('M11_P1 AC-11: BUG-016 srmToEbc call-site consistency', () => {
  it('calculateRecipeStats delegates EBC calculation to srmToEbc from units.ts', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const mcu = mcuContribution(kgToLb(recipe.fermentables[0].amountKg), recipe.fermentables[0].colorSrm, litersToGallons(recipe.equipment.batchSizeL));
    const unroundedSrm = moreySrm(mcu);
    expect(stats.ebc).toBe(parseFloat(srmToEbc(unroundedSrm).toFixed(1)));
  });
});

describe('M11_P1 AC-16: Recipe calculations utilize equipment altitude', () => {
  it('calculateRecipeStats automatically factors equipment profile altitude into hop IBU calculation', () => {
    const recipeSeaLevel = baseRecipe({
      equipment: baseEquipment({ altitudeMeters: 0 }),
    });
    const statsSeaLevel = calculateRecipeStats(recipeSeaLevel);

    const recipeHighAltitude = baseRecipe({
      equipment: baseEquipment({ altitudeMeters: 2000 }),
    });
    const statsHighAltitude = calculateRecipeStats(recipeHighAltitude);

    expect(statsHighAltitude.ibu).toBeLessThan(statsSeaLevel.ibu);
  });
});


