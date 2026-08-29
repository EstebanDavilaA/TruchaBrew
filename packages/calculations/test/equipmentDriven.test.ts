import { describe, it, expect } from 'vitest';
import type { HopItem } from '@truchabrew/shared-types';
import {
  calculateRecipeStats,
  calculateWaterVolumes,
  calculateVolumes,
  calculateSingleHopIbu,
  totalExtractPoints,
  gravityAtVolume,
} from '../src/brewingMath';
import { loadFixtureRecipes } from './fixtures/fixtureAdapter';

/**
 * The roadmap's own verification threshold ("no calculation in
 * /packages/calculations reads a brewhouse constant that isn't passed in as
 * an argument") is made testable by these two checks: moving a brewhouse
 * number on the EquipmentProfile must move the numbers that depend on it,
 * by exactly the amount the formula predicts — proof the engine is actually
 * reading the argument, not a module-level constant that happens to share
 * its value.
 */
function fixtureRecipe() {
  const entries = loadFixtureRecipes();
  const entry = entries.find((e) => e.expected.name === 'Tangara APA');
  if (!entry) throw new Error('Expected fixture recipe "Tangara APA" not found in the fixture set.');
  return entry.recipe;
}

describe('AC-10: grain absorption moves sparge water (roadmap threshold)', () => {
  it('raising grainAbsorptionLPerKg from 0.96 to 1.20 raises spargeWaterL by exactly totalGrainKg * 0.24, leaves mashWaterL bit-identical, raises totalWaterL by the same amount', () => {
    const recipe = fixtureRecipe();
    const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + f.amountKg, 0);
    const preBoilVolumeL = calculateVolumes(recipe.equipment).preBoilVolumeL;

    const equipmentLow = { ...recipe.equipment, grainAbsorptionLPerKg: 0.96 };
    const equipmentHigh = { ...recipe.equipment, grainAbsorptionLPerKg: 1.2 };

    const waterLow = calculateWaterVolumes(equipmentLow, totalGrainKg, preBoilVolumeL);
    const waterHigh = calculateWaterVolumes(equipmentHigh, totalGrainKg, preBoilVolumeL);

    // Sanity: neither side is sparge-clamped, or the "raises by exactly the
    // delta" claim would not hold (the clamp would absorb part of it).
    expect(waterLow.spargeWaterL).toBeGreaterThan(0);

    expect(waterHigh.mashWaterL).toBe(waterLow.mashWaterL); // bit-identical — absorption doesn't touch mash water

    const expectedDelta = totalGrainKg * 0.24;
    expect(Math.abs(waterHigh.spargeWaterL - waterLow.spargeWaterL - expectedDelta)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(waterHigh.totalWaterL - waterLow.totalWaterL - expectedDelta)).toBeLessThanOrEqual(1e-9);
  });
});

describe('AC-11: hop utilisation moves IBU (roadmap threshold)', () => {
  it('changing hopUtilizationPct from 87 to 100 multiplies the unrounded IBU total by exactly 100/87', () => {
    const recipe = fixtureRecipe();
    const { equipment } = recipe;

    // Reconstruct the same unrounded wort gravity calculateRecipeStats feeds
    // into the IBU loop internally, using only the exported pure primitives
    // it itself calls — not the rounded CalculatedStats.og, which would
    // introduce error far larger than the 1e-9 tolerance this AC demands.
    const volumes = calculateVolumes(equipment);
    const extractPoints = totalExtractPoints(recipe.fermentables);
    const og = gravityAtVolume(extractPoints, equipment.brewhouseEfficiencyPct, volumes.batchSizeL);

    const sumIbu = (hopUtilizationPct: number) =>
      recipe.hops.reduce(
        (sum, hop) =>
          sum +
          calculateSingleHopIbu(hop, og, volumes.batchSizeL, {
            hopUtilizationPct,
            hopstandUtilizationFactor: equipment.hopstandUtilizationFactor,
          }),
        0,
      );

    const totalIbu87 = sumIbu(87);
    const totalIbu100 = sumIbu(100);

    expect(totalIbu87).toBeGreaterThan(0); // sanity: the fixture recipe actually has bittering hops
    expect(Math.abs(totalIbu100 / totalIbu87 - 100 / 87)).toBeLessThanOrEqual(1e-9);
  });

  it('the rounded CalculatedStats.ibu strictly increases from 87 to 100', () => {
    const recipe = fixtureRecipe();
    const stats87 = calculateRecipeStats({ ...recipe, equipment: { ...recipe.equipment, hopUtilizationPct: 87 } });
    const stats100 = calculateRecipeStats({ ...recipe, equipment: { ...recipe.equipment, hopUtilizationPct: 100 } });
    expect(stats100.ibu).toBeGreaterThan(stats87.ibu);
  });

  it('at hopUtilizationPct: 0 the total IBU is exactly 0', () => {
    const recipe = fixtureRecipe();
    const stats0 = calculateRecipeStats({ ...recipe, equipment: { ...recipe.equipment, hopUtilizationPct: 0 } });
    expect(stats0.ibu).toBe(0);
  });
});

describe('AC-12: hopstand factor affects only hopstand additions', () => {
  const wortGravity = 1.055;
  const batchVolumeL = 20;

  const boil: HopItem = { id: 'h-boil', name: 'Boil Hop', amountG: 20, alphaAcidPct: 12, use: 'Boil', boilMins: 60, whirlpoolMins: 60, whirlpoolTempC: 79.0, type: 'Pellet' };
  const firstWort: HopItem = { ...boil, id: 'h-fw', use: 'FirstWort' };
  const aroma: HopItem = { id: 'h-aroma', name: 'Aroma Hop', amountG: 30, alphaAcidPct: 11, use: 'Aroma', boilMins: 15, whirlpoolMins: 15, whirlpoolTempC: 79.0, type: 'Pellet' };
  const whirlpool: HopItem = { ...aroma, id: 'h-wp', use: 'Whirlpool' };
  const dryHop: HopItem = { id: 'h-dh', name: 'Dry Hop', amountG: 50, alphaAcidPct: 13, use: 'DryHop', boilMins: 0, whirlpoolMins: 0, whirlpoolTempC: 79.0, type: 'Pellet' };

  const settingsLow = { hopUtilizationPct: 87, hopstandUtilizationFactor: 0.26 };
  const settingsHigh = { hopUtilizationPct: 87, hopstandUtilizationFactor: 0.52 };

  it('leaves every Boil/FirstWort contribution bit-identical', () => {
    for (const hop of [boil, firstWort]) {
      const low = calculateSingleHopIbu(hop, wortGravity, batchVolumeL, settingsLow);
      const high = calculateSingleHopIbu(hop, wortGravity, batchVolumeL, settingsHigh);
      expect(high).toBe(low);
    }
  });

  it('exactly doubles every Aroma/Whirlpool contribution', () => {
    for (const hop of [aroma, whirlpool]) {
      const low = calculateSingleHopIbu(hop, wortGravity, batchVolumeL, settingsLow);
      const high = calculateSingleHopIbu(hop, wortGravity, batchVolumeL, settingsHigh);
      expect(low).toBeGreaterThan(0); // sanity: not accidentally hitting a degenerate-input guard
      expect(Math.abs(high - low * 2)).toBeLessThanOrEqual(1e-9);
    }
  });

  it('DryHop stays 0 regardless of hopstandUtilizationFactor', () => {
    expect(calculateSingleHopIbu(dryHop, wortGravity, batchVolumeL, settingsLow)).toBe(0);
    expect(calculateSingleHopIbu(dryHop, wortGravity, batchVolumeL, settingsHigh)).toBe(0);
  });
});

describe('AC-13: calculateSingleHopIbu settings are required (compile-time contract)', () => {
  it('calling with three arguments is a tsc error — no overload, no default value for the 4th parameter', () => {
    // 'DryHop' hits the classifyHopUse === 'none' early return, so this call
    // is also safe at *runtime* — the point of this test is caught entirely
    // by `npm run typecheck`: if calculateSingleHopIbu's 4th parameter ever
    // becomes optional or gains a default again, the line below stops being
    // a type error and this `@ts-expect-error` itself becomes a tsc failure
    // ("Unused '@ts-expect-error' directive").
    const dryHop: HopItem = { id: 'h-tsc', name: 'TSC Hop', amountG: 10, alphaAcidPct: 10, use: 'DryHop', boilMins: 60, whirlpoolMins: 60, whirlpoolTempC: 79.0, type: 'Pellet' };
    // @ts-expect-error AC-13: settings is required — omitting it must fail tsc.
    const result = calculateSingleHopIbu(dryHop, 1.05, 20);
    expect(result).toBe(0);
  });
});
