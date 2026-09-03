import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculateRecipeStats } from '../src/brewingMath';
import { sgToPointsExact } from '../src/units';
import { loadFixtureRecipes } from './fixtures/fixtureAdapter';
import { FERMENTABLE_POTENTIALS_PPG, lookupPotentialPpg } from './fixtures/fermentablePotentials';
import fixtureData from './fixtures/montano_brewing_recipes.json';

// Uniform floating-point safety margin, applied identically to every metric and
// every recipe (never per-recipe): IEEE-754 doubles cannot represent values like
// 1.066 - 1 exactly (it lands at 0.06600000000000006), so a delta that is
// mathematically exactly at a tolerance boundary can appear to overshoot it by
// ~1e-13. This does not change which recipes pass — a delta of 1.51 is still a
// failure, only a delta of 1.0000000000000568 is correctly treated as 1.0.
const FLOAT_EPSILON = 1e-9;

const TOL_POINTS = (expected: number) => Math.max(0.01 * expected, 1.0) + FLOAT_EPSILON;
const TOL_IBU = 1.5 + FLOAT_EPSILON;
const TOL_EBC = (expected: number) => Math.max(1.0, 0.14 * expected) + FLOAT_EPSILON;
const TOL_FG = 4.5 + FLOAT_EPSILON;
const TOL_ABV = 0.8 + FLOAT_EPSILON;
const TOL_BUGU = 0.04 + FLOAT_EPSILON;
const TOL_RBR = 0.08 + FLOAT_EPSILON;

const EXPECTED_NAMES = ['Buho Weissbier', 'Frontino Porter', 'IPL', 'Mapanare IPA', 'Navidad Red Ale', 'Tangara APA'];

describe('AC-16: fixture harness loads all six', () => {
  it('returns exactly 6 entries with the expected names', () => {
    const entries = loadFixtureRecipes();
    expect(entries).toHaveLength(6);
    expect(entries.map((e) => e.expected.name).sort()).toEqual([...EXPECTED_NAMES].sort());
  });
});

describe('AC-17: potential table has no per-recipe keys', () => {
  it('has exactly 16 keys, each present as a fermentable name in the fixture, and throws on unknown', () => {
    const keys = Object.keys(FERMENTABLE_POTENTIALS_PPG);
    expect(keys).toHaveLength(16);

    const namesInFixture = new Set<string>();
    for (const recipe of (fixtureData as { recipes: { fermentables: { name: string }[] }[] }).recipes) {
      for (const f of recipe.fermentables) namesInFixture.add(f.name);
    }
    for (const key of keys) {
      expect(namesInFixture.has(key)).toBe(true);
    }

    expect(() => lookupPotentialPpg('Not A Real Malt')).toThrow();
  });
});

describe('AC-18: derived efficiencies are physically sane', () => {
  it('every recipe derived mashEfficiencyPct is within [60, 85]', () => {
    const entries = loadFixtureRecipes();
    for (const { recipe } of entries) {
      expect(recipe.equipment.mashEfficiencyPct).toBeGreaterThanOrEqual(60);
      expect(recipe.equipment.mashEfficiencyPct).toBeLessThanOrEqual(85);
    }
  });
});

describe('AC-19: fixture OG', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    it(`${expected.name}: OG within tolerance`, () => {
      const stats = calculateRecipeStats(recipe);
      // Fixture's `ogPoints` is sg*1000 (e.g. 1052 for 1.052); gravity points is that minus 1000.
      const actualPoints = sgToPointsExact(stats.og);
      const expectedPoints = expected.ogPoints - 1000;
      const delta = Math.abs(actualPoints - expectedPoints);
      expect(delta).toBeLessThanOrEqual(TOL_POINTS(expectedPoints));
    });
  }
});

describe('AC-20: fixture IBU', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    it(`${expected.name}: IBU within tolerance`, () => {
      const stats = calculateRecipeStats(recipe);
      const delta = Math.abs(stats.ibu - expected.ibu);
      expect(delta).toBeLessThanOrEqual(TOL_IBU);
    });
  }
});

describe('AC-21: fixture colour (EBC)', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    it(`${expected.name}: EBC within tolerance`, () => {
      const stats = calculateRecipeStats(recipe);
      const delta = Math.abs(stats.ebc - expected.colorEBC);
      expect(delta).toBeLessThanOrEqual(TOL_EBC(expected.colorEBC));
    });
  }
});

describe('AC-22: fixture FG', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    it(`${expected.name}: FG within tolerance`, () => {
      const stats = calculateRecipeStats(recipe);
      const actualPoints = sgToPointsExact(stats.fg);
      const expectedPoints = expected.fgPoints - 1000;
      const delta = Math.abs(actualPoints - expectedPoints);
      expect(delta).toBeLessThanOrEqual(TOL_FG);
    });
  }
});

describe('AC-23: fixture ABV', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    it(`${expected.name}: ABV within tolerance`, () => {
      const stats = calculateRecipeStats(recipe);
      const delta = Math.abs(stats.abv - expected.abvPct);
      expect(delta).toBeLessThanOrEqual(TOL_ABV);
    });
  }
});

describe('AC-24: fixture BU:GU', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    it(`${expected.name}: BU:GU within tolerance`, () => {
      const stats = calculateRecipeStats(recipe);
      const delta = Math.abs(stats.buGu - expected.buGu);
      expect(delta).toBeLessThanOrEqual(TOL_BUGU);
    });
  }
});

describe('AC-25: fixture RBR', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    it(`${expected.name}: RBR within tolerance`, () => {
      const stats = calculateRecipeStats(recipe);
      const delta = Math.abs(stats.rbr - expected.rbr);
      expect(delta).toBeLessThanOrEqual(TOL_RBR);
    });
  }
});

describe('AC-26: fixture mash water', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    if (!expected.water) {
      it.skip(`${expected.name}: no water block in fixture — skipped explicitly`, () => {});
      continue;
    }
    it(`${expected.name}: mash water within 1%`, () => {
      const stats = calculateRecipeStats(recipe);
      const relDelta = Math.abs(stats.mashWaterL - expected.water!.mashWaterL) / expected.water!.mashWaterL;
      expect(relDelta).toBeLessThanOrEqual(0.01);
    });
  }
});

describe('AC-27: fixture total water', () => {
  const entries = loadFixtureRecipes();
  for (const { recipe, expected } of entries) {
    if (!expected.water) {
      it.skip(`${expected.name}: no water block in fixture — skipped explicitly`, () => {});
      continue;
    }
    it(`${expected.name}: total water within 3%`, () => {
      const stats = calculateRecipeStats(recipe);
      const relDelta = Math.abs(stats.totalWaterL - expected.water!.totalWaterL) / expected.water!.totalWaterL;
      expect(relDelta).toBeLessThanOrEqual(0.03);
    });
  }
});

// Pinned at the time the fixture was copied from the protected .gsd/documents/
// original (SHA-256, verified by hand: `Get-FileHash ... -Algorithm SHA256`).
// A live cross-tree read of .gsd/ was rejected — .gsd/documents/ is untracked,
// so it isn't present in a genuine `git clone` and would break AC-30's cold-clone
// guarantee. Pinning keeps this package's only dependency the committed copy.
const MONTANO_FIXTURE_SHA256 = 'a44239fb7d8499a4968ed09bcebab8aeab92201d24e5531842ed4077fcd80bc1';

describe('AC-29: fixture copy is byte-identical', () => {
  it('matches the pinned SHA-256 of the protected .gsd fixture', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const copyPath = path.join(here, 'fixtures', 'montano_brewing_recipes.json');

    const hash = createHash('sha256').update(readFileSync(copyPath)).digest('hex');
    expect(hash).toBe(MONTANO_FIXTURE_SHA256);
  });
});
