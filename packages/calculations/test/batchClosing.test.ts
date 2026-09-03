import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, FermentableItem, Recipe } from '@truchabrew/shared-types';
import {
  sortByInstantThenId,
  sortBatchNotes,
  peakFermentationTempC,
  measuredMashEfficiencyPct,
  resolveBeerVolume,
  buildClosingSnapshot,
  mashEfficiency,
  calculateVolumes,
  totalExtractPoints,
  gravityAtVolume,
} from '../src';

// AC-4 and AC-5's tests live here rather than in a dedicated
// chronology.test.ts / an addition to fermentation.test.ts. Neither is named
// in the M5_P2 spec's §1.1 New table: chronology.ts has no matching test
// file listed, and fermentation.test.ts — which gains peakFermentationTempC
// and sortBatchNotes per §1.5's Modified table — is simultaneously on the
// Untouched list (must stay byte-unchanged, the regression proof that
// sortReadings's observable contract did not move). This file is the New
// test file whose subject matter is closest (buildClosingSnapshot consumes
// peakFermentationTempC as an input, and both new orderings back the same
// "batch closing / detail" feature surface this phase adds). Flagged for
// critic attention as a judgment call, not a silent scope decision.

describe('AC-4: sortByInstantThenId is the one comparator', () => {
  interface Item {
    id: string;
    at: string;
  }
  const instantOf = (i: Item) => i.at;

  it('sorts ascending by the extracted instant, ties by id ascending', () => {
    const items: Item[] = [
      { id: 'b', at: '2026-08-02T00:00:00.000Z' },
      { id: 'a', at: '2026-08-01T00:00:00.000Z' },
      { id: 'z', at: '2026-08-01T00:00:00.000Z' }, // tie with 'a'
    ];
    const sorted = sortByInstantThenId(items, instantOf);
    expect(sorted.map((i) => i.id)).toEqual(['a', 'z', 'b']);
  });

  it('returns a NEW array (!== input) and does not mutate the input order', () => {
    const items: Item[] = [
      { id: 'b', at: '2026-08-02T00:00:00.000Z' },
      { id: 'a', at: '2026-08-01T00:00:00.000Z' },
    ];
    const original = [...items];
    const sorted = sortByInstantThenId(items, instantOf);
    expect(sorted).not.toBe(items);
    expect(items).toEqual(original);
  });

  it('sorts an unparseable instant last', () => {
    const items: Item[] = [
      { id: 'a', at: 'not-a-date' },
      { id: 'b', at: '2026-08-01T00:00:00.000Z' },
    ];
    const sorted = sortByInstantThenId(items, instantOf);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('sortBatchNotes exhibits the same three properties over timestamp', () => {
    const notes = [
      { id: 'b', timestamp: '2026-08-02T00:00:00.000Z' },
      { id: 'a', timestamp: '2026-08-01T00:00:00.000Z' },
      { id: 'z', timestamp: 'garbage' },
    ];
    const original = [...notes];
    const sorted = sortBatchNotes(notes);
    expect(sorted).not.toBe(notes);
    expect(notes).toEqual(original);
    expect(sorted.map((n) => n.id)).toEqual(['a', 'b', 'z']);
  });
});

describe('AC-5: peakFermentationTempC degenerate contract', () => {
  it('[] -> null', () => {
    expect(peakFermentationTempC([])).toBeNull();
  });

  it('readings with every tempC === null -> null, never -Infinity', () => {
    const result = peakFermentationTempC([
      { id: '1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.05, tempC: null },
      { id: '2', readingTime: '2026-08-02T00:00:00.000Z', sg: null, tempC: null },
    ]);
    expect(result).toBeNull();
    expect(result).not.toBe(-Infinity);
  });

  it('a non-null result is always finite', () => {
    const result = peakFermentationTempC([{ id: '1', readingTime: '2026-08-01T00:00:00.000Z', sg: null, tempC: 19 }]);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result)).toBe(true);
  });

  it('a mixed set [18.5, null, 21.0, 19.0] -> 21.0', () => {
    const result = peakFermentationTempC([
      { id: '1', readingTime: '2026-08-01T00:00:00.000Z', sg: null, tempC: 18.5 },
      { id: '2', readingTime: '2026-08-02T00:00:00.000Z', sg: null, tempC: null },
      { id: '3', readingTime: '2026-08-03T00:00:00.000Z', sg: null, tempC: 21.0 },
      { id: '4', readingTime: '2026-08-04T00:00:00.000Z', sg: null, tempC: 19.0 },
    ]);
    expect(result).toBe(21.0);
  });

  it('a set of only negative temperatures [-3, -1.5] -> -1.5', () => {
    const result = peakFermentationTempC([
      { id: '1', readingTime: '2026-08-01T00:00:00.000Z', sg: null, tempC: -3 },
      { id: '2', readingTime: '2026-08-02T00:00:00.000Z', sg: null, tempC: -1.5 },
    ]);
    expect(result).toBe(-1.5);
  });

  it('order of the input does not affect the result', () => {
    const forward = peakFermentationTempC([
      { id: '1', readingTime: '2026-08-01T00:00:00.000Z', sg: null, tempC: 18.5 },
      { id: '2', readingTime: '2026-08-02T00:00:00.000Z', sg: null, tempC: 21.0 },
    ]);
    const backward = peakFermentationTempC([
      { id: '2', readingTime: '2026-08-02T00:00:00.000Z', sg: null, tempC: 21.0 },
      { id: '1', readingTime: '2026-08-01T00:00:00.000Z', sg: null, tempC: 18.5 },
    ]);
    expect(forward).toBe(backward);
  });
});

// ---------------------------------------------------------------------------
// Fixtures for AC-10..AC-15
// ---------------------------------------------------------------------------

function testEquipment(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
    id: 'eq-1',
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

function testFermentables(): FermentableItem[] {
  return [{ id: 'f-1', name: 'Pale Ale Malt (2-Row)', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.038 }];
}

function testRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r-1',
    name: 'Test Recipe',
    author: '',
    styleName: '',
    equipment: testEquipment(),
    fermentables: testFermentables(),
    hops: [],
    yeasts: [],
    miscs: [],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
    ...overrides,
  };
}

describe('AC-10: measuredMashEfficiencyPct preserves the extracted behaviour exactly', () => {
  it('strictly === the reference composition transcribed from the pre-phase BatchDetail.tsx:97-114', () => {
    const recipe = testRecipe();
    const measuredPreBoilGravity = 1.05;
    const { equipment, fermentables } = recipe;

    const reference = mashEfficiency(
      (measuredPreBoilGravity - 1) * 1000,
      ((gravityAtVolume(totalExtractPoints(fermentables), equipment.mashEfficiencyPct, calculateVolumes(equipment).preBoilVolumeL) - 1) *
        1000) /
        (equipment.mashEfficiencyPct / 100),
    );

    expect(measuredMashEfficiencyPct(recipe, measuredPreBoilGravity)).toBe(reference);
  });
});

describe('AC-11: measuredMashEfficiencyPct null contracts, both directions, no NaN', () => {
  it('measuredPreBoilGravity === null -> null', () => {
    expect(measuredMashEfficiencyPct(testRecipe(), null)).toBeNull();
  });

  it('equipment.mashEfficiencyPct === 0 -> null, not NaN', () => {
    const recipe = testRecipe({ equipment: testEquipment({ mashEfficiencyPct: 0 }) });
    const result = measuredMashEfficiencyPct(recipe, 1.05);
    expect(result).toBeNull();
  });

  it('equipment.mashEfficiencyPct === -5 -> null', () => {
    const recipe = testRecipe({ equipment: testEquipment({ mashEfficiencyPct: -5 }) });
    expect(measuredMashEfficiencyPct(recipe, 1.05)).toBeNull();
  });

  it('a valid pair -> a finite number', () => {
    const result = measuredMashEfficiencyPct(testRecipe(), 1.05);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result)).toBe(true);
  });

  it('a higher measuredPreBoilGravity yields a strictly higher efficiency at fixed recipe', () => {
    const recipe = testRecipe();
    const low = measuredMashEfficiencyPct(recipe, 1.04)!;
    const high = measuredMashEfficiencyPct(recipe, 1.06)!;
    expect(high).toBeGreaterThan(low);
  });
});

describe('AC-12: resolveBeerVolume precedence is !== null, not falsy', () => {
  it('(19.0, 20.0) -> { beerVolumeL: 19.0, beerVolumeSource: "measured" }', () => {
    expect(resolveBeerVolume(19.0, 20.0)).toEqual({ beerVolumeL: 19.0, beerVolumeSource: 'measured' });
  });

  it('(null, 20.0) -> { beerVolumeL: 20.0, beerVolumeSource: "recipe" }', () => {
    expect(resolveBeerVolume(null, 20.0)).toEqual({ beerVolumeL: 20.0, beerVolumeSource: 'recipe' });
  });

  it('(0, 20.0) -> { beerVolumeL: 0, beerVolumeSource: "measured" } — a stored 0 is a present value', () => {
    expect(resolveBeerVolume(0, 20.0)).toEqual({ beerVolumeL: 0, beerVolumeSource: 'measured' });
  });
});

describe('AC-13: buildClosingSnapshot happy path, sugar family, pinned numerically', () => {
  const recipe = testRecipe();
  const snapshot = buildClosingSnapshot({
    frozenAt: '2026-08-20T10:00:00.000Z',
    measuredOg: 1.056,
    measuredFg: 1.012,
    measuredPreBoilGravity: null,
    measuredBottlingSizeL: 19,
    recipeSnapshot: recipe,
    peakFermentationTempC: 20,
    carbonationType: 'Sugar',
    carbonationVolumesTarget: 2.4,
    carbonationTempC: null,
  });

  it('frozenAt is echoed verbatim', () => {
    expect(snapshot.frozenAt).toBe('2026-08-20T10:00:00.000Z');
  });

  it('originalGravity === 1.056; finalGravity === 1.012', () => {
    expect(snapshot.originalGravity).toBe(1.056);
    expect(snapshot.finalGravity).toBe(1.012);
  });

  it('apparentAttenuationPct equals 78.57142857142857 within 1e-9', () => {
    expect(Math.abs(snapshot.apparentAttenuationPct - 78.57142857142857)).toBeLessThan(1e-9);
  });

  it('abv equals 5.93409231 within 1e-6', () => {
    expect(Math.abs(snapshot.abv - 5.93409231)).toBeLessThan(1e-6);
  });

  it('mashEfficiencyPct === null (no measuredPreBoilGravity)', () => {
    expect(snapshot.mashEfficiencyPct).toBeNull();
  });

  it('peakFermentationTempC === 20', () => {
    expect(snapshot.peakFermentationTempC).toBe(20);
  });

  it('beerVolumeL === 19 with beerVolumeSource === "measured"', () => {
    expect(snapshot.beerVolumeL).toBe(19);
    expect(snapshot.beerVolumeSource).toBe('measured');
  });

  it('primingSugarG equals 19.54872 within 1e-9', () => {
    expect(Math.abs(snapshot.primingSugarG! - 19.54872)).toBeLessThan(1e-9);
  });

  it('primingSugarEquivGPerL equals 1.02888 within 1e-9 and equals primingSugarG / beerVolumeL exactly', () => {
    expect(Math.abs(snapshot.primingSugarEquivGPerL! - 1.02888)).toBeLessThan(1e-9);
    expect(snapshot.primingSugarEquivGPerL).toBe(snapshot.primingSugarG! / snapshot.beerVolumeL);
  });

  it('carbonationForcePsi === null', () => {
    expect(snapshot.carbonationForcePsi).toBeNull();
  });

  it('a sweep over every numeric field finds no NaN and no Infinity', () => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value === 'number') {
        expect(Number.isNaN(value), `${key} is NaN`).toBe(false);
        expect(Number.isFinite(value), `${key} is not finite`).toBe(true);
      }
    }
  });
});

describe('AC-14: buildClosingSnapshot carbonation-family gating, both directions', () => {
  const recipe = testRecipe();
  const base = {
    frozenAt: '2026-08-20T10:00:00.000Z',
    measuredOg: 1.056,
    measuredFg: 1.012,
    measuredPreBoilGravity: null,
    measuredBottlingSizeL: 19,
    recipeSnapshot: recipe,
    peakFermentationTempC: 20,
  } as const;

  it('KegForce with target 2.4 / temp 4 -> carbonationForcePsi equals 10.7917568608 within 1e-6, both priming fields null', () => {
    const snapshot = buildClosingSnapshot({
      ...base,
      carbonationType: 'KegForce',
      carbonationVolumesTarget: 2.4,
      carbonationTempC: 4,
    });
    expect(Math.abs(snapshot.carbonationForcePsi! - 10.7917568608)).toBeLessThan(1e-6);
    expect(snapshot.primingSugarG).toBeNull();
    expect(snapshot.primingSugarEquivGPerL).toBeNull();
  });

  it('KegForceQuick with the same inputs returns the identical PSI', () => {
    const kegForce = buildClosingSnapshot({
      ...base,
      carbonationType: 'KegForce',
      carbonationVolumesTarget: 2.4,
      carbonationTempC: 4,
    });
    const kegForceQuick = buildClosingSnapshot({
      ...base,
      carbonationType: 'KegForceQuick',
      carbonationVolumesTarget: 2.4,
      carbonationTempC: 4,
    });
    expect(kegForceQuick.carbonationForcePsi).toBe(kegForce.carbonationForcePsi);
  });

  it('KegSugar behaves exactly as Sugar (priming non-null, PSI null)', () => {
    const sugar = buildClosingSnapshot({ ...base, carbonationType: 'Sugar', carbonationVolumesTarget: 2.4, carbonationTempC: null });
    const kegSugar = buildClosingSnapshot({ ...base, carbonationType: 'KegSugar', carbonationVolumesTarget: 2.4, carbonationTempC: null });
    expect(kegSugar.primingSugarG).toBe(sugar.primingSugarG);
    expect(kegSugar.primingSugarEquivGPerL).toBe(sugar.primingSugarEquivGPerL);
    expect(kegSugar.carbonationForcePsi).toBeNull();
    expect(sugar.carbonationForcePsi).toBeNull();
  });

  it('carbonationType: null -> all three figures null', () => {
    const snapshot = buildClosingSnapshot({ ...base, carbonationType: null, carbonationVolumesTarget: 2.4, carbonationTempC: 4 });
    expect(snapshot.primingSugarG).toBeNull();
    expect(snapshot.primingSugarEquivGPerL).toBeNull();
    expect(snapshot.carbonationForcePsi).toBeNull();
  });

  it('Sugar with carbonationVolumesTarget: null -> both priming fields null', () => {
    const snapshot = buildClosingSnapshot({ ...base, carbonationType: 'Sugar', carbonationVolumesTarget: null, carbonationTempC: null });
    expect(snapshot.primingSugarG).toBeNull();
    expect(snapshot.primingSugarEquivGPerL).toBeNull();
  });

  it('KegForce with carbonationTempC: null -> PSI null', () => {
    const snapshot = buildClosingSnapshot({ ...base, carbonationType: 'KegForce', carbonationVolumesTarget: 2.4, carbonationTempC: null });
    expect(snapshot.carbonationForcePsi).toBeNull();
  });

  it('in every case the two priming fields are both null or both non-null — an invariant across all cases', () => {
    const cases: Array<{ carbonationType: Parameters<typeof buildClosingSnapshot>[0]['carbonationType']; carbonationVolumesTarget: number | null; carbonationTempC: number | null }> = [
      { carbonationType: 'KegForce', carbonationVolumesTarget: 2.4, carbonationTempC: 4 },
      { carbonationType: 'KegForceQuick', carbonationVolumesTarget: 2.4, carbonationTempC: 4 },
      { carbonationType: 'KegSugar', carbonationVolumesTarget: 2.4, carbonationTempC: null },
      { carbonationType: null, carbonationVolumesTarget: 2.4, carbonationTempC: 4 },
      { carbonationType: 'Sugar', carbonationVolumesTarget: null, carbonationTempC: null },
      { carbonationType: 'KegForce', carbonationVolumesTarget: 2.4, carbonationTempC: null },
    ];
    for (const c of cases) {
      const snapshot = buildClosingSnapshot({ ...base, ...c });
      const gBoth = snapshot.primingSugarG === null && snapshot.primingSugarEquivGPerL === null;
      const nBoth = snapshot.primingSugarG !== null && snapshot.primingSugarEquivGPerL !== null;
      expect(gBoth || nBoth).toBe(true);
    }
  });
});

describe('AC-15: buildClosingSnapshot degenerate inputs never fabricate', () => {
  const recipe = testRecipe();

  it('peakFermentationTempC: null with Sugar and a target set -> both priming fields null (no default temperature)', () => {
    const snapshot = buildClosingSnapshot({
      frozenAt: '2026-08-20T10:00:00.000Z',
      measuredOg: 1.056,
      measuredFg: 1.012,
      measuredPreBoilGravity: null,
      measuredBottlingSizeL: 19,
      recipeSnapshot: recipe,
      peakFermentationTempC: null,
      carbonationType: 'Sugar',
      carbonationVolumesTarget: 2.4,
      carbonationTempC: null,
    });
    expect(snapshot.primingSugarG).toBeNull();
    expect(snapshot.primingSugarEquivGPerL).toBeNull();
  });

  it('measuredBottlingSizeL: 0 and recipe batchSizeL: 0 -> beerVolumeL === 0 and both priming fields null, no NaN anywhere', () => {
    const zeroVolRecipe = testRecipe({ equipment: testEquipment({ batchSizeL: 0 }) });
    const snapshot = buildClosingSnapshot({
      frozenAt: '2026-08-20T10:00:00.000Z',
      measuredOg: 1.056,
      measuredFg: 1.012,
      measuredPreBoilGravity: null,
      measuredBottlingSizeL: 0,
      recipeSnapshot: zeroVolRecipe,
      peakFermentationTempC: 20,
      carbonationType: 'Sugar',
      carbonationVolumesTarget: 2.4,
      carbonationTempC: null,
    });
    expect(snapshot.beerVolumeL).toBe(0);
    expect(snapshot.primingSugarG).toBeNull();
    expect(snapshot.primingSugarEquivGPerL).toBeNull();
    for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value === 'number') {
        expect(Number.isNaN(value), `${key} is NaN`).toBe(false);
      }
    }
  });

  it('measuredFg above measuredOg (og 1.052, fg 1.060) -> apparentAttenuationPct is negative, not clamped to 0', () => {
    const snapshot = buildClosingSnapshot({
      frozenAt: '2026-08-20T10:00:00.000Z',
      measuredOg: 1.052,
      measuredFg: 1.06,
      measuredPreBoilGravity: null,
      measuredBottlingSizeL: 19,
      recipeSnapshot: recipe,
      peakFermentationTempC: 20,
      carbonationType: null,
      carbonationVolumesTarget: null,
      carbonationTempC: null,
    });
    expect(snapshot.apparentAttenuationPct).toBeLessThan(0);
    expect(Math.abs(snapshot.apparentAttenuationPct - -15.384615384615385)).toBeLessThan(1e-6);
  });
});
