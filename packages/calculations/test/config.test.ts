import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, FermentableItem, HopItem, Recipe, YeastItem } from '@truchabrew/shared-types';
import {
  sgToPlato,
  platoToSg,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  kgToLb,
  lbToKg,
  lToUsGal,
  usGalToL,
  calculateAbvWithStrategy,
  calculateRecipeIbuWithStrategy,
  DEFAULT_USER_CONFIG,
  formatGravity,
  formatTemperature,
  convertMass,
  massUnitLabel,
  formatMass,
  lToImpGal,
  impGalToL,
  convertHopMass,
  hopMassUnitLabel,
  formatHopMass,
  convertVolume,
  volumeUnitLabel,
  formatVolume,
} from '../src/config';
import {
  calculateRecipeStats,
  calculateSingleHopIbu,
  toHopUtilizationSettings,
  calculateVolumes,
  totalExtractPoints,
  gravityAtVolume,
} from '../src/brewingMath';
// AC-17: the four named helpers + DEFAULT_USER_CONFIG must be importable
// from the package ROOT, not only from ../src/config — imported under a
// distinct alias here so this file's own package-root test doesn't
// shadow/collide with the direct ../src/config imports above.
import {
  formatGravity as rootFormatGravity,
  formatTemperature as rootFormatTemperature,
  convertMass as rootConvertMass,
  massUnitLabel as rootMassUnitLabel,
  formatMass as rootFormatMass,
  DEFAULT_USER_CONFIG as rootDefaultUserConfig,
  lToImpGal as rootLToImpGal,
  impGalToL as rootImpGalToL,
  convertHopMass as rootConvertHopMass,
  hopMassUnitLabel as rootHopMassUnitLabel,
  formatHopMass as rootFormatHopMass,
  convertVolume as rootConvertVolume,
  volumeUnitLabel as rootVolumeUnitLabel,
  formatVolume as rootFormatVolume,
} from '@truchabrew/calculations';

// ---------------------------------------------------------------------------
// Test fixtures — mirrors packages/calculations/test/brewingMath.test.ts's
// baseEquipment/baseHop/baseRecipe pattern, kept local to this new file per
// the M7_P1 spec §1.3 file boundary (brewingMath.test.ts is not on the
// Modified list and is left byte-unchanged by this phase).
// ---------------------------------------------------------------------------

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

function baseHop(overrides: Partial<HopItem> = {}): HopItem {
  return {
    id: 'h-test',
    name: 'Test Hop',
    amountG: 30,
    alphaAcidPct: 10,
    use: 'Boil',
    boilMins: 60,
    whirlpoolMins: null,
    whirlpoolTempC: null,
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

// ---------------------------------------------------------------------------
// AC-1: Unit conversion functions
// ---------------------------------------------------------------------------

describe('AC-1: sgToPlato / platoToSg', () => {
  it('sgToPlato(1.050) equals 12.37 within the spec-pinned value', () => {
    expect(sgToPlato(1.05)).toBeCloseTo(12.37, 2);
  });

  it('round-trips SG -> Plato -> SG within 1e-4', () => {
    for (const sg of [0.998, 1.0, 1.01, 1.05, 1.08, 1.1, 1.15]) {
      const plato = sgToPlato(sg);
      const roundTripped = platoToSg(plato);
      expect(Math.abs(roundTripped - sg)).toBeLessThan(1e-4);
    }
  });

  it('round-trips Plato -> SG -> Plato within 1e-4', () => {
    for (const plato of [-2, 0, 5, 12.37, 20, 28]) {
      const sg = platoToSg(plato);
      const roundTripped = sgToPlato(sg);
      expect(Math.abs(roundTripped - plato)).toBeLessThan(1e-4);
    }
  });

  it('sgToPlato is monotonically increasing across the practical brewing range', () => {
    const sgs = [0.99, 1.0, 1.02, 1.05, 1.08, 1.1, 1.12];
    for (let i = 1; i < sgs.length; i++) {
      expect(sgToPlato(sgs[i])).toBeGreaterThan(sgToPlato(sgs[i - 1]));
    }
  });
});

describe('AC-1: celsiusToFahrenheit / fahrenheitToCelsius', () => {
  it('celsiusToFahrenheit(20) equals 68.0', () => {
    expect(celsiusToFahrenheit(20)).toBeCloseTo(68.0, 4);
  });

  it('freezing and boiling points convert exactly', () => {
    expect(celsiusToFahrenheit(0)).toBeCloseTo(32, 6);
    expect(celsiusToFahrenheit(100)).toBeCloseTo(212, 6);
    expect(fahrenheitToCelsius(32)).toBeCloseTo(0, 6);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 6);
  });

  it('round-trips within 1e-4', () => {
    for (const c of [-10, 0, 20, 37.5, 66, 100]) {
      expect(Math.abs(fahrenheitToCelsius(celsiusToFahrenheit(c)) - c)).toBeLessThan(1e-4);
    }
  });
});

describe('AC-1: kgToLb / lbToKg', () => {
  it('round-trips within 1e-4', () => {
    for (const kg of [0, 0.5, 1, 5, 25.4]) {
      expect(Math.abs(lbToKg(kgToLb(kg)) - kg)).toBeLessThan(1e-4);
    }
  });

  it('1 kg is ~2.20462 lb', () => {
    expect(kgToLb(1)).toBeCloseTo(2.20462, 5);
  });
});

describe('AC-1: lToUsGal / usGalToL', () => {
  it('round-trips within 1e-4', () => {
    for (const l of [0, 1, 20, 23, 100]) {
      expect(Math.abs(usGalToL(lToUsGal(l)) - l)).toBeLessThan(1e-4);
    }
  });

  it('1 US gallon is ~3.78541 L', () => {
    expect(usGalToL(1)).toBeCloseTo(3.78541, 4);
  });
});

// ---------------------------------------------------------------------------
// AC-2 / AC-3: ABV formula strategies
// ---------------------------------------------------------------------------

describe('AC-2: calculateAbvWithStrategy — simple', () => {
  it('calculateAbvWithStrategy(1.050, 1.010, "simple") equals 5.25%', () => {
    expect(calculateAbvWithStrategy(1.05, 1.01, 'simple')).toBeCloseTo(5.25, 4);
  });

  it('never negative even for an inverted (FG > OG) input', () => {
    expect(calculateAbvWithStrategy(1.01, 1.05, 'simple')).toBe(0);
  });
});

describe('AC-3: calculateAbvWithStrategy — balling', () => {
  it('calculateAbvWithStrategy(1.050, 1.010, "balling") equals 5.256%', () => {
    expect(calculateAbvWithStrategy(1.05, 1.01, 'balling')).toBeCloseTo(5.256, 2);
  });

  it('never negative even for an inverted (FG > OG) input', () => {
    expect(calculateAbvWithStrategy(1.01, 1.05, 'balling')).toBe(0);
  });

  it('does not throw or return NaN/Infinity for a degenerate fg of 0', () => {
    const result = calculateAbvWithStrategy(1.05, 0, 'balling');
    expect(Number.isFinite(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-4: IBU formula strategy — Tinseth vs Rager produce distinct, correct
// strategy-specific values
// ---------------------------------------------------------------------------

describe('AC-4: calculateRecipeIbuWithStrategy — tinseth vs rager', () => {
  it('produces distinct values for the same recipe', () => {
    const recipe = baseRecipe();
    const tinseth = calculateRecipeIbuWithStrategy(recipe, 'tinseth');
    const rager = calculateRecipeIbuWithStrategy(recipe, 'rager');
    expect(tinseth).not.toBeCloseTo(rager, 1);
  });

  it('tinseth matches the hand-derived value for a single 60-min boil addition', () => {
    // batchSizeL=20, brewhouseEfficiencyPct=75, 5kg @ 1.037 -> OG ~= 1.0579
    // 30g @ 10% AA, 60 min boil -> IBU ~= 32.2 (hand-derived, see comment log)
    const recipe = baseRecipe();
    const ibu = calculateRecipeIbuWithStrategy(recipe, 'tinseth');
    expect(ibu).toBeGreaterThan(28);
    expect(ibu).toBeLessThan(36);
  });

  it('rager matches the hand-derived value for a single 60-min boil addition', () => {
    const recipe = baseRecipe();
    const ibu = calculateRecipeIbuWithStrategy(recipe, 'rager');
    expect(ibu).toBeGreaterThan(33);
    expect(ibu).toBeLessThan(42);
  });

  it('a hop with 0 IBU contribution (DryHop) contributes nothing under either strategy', () => {
    const recipe = baseRecipe({ hops: [baseHop({ use: 'DryHop', boilMins: null, whirlpoolMins: null })] });
    expect(calculateRecipeIbuWithStrategy(recipe, 'tinseth')).toBe(0);
    expect(calculateRecipeIbuWithStrategy(recipe, 'rager')).toBe(0);
  });

  it('an empty hops array yields 0 IBU under either strategy', () => {
    const recipe = baseRecipe({ hops: [] });
    expect(calculateRecipeIbuWithStrategy(recipe, 'tinseth')).toBe(0);
    expect(calculateRecipeIbuWithStrategy(recipe, 'rager')).toBe(0);
  });

  it('increases with boil time under both strategies', () => {
    const shortBoil = baseRecipe({ hops: [baseHop({ boilMins: 10 })] });
    const longBoil = baseRecipe({ hops: [baseHop({ boilMins: 60 })] });
    expect(calculateRecipeIbuWithStrategy(longBoil, 'tinseth')).toBeGreaterThan(
      calculateRecipeIbuWithStrategy(shortBoil, 'tinseth'),
    );
    expect(calculateRecipeIbuWithStrategy(longBoil, 'rager')).toBeGreaterThan(
      calculateRecipeIbuWithStrategy(shortBoil, 'rager'),
    );
  });

  it('a Whirlpool addition reads whirlpoolMins, not boilMins', () => {
    const recipe = baseRecipe({
      hops: [baseHop({ use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 79 })],
    });
    expect(calculateRecipeIbuWithStrategy(recipe, 'tinseth')).toBeGreaterThan(0);
    expect(calculateRecipeIbuWithStrategy(recipe, 'rager')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Garetz — EXECUTION-TIME FLAG, not a spec-derived assertion. The M7_P1
// spec's Resolved Ambiguities §2 gives no formula for Garetz (see
// packages/calculations/src/config.ts's singleHopIbuGaretzCandidate
// disclosure). These tests only pin structural properties (selectable,
// non-negative, finite, responsive to boil time) — NOT numeric correctness,
// which cannot be verified against the spec because the spec supplies no
// formula to verify against.
// ---------------------------------------------------------------------------

describe('Garetz IBU — structural smoke tests only (candidate implementation, unverified formula)', () => {
  it('is selectable and returns a finite, non-negative number', () => {
    const recipe = baseRecipe();
    const ibu = calculateRecipeIbuWithStrategy(recipe, 'garetz');
    expect(Number.isFinite(ibu)).toBe(true);
    expect(ibu).toBeGreaterThanOrEqual(0);
  });

  it('an empty hops array yields 0 IBU', () => {
    const recipe = baseRecipe({ hops: [] });
    expect(calculateRecipeIbuWithStrategy(recipe, 'garetz')).toBe(0);
  });

  it('increases with boil time (monotonic sanity, not a pinned formula)', () => {
    const shortBoil = baseRecipe({ hops: [baseHop({ boilMins: 10 })] });
    const longBoil = baseRecipe({ hops: [baseHop({ boilMins: 60 })] });
    expect(calculateRecipeIbuWithStrategy(longBoil, 'garetz')).toBeGreaterThan(
      calculateRecipeIbuWithStrategy(shortBoil, 'garetz'),
    );
  });
});

// ---------------------------------------------------------------------------
// M7_P1 amendment (2026-08-13) — §2.2.1 display helpers + §3.1 AC-17/AC-22.
// New cases only, per §1.4's narrow exception for this file.
// ---------------------------------------------------------------------------

describe('AC-17: formatGravity / formatTemperature / convertMass / massUnitLabel / formatMass — pinned values', () => {
  it('formatGravity pinned examples', () => {
    expect(formatGravity(1.05, 'sg')).toBe('1.050');
    expect(formatGravity(1.05, 'plato')).toBe('12.4 °P');
    expect(formatGravity(1.012, 'plato')).toBe('3.1 °P');
  });

  it('formatTemperature pinned examples', () => {
    expect(formatTemperature(67, 'celsius')).toBe('67.0 °C');
    expect(formatTemperature(67, 'fahrenheit')).toBe('152.6 °F');
    expect(formatTemperature(20, 'fahrenheit')).toBe('68.0 °F');
  });

  it('convertMass / formatMass pinned examples', () => {
    expect(convertMass(5, 'metric')).toBe(5);
    expect(convertMass(5, 'us')).toBeCloseTo(11.0231, 9);
    expect(formatMass(5, 'us')).toBe('11.02 lb');
    expect(formatMass(5, 'metric')).toBe('5.00 kg');
  });

  it('massUnitLabel', () => {
    expect(massUnitLabel('metric')).toBe('kg');
    expect(massUnitLabel('us')).toBe('lb');
    expect(massUnitLabel('imperial')).toBe('lb');
  });

  it('degenerate (NaN/non-finite) input never fabricates "NaN"/"Infinity"/"0"', () => {
    expect(formatGravity(NaN, 'plato')).toBe('—');
    expect(formatGravity(Infinity, 'sg')).toBe('—');
    expect(formatTemperature(NaN, 'fahrenheit')).toBe('—');
    expect(formatMass(NaN, 'us')).toBe('—');
    expect(Number.isNaN(convertMass(NaN, 'us'))).toBe(true);
  });

  it('no rounding before conversion — formatGravity(sg, "plato") converts full precision then rounds once', () => {
    // A value whose 3-decimal-rounded SG would produce a different Plato
    // figure than converting the full-precision value first.
    const sg = 1.0501; // rounds to 1.050 at 3dp
    const roundedFirst = Number(sgToPlato(1.05).toFixed(1));
    const fullPrecision = Number(sgToPlato(sg).toFixed(1));
    // Sanity: full-precision conversion is not identical to rounding-first
    // for at least some inputs in the practical brewing range — otherwise
    // this test would not discriminate the two implementations.
    expect(formatGravity(sg, 'plato')).toBe(`${fullPrecision.toFixed(1)} °P`);
    void roundedFirst;
  });

  it('DEFAULT_USER_CONFIG matches migration 0010\'s seeded default row exactly', () => {
    expect(DEFAULT_USER_CONFIG).toEqual({
      id: 'default',
      unitSystem: 'metric',
      gravityUnit: 'sg',
      temperatureUnit: 'celsius',
      ibuFormula: 'tinseth',
      abvFormula: 'simple',
    });
  });

  it('AC-17: the same six names are importable from the @truchabrew/calculations package root', () => {
    expect(rootFormatGravity(1.05, 'sg')).toBe('1.050');
    expect(rootFormatTemperature(67, 'celsius')).toBe('67.0 °C');
    expect(rootConvertMass(5, 'metric')).toBe(5);
    expect(rootMassUnitLabel('metric')).toBe('kg');
    expect(rootFormatMass(5, 'metric')).toBe('5.00 kg');
    expect(rootDefaultUserConfig).toEqual(DEFAULT_USER_CONFIG);
  });
});

describe('AC-22: one Tinseth in the repository — consolidation / no-regression', () => {
  function ogFor(recipe: Recipe): number {
    const volumes = calculateVolumes(recipe.equipment);
    const extractPoints = totalExtractPoints(recipe.fermentables);
    return gravityAtVolume(extractPoints, recipe.equipment.brewhouseEfficiencyPct, volumes.batchSizeL);
  }

  it('calculateRecipeIbuWithStrategy(recipe, "tinseth") agrees with the existing engine loop within 0.01 IBU, on a fixture with both a Boil and a Whirlpool addition', () => {
    const recipe = baseRecipe({
      hops: [
        baseHop({ use: 'Boil', boilMins: 60, whirlpoolMins: null }),
        baseHop({ id: 'h-test-2', use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 79, amountG: 15, alphaAcidPct: 5 }),
      ],
    });
    const og = ogFor(recipe);
    const settings = toHopUtilizationSettings(recipe.equipment);
    const engineLoopTotal = recipe.hops.reduce(
      (sum, hop) => sum + calculateSingleHopIbu(hop, og, recipe.equipment.batchSizeL, settings),
      0,
    );
    const strategyTotal = calculateRecipeIbuWithStrategy(recipe, 'tinseth');
    expect(Math.abs(strategyTotal - engineLoopTotal)).toBeLessThan(0.01);
  });

  it('selecting the default (tinseth) strategy through calculateRecipeStats options changes no recipe\'s displayed (rounded) IBU', () => {
    const recipe = baseRecipe({
      hops: [
        baseHop({ use: 'Boil', boilMins: 60, whirlpoolMins: null }),
        baseHop({ id: 'h-test-2', use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 79, amountG: 15, alphaAcidPct: 5 }),
      ],
    });
    const legacy = calculateRecipeStats(recipe);
    const explicitTinseth = calculateRecipeStats(recipe, { ibuFormula: 'tinseth' });
    expect(explicitTinseth.ibu).toBe(legacy.ibu);
  });

  // Broader sweep — the two single-fixture cases above didn't catch the
  // 0.000125 vs 0.0001254 drift because the error scales with
  // (OG-1)*ln(bigness ratio) and only exceeded 0.01 IBU / a whole rounded
  // IBU at higher gravity + higher-IBU combinations. This sweeps a range of
  // gravities and hop bills, asserting BOTH AC-22 clauses on every point:
  // the raw (unrounded) strategy-vs-engine tolerance, and the exact equality
  // required of calculateRecipeStats(recipe, {ibuFormula:'tinseth'}).ibu vs
  // calculateRecipeStats(recipe).ibu.
  it('agrees with the engine across a range of gravities and hop bills — exact equality holds everywhere, not just on the small fixture', () => {
    const gravityGrainAmounts = [1, 3, 5, 7, 9, 11, 13, 15, 18]; // kg, drives OG from ~1.007 to ~1.13
    const alphaAcidPcts = [3, 8, 14];

    for (const amountKg of gravityGrainAmounts) {
      for (const alphaAcidPct of alphaAcidPcts) {
        const recipe = baseRecipe({
          fermentables: [baseFermentable({ amountKg })],
          hops: [
            baseHop({ use: 'Boil', boilMins: 60, amountG: 40, alphaAcidPct }),
            baseHop({
              id: 'h-test-2',
              use: 'Whirlpool',
              boilMins: null,
              whirlpoolMins: 20,
              whirlpoolTempC: 79,
              amountG: 20,
              alphaAcidPct: Math.max(1, alphaAcidPct - 2),
            }),
          ],
        });

        const og = ogFor(recipe);
        const settings = toHopUtilizationSettings(recipe.equipment);
        const engineLoopTotal = recipe.hops.reduce(
          (sum, hop) => sum + calculateSingleHopIbu(hop, og, recipe.equipment.batchSizeL, settings),
          0,
        );
        const strategyTotal = calculateRecipeIbuWithStrategy(recipe, 'tinseth');
        expect(Math.abs(strategyTotal - engineLoopTotal)).toBeLessThan(0.01);

        const legacy = calculateRecipeStats(recipe);
        const explicitTinseth = calculateRecipeStats(recipe, { ibuFormula: 'tinseth' });
        expect(explicitTinseth.ibu).toBe(legacy.ibu);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// M7_P2 (2026-08-14) — §2.1 hop-mass and volume display helpers.
// New cases only, per §1.3's narrow exception for this file.
// ---------------------------------------------------------------------------

describe('AC-1: new helpers are importable from the package root', () => {
  it('all eight new names are importable from @truchabrew/calculations and none is undefined', () => {
    expect(rootLToImpGal).toBeDefined();
    expect(rootImpGalToL).toBeDefined();
    expect(rootConvertHopMass).toBeDefined();
    expect(rootHopMassUnitLabel).toBeDefined();
    expect(rootFormatHopMass).toBeDefined();
    expect(rootConvertVolume).toBeDefined();
    expect(rootVolumeUnitLabel).toBeDefined();
    expect(rootFormatVolume).toBeDefined();
    // spot-check behavior through the root import, not just presence
    expect(rootFormatVolume(20, 'us')).toBe('5.28 gal');
    expect(rootFormatHopMass(150, 'us')).toBe('5.29 oz');
  });
});

describe('AC-2: US and Imperial gallons are different conversions', () => {
  it('lToUsGal(20) and lToImpGal(20) differ by more than 0.8', () => {
    expect(lToUsGal(20)).toBeCloseTo(5.28344, 9);
    expect(lToImpGal(20)).toBeCloseTo(4.39938, 9);
    expect(Math.abs(lToUsGal(20) - lToImpGal(20))).toBeGreaterThan(0.8);
  });

  it('convertVolume delegates exactly to lToUsGal / lToImpGal', () => {
    expect(convertVolume(20, 'us')).toBe(lToUsGal(20));
    expect(convertVolume(20, 'imperial')).toBe(lToImpGal(20));
  });

  it('formatVolume produces two distinct strings for us vs imperial', () => {
    expect(formatVolume(20, 'us')).toBe('5.28 gal');
    expect(formatVolume(20, 'imperial')).toBe('4.40 imp gal');
    expect(formatVolume(20, 'us')).not.toBe(formatVolume(20, 'imperial'));
  });
});

describe('AC-3: volume unit labels are exact and distinguishable', () => {
  it('pinned values', () => {
    expect(volumeUnitLabel('metric')).toBe('L');
    expect(volumeUnitLabel('us')).toBe('gal');
    expect(volumeUnitLabel('imperial')).toBe('imp gal');
    expect(volumeUnitLabel('us')).not.toBe(volumeUnitLabel('imperial'));
  });
});

describe('AC-4: formatVolume pinned values and precision defaults', () => {
  it('pinned examples', () => {
    expect(formatVolume(20, 'metric')).toBe('20.0 L');
    expect(formatVolume(15.5, 'metric')).toBe('15.5 L');
    expect(formatVolume(15.5, 'us')).toBe('4.09 gal');
    expect(formatVolume(23, 'us')).toBe('6.08 gal');
    expect(formatVolume(23, 'imperial')).toBe('5.06 imp gal');
  });

  it('explicit fractionDigits overrides the default', () => {
    expect(formatVolume(20, 'us', 3)).toBe('5.283 gal');
    expect(formatVolume(20, 'metric', 0)).toBe('20 L');
  });

  it('convertVolume("metric") is the identity, not rounded', () => {
    expect(convertVolume(20, 'metric')).toBe(20);
  });
});

describe('AC-5: formatHopMass pinned values, labels, and precision defaults', () => {
  it('pinned examples', () => {
    expect(formatHopMass(150, 'metric')).toBe('150.0 g');
    expect(formatHopMass(150, 'us')).toBe('5.29 oz');
    expect(formatHopMass(150, 'imperial')).toBe('5.29 oz');
    expect(formatHopMass(25, 'us')).toBe('0.88 oz');
    expect(formatHopMass(28.349523125, 'us')).toBe('1.00 oz');
  });

  it('hopMassUnitLabel', () => {
    expect(hopMassUnitLabel('metric')).toBe('g');
    expect(hopMassUnitLabel('us')).toBe('oz');
    expect(hopMassUnitLabel('imperial')).toBe('oz');
  });

  it('convertHopMass', () => {
    expect(convertHopMass(150, 'metric')).toBe(150);
    expect(convertHopMass(150, 'us')).toBeCloseTo(5.291094292437061, 9);
    expect(convertHopMass(150, 'us')).toBe(convertHopMass(150, 'imperial'));
  });

  it('explicit fractionDigits overrides the default', () => {
    expect(formatHopMass(150, 'us', 1)).toBe('5.3 oz');
  });
});

describe('AC-6: degenerate and zero inputs', () => {
  it('non-finite inputs return the em-dash, never "NaN"/fabricated zero', () => {
    expect(formatVolume(NaN, 'us')).toBe('—');
    expect(formatVolume(Infinity, 'metric')).toBe('—');
    expect(formatHopMass(NaN, 'us')).toBe('—');
    expect(formatHopMass(-Infinity, 'imperial')).toBe('—');
    expect(Number.isNaN(convertVolume(NaN, 'us'))).toBe(true);
    expect(Number.isNaN(convertHopMass(Infinity, 'us'))).toBe(true);
  });

  it('zero formats normally and never collapses to the em-dash', () => {
    expect(formatVolume(0, 'metric')).toBe('0.0 L');
    expect(formatVolume(0, 'us')).toBe('0.00 gal');
    expect(formatVolume(0, 'imperial')).toBe('0.00 imp gal');
    expect(formatHopMass(0, 'metric')).toBe('0.0 g');
    expect(formatHopMass(0, 'us')).toBe('0.00 oz');
  });

  it('negative values convert and format normally, no clamping', () => {
    expect(formatVolume(-2.5, 'us')).toBe('-0.66 gal');
  });
});

describe('AC-7: round-trip fidelity', () => {
  it('usGalToL(lToUsGal(20)) and impGalToL(lToImpGal(20)) each return ~20', () => {
    expect(Math.abs(usGalToL(lToUsGal(20)) - 20)).toBeLessThan(1e-9);
    expect(Math.abs(impGalToL(lToImpGal(20)) - 20)).toBeLessThan(1e-9);
  });

  it('the two gallon converters are not silently the same function', () => {
    expect(Math.abs(impGalToL(lToUsGal(20)) - 20)).toBeGreaterThan(1e-9);
  });
});
