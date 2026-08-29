import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, MashProfile, FermentationProfile, Recipe } from '@truchabrew/shared-types';
import {
  scaleFactor,
  canScale,
  deriveScaledEquipment,
  scaleRecipe,
  calculateRecipeStats,
  calculateVolumes,
  calculateWaterVolumes,
} from '../src';

const eq1: EquipmentProfile = {
  id: 'eq-1',
  name: 'All-Grain 20L System',
  batchSizeL: 20,
  boilTimeMin: 60,
  brewhouseEfficiencyPct: 75,
  mashEfficiencyPct: 80,
  boilOffRateLPerHour: 3.5,
  trubChillerLossL: 2.0,
  hopUtilizationPct: 87,
  derivedFromEquipmentId: null,
  // Retired-constant values (M3_P1 §1.5).
  mashWaterRatioLPerKg: 3.0,
  grainAbsorptionLPerKg: 0.96,
  hopstandUtilizationFactor: 0.26,
  hopstandTemperatureC: 79.0,
  spargeTemperatureC: 76.0,
  mashTunHeatCapacityL: 0.0,
  grainTemperatureC: 20.0,
  notes: '',
};

const sampleRecipe: Recipe = {
  id: 'rec-sample-1',
  name: 'Trucha West Coast IPA',
  author: 'Esteban',
  styleName: '21A. American IPA',
  equipment: eq1,
  notes: '',
  fermentables: [
    { id: 'rf-1', name: 'Pale Ale Malt (2-Row)', type: 'Grain', amountKg: 5.0, colorSrm: 3.5, potentialSg: 1.038 },
    { id: 'rf-2', name: 'Munich Malt (10 SRM)', type: 'Grain', amountKg: 0.5, colorSrm: 10.0, potentialSg: 1.035 },
    { id: 'rf-3', name: 'Caramalt / Crystal 40', type: 'Grain', amountKg: 0.25, colorSrm: 40.0, potentialSg: 1.034 },
  ],
  hops: [
    { id: 'rh-1', name: 'Magnum', amountG: 20, alphaAcidPct: 14.0, use: 'Boil', boilMins: 60, whirlpoolMins: 60, whirlpoolTempC: 79.0, type: 'Pellet' },
    { id: 'rh-2', name: 'Citra', amountG: 30, alphaAcidPct: 12.5, use: 'Boil', boilMins: 15, whirlpoolMins: 15, whirlpoolTempC: 79.0, type: 'Pellet' },
    { id: 'rh-3', name: 'Mosaic', amountG: 50, alphaAcidPct: 11.8, use: 'Whirlpool', boilMins: 15, whirlpoolMins: 15, whirlpoolTempC: 79.0, type: 'Pellet' },
    { id: 'rh-4', name: 'Simcoe', amountG: 50, alphaAcidPct: 13.0, use: 'DryHop', boilMins: 0, whirlpoolMins: 0, whirlpoolTempC: 79.0, type: 'Pellet' },
  ],
  yeasts: [
    { id: 'ry-1', name: 'US-05 SafAle American', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 78, amountPkg: 1 },
  ],
  miscs: [
    { id: 'rm-1', name: 'Gypsum', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 4, unit: 'g' },
    { id: 'rm-2', name: 'Irish Moss', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'tsp' },
    { id: 'rm-3', name: 'Vanilla Bean', type: 'Flavor', use: 'Secondary', timeMinutes: 0, amount: 1, unit: 'each' },
    { id: 'rm-4', name: 'Lactose', type: 'Other', use: 'Boil', timeMinutes: 5, amount: 50, unit: 'ml' },
    { id: 'rm-5', name: 'Coriander', type: 'Spice', use: 'Whirlpool', timeMinutes: 5, amount: 2, unit: 'tbsp' },
  ],
  mashProfile: null,
  fermentationProfile: null,
};

describe('scaleFactor', () => {
  it('AC-3: returns 0 for degenerate inputs, otherwise the ratio', () => {
    expect(scaleFactor(0, 40)).toBe(0);
    expect(scaleFactor(20, 0)).toBe(0);
    expect(scaleFactor(-5, 40)).toBe(0);
    expect(scaleFactor(20, -1)).toBe(0);
    expect(scaleFactor(20, 40)).toBe(2);
    for (const v of [scaleFactor(0, 40), scaleFactor(20, 0), scaleFactor(-5, 40), scaleFactor(20, -1), scaleFactor(20, 40)]) {
      expect(Number.isNaN(v)).toBe(false);
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('canScale', () => {
  it('AC-4: boundary behaviour', () => {
    expect(canScale(20, 20)).toBe(false);
    expect(canScale(20, 20.0001)).toBe(true);
    expect(canScale(20, 0)).toBe(false);
    expect(canScale(0, 20)).toBe(false);
  });
});

describe('scaleRecipe no-op', () => {
  it('AC-5: returns a deep-equal recipe, equipment not swapped', () => {
    const anyProfile: EquipmentProfile = { ...eq1, id: 'other-profile', name: 'Other' };
    const result = scaleRecipe(sampleRecipe, sampleRecipe.equipment.batchSizeL, anyProfile);
    expect(result).toStrictEqual(sampleRecipe);
    expect(result.equipment).toStrictEqual(sampleRecipe.equipment);
    expect(result.equipment).not.toStrictEqual(anyProfile);
  });
});

describe('deriveScaledEquipment', () => {
  it('AC-6: scales volume-bearing fields', () => {
    const source: EquipmentProfile = { ...eq1, batchSizeL: 20, trubChillerLossL: 2.0, boilOffRateLPerHour: 3.5 };
    const derived = deriveScaledEquipment(source, 40, 'new-id');
    expect(derived.batchSizeL).toBe(40);
    expect(derived.trubChillerLossL).toBe(4.0);
    expect(derived.boilOffRateLPerHour).toBe(7.0);
  });

  it('AC-7: leaves ratio-invariant fields bit-identical', () => {
    const derived = deriveScaledEquipment(eq1, 40, 'new-id');
    expect(derived.boilTimeMin).toBe(eq1.boilTimeMin);
    expect(derived.brewhouseEfficiencyPct).toBe(eq1.brewhouseEfficiencyPct);
    expect(derived.mashEfficiencyPct).toBe(eq1.mashEfficiencyPct);
    expect(derived.hopUtilizationPct).toBe(eq1.hopUtilizationPct);
  });

  it('AC-8: derived-from chains flatten to the root', () => {
    const intermediate = deriveScaledEquipment(eq1, 40, 'intermediate-id');
    expect(intermediate.derivedFromEquipmentId).toBe('eq-1');
    const nested = deriveScaledEquipment(intermediate, 60, 'nested-id');
    expect(nested.derivedFromEquipmentId).toBe('eq-1');
  });

  it('AC-15 (M3_P1): copies the 8 new fields unchanged, including non-default values', () => {
    const source: EquipmentProfile = {
      ...eq1,
      mashWaterRatioLPerKg: 2.75,
      grainAbsorptionLPerKg: 1.1,
      hopstandUtilizationFactor: 0.4,
      hopstandTemperatureC: 82,
      spargeTemperatureC: 78,
      mashTunHeatCapacityL: 5,
      grainTemperatureC: 18,
      notes: 'Scaled from the 20 L kettle',
    };
    const derived = deriveScaledEquipment(source, 40, 'new-id');
    expect(derived.mashWaterRatioLPerKg).toBe(source.mashWaterRatioLPerKg);
    expect(derived.grainAbsorptionLPerKg).toBe(source.grainAbsorptionLPerKg);
    expect(derived.hopstandUtilizationFactor).toBe(source.hopstandUtilizationFactor);
    expect(derived.hopstandTemperatureC).toBe(source.hopstandTemperatureC);
    expect(derived.spargeTemperatureC).toBe(source.spargeTemperatureC);
    expect(derived.mashTunHeatCapacityL).toBe(source.mashTunHeatCapacityL);
    expect(derived.grainTemperatureC).toBe(source.grainTemperatureC);
    expect(derived.notes).toBe(source.notes);
  });
});

describe('scaling invariants (AC-9..AC-13, AC-16)', () => {
  const targetL = 40;
  const derived = deriveScaledEquipment(sampleRecipe.equipment, targetL, 'eq-derived-40');
  const scaled = scaleRecipe(sampleRecipe, targetL, derived);
  const stats20 = calculateRecipeStats(sampleRecipe);
  const stats40 = calculateRecipeStats(scaled);

  it('AC-9: OG and IBU are exactly invariant', () => {
    expect(stats40.og).toBe(stats20.og);
    expect(stats40.ibu).toBe(stats20.ibu);
  });

  it('AC-10: pre-boil gravity is exactly invariant', () => {
    expect(stats40.preBoilGravity).toBe(stats20.preBoilGravity);
  });

  it('AC-11: water/weight quantities scale by exactly the ratio (amended)', () => {
    // AC-11 amendment (post-/verify critic audit): brewingMath.ts rounds each
    // CalculatedStats field independently, so two values at different
    // magnitudes are not guaranteed to stay in an exact ratio after rounding
    // (e.g. 17.25 rounds up to 17.3 at 20 L, but the true 40 L value, 34.5,
    // needs no rounding at all — 17.3*2 = 34.6 != 34.5 even though the
    // unrounded quantities are exactly double). Part (a) below asserts exact
    // parity (1e-6) on the unrounded quantities; part (b) asserts the actual
    // rounded CalculatedStats fields against a per-field rounding-derived
    // band, not a flat tolerance.
    const ratio = 2;

    // --- Part (a): exact parity (1e-6) on unrounded quantities ---
    const totalGrainKg20 = sampleRecipe.fermentables.reduce((s, f) => s + f.amountKg, 0);
    const totalGrainKg40 = scaled.fermentables.reduce((s, f) => s + f.amountKg, 0);
    expect(totalGrainKg40).toBeCloseTo(totalGrainKg20 * ratio, 6);

    const totalHopG20 = sampleRecipe.hops.reduce((s, h) => s + h.amountG, 0);
    const totalHopG40 = scaled.hops.reduce((s, h) => s + h.amountG, 0);
    expect(totalHopG40).toBeCloseTo(totalHopG20 * ratio, 6);

    const volumes20 = calculateVolumes(sampleRecipe.equipment);
    const volumes40 = calculateVolumes(scaled.equipment);
    expect(volumes40.preBoilVolumeL).toBeCloseTo(volumes20.preBoilVolumeL * ratio, 6);
    expect(volumes40.postBoilVolumeL).toBeCloseTo(volumes20.postBoilVolumeL * ratio, 6);

    // Water terms sourced from the real exported accessor (M2's AC-11
    // amendment named this gap) rather than restating the formula shape.
    const water20 = calculateWaterVolumes(sampleRecipe.equipment, totalGrainKg20, volumes20.preBoilVolumeL);
    const water40 = calculateWaterVolumes(scaled.equipment, totalGrainKg40, volumes40.preBoilVolumeL);
    expect(water40.mashWaterL).toBeCloseTo(water20.mashWaterL * ratio, 6);
    expect(water40.spargeWaterL).toBeCloseTo(water20.spargeWaterL * ratio, 6);
    expect(water40.totalWaterL).toBeCloseTo(water20.totalWaterL * ratio, 6);

    // --- Part (b): rounded CalculatedStats fields within a per-field,
    // rounding-derived band: (q_f / 2) * (1 + ratio) ---
    const quantumByField: Record<string, number> = {
      mashWaterL: 0.1,
      spargeWaterL: 0.1,
      totalWaterL: 0.1,
      preBoilVolumeL: 0.1,
      postBoilVolumeL: 0.1,
      totalGrainKg: 0.01,
      totalHopG: 1,
    };
    for (const [field, q] of Object.entries(quantumByField)) {
      const band = (q / 2) * (1 + ratio);
      const actual = Math.abs(
        (stats40[field as keyof typeof stats40] as number) -
          (stats20[field as keyof typeof stats20] as number) * ratio,
      );
      expect(actual).toBeLessThanOrEqual(band);
    }
  });

  it('AC-12: non-integer ratio scaling stays within M1 bands', () => {
    const target25 = 25;
    const derived25 = deriveScaledEquipment(sampleRecipe.equipment, target25, 'eq-derived-25');
    const scaled25 = scaleRecipe(sampleRecipe, target25, derived25);
    const stats25 = calculateRecipeStats(scaled25);

    const ogPoints20 = (stats20.og - 1) * 1000;
    const ogPoints25 = (stats25.og - 1) * 1000;
    expect(Math.abs(ogPoints25 - ogPoints20)).toBeLessThanOrEqual(Math.max(0.01 * ogPoints20, 1.0));
    expect(Math.abs(stats25.ibu - stats20.ibu)).toBeLessThanOrEqual(1.5);
  });

  it('AC-13: yeast amounts are not scaled', () => {
    for (let i = 0; i < sampleRecipe.yeasts.length; i++) {
      expect(scaled.yeasts[i].amountPkg).toBe(sampleRecipe.yeasts[i].amountPkg);
    }
  });
});

describe('misc scaling (AC-14)', () => {
  it('doubles the amount for every unit at ratio 2', () => {
    const derived = deriveScaledEquipment(sampleRecipe.equipment, 40, 'eq-derived-40');
    const scaled = scaleRecipe(sampleRecipe, 40, derived);
    for (let i = 0; i < sampleRecipe.miscs.length; i++) {
      expect(scaled.miscs[i].amount).toBeCloseTo(sampleRecipe.miscs[i].amount * 2, 6);
      expect(scaled.miscs[i].unit).toBe(sampleRecipe.miscs[i].unit);
    }
  });
});

describe('line-item identity survives scaling (AC-15)', () => {
  it('preserves id/name/type/use/time/alphaAcidPct', () => {
    const derived = deriveScaledEquipment(sampleRecipe.equipment, 40, 'eq-derived-40');
    const scaled = scaleRecipe(sampleRecipe, 40, derived);
    for (let i = 0; i < sampleRecipe.fermentables.length; i++) {
      expect(scaled.fermentables[i].id).toBe(sampleRecipe.fermentables[i].id);
      expect(scaled.fermentables[i].name).toBe(sampleRecipe.fermentables[i].name);
      expect(scaled.fermentables[i].type).toBe(sampleRecipe.fermentables[i].type);
    }
    for (let i = 0; i < sampleRecipe.hops.length; i++) {
      expect(scaled.hops[i].id).toBe(sampleRecipe.hops[i].id);
      expect(scaled.hops[i].name).toBe(sampleRecipe.hops[i].name);
      expect(scaled.hops[i].use).toBe(sampleRecipe.hops[i].use);
      expect(scaled.hops[i].boilMins).toBe(sampleRecipe.hops[i].boilMins);
      expect(scaled.hops[i].whirlpoolMins).toBe(sampleRecipe.hops[i].whirlpoolMins);
      expect(scaled.hops[i].whirlpoolTempC).toBe(sampleRecipe.hops[i].whirlpoolTempC);
      expect(scaled.hops[i].alphaAcidPct).toBe(sampleRecipe.hops[i].alphaAcidPct);
    }
  });
});

describe('M3_P2 AC-44: schedules ride through scaleRecipe unchanged', () => {
  it('mashProfile and fermentationProfile are reference-identical on the scaled recipe, not cloned and not dropped', () => {
    const mashProfile: MashProfile = {
      id: 'mash-x',
      name: 'Test Mash',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [],
    };
    const fermentationProfile: FermentationProfile = {
      id: 'ferm-x',
      name: 'Test Fermentation',
      steps: [],
    };
    const recipeWithSchedules: Recipe = { ...sampleRecipe, mashProfile, fermentationProfile };

    const derived = deriveScaledEquipment(recipeWithSchedules.equipment, 40, 'eq-derived-40');
    const scaled = scaleRecipe(recipeWithSchedules, 40, derived);

    expect(scaled.mashProfile).toBe(mashProfile);
    expect(scaled.fermentationProfile).toBe(fermentationProfile);
  });
});

describe('empty recipe scaling (AC-16)', () => {
  it('scales without throwing and produces finite stats', () => {
    const emptyRecipe: Recipe = {
      ...sampleRecipe,
      fermentables: [],
      hops: [],
      yeasts: [],
      miscs: [],
    };
    const derived = deriveScaledEquipment(emptyRecipe.equipment, 40, 'eq-derived-40');
    expect(() => scaleRecipe(emptyRecipe, 40, derived)).not.toThrow();
    const scaled = scaleRecipe(emptyRecipe, 40, derived);
    const stats = calculateRecipeStats(scaled);
    for (const value of Object.values(stats)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
