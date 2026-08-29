import { describe, it, expect } from 'vitest';
import type { ClosingSnapshot } from '@truchabrew/shared-types';
import { NUTRITION_SERVING_ML, REAL_EXTRACT_OE_COEFF, REAL_EXTRACT_AE_COEFF, beerNutrition, nutritionFromClosingSnapshot } from '../src/nutrition';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function closingSnapshot(overrides: Partial<ClosingSnapshot> = {}): ClosingSnapshot {
  return {
    frozenAt: '2026-01-01T00:00:00.000Z',
    originalGravity: 1.05,
    finalGravity: 1.01,
    abv: 5.2,
    apparentAttenuationPct: 80,
    mashEfficiencyPct: 75,
    peakFermentationTempC: 20,
    beerVolumeL: 19,
    beerVolumeSource: 'measured',
    primingSugarG: 100,
    primingSugarEquivGPerL: 5,
    carbonationForcePsi: 12,
    ...overrides,
  };
}

describe('AC-19: nutrition reference values (primary)', () => {
  it('beerNutrition(1.050, 1.010)', () => {
    const n = beerNutrition(1.05, 1.01);
    expect(n.originalPlato).toBeCloseTo(12.374342499999955, 10);
    expect(n.apparentPlato).toBeCloseTo(2.5615219399998637, 10);
    expect(n.realExtractPlato).toBeCloseTo(4.33567989724788, 10);
    expect(n.abwPct).toBeCloseTo(4.155361985022483, 10);
    expect(n.caloriesPer100Ml).toBeCloseTo(46.07086445850313, 10);
    expect(n.carbsGPer100Ml).toBeCloseTo(4.27803669622036, 10);
    expect(n.alcoholGPer100Ml).toBeCloseTo(4.196915604872708, 10);
  });
});

describe('AC-20: nutrition reference values (two more points)', () => {
  it('beerNutrition(1.060, 1.012) and beerNutrition(1.040, 1.010)', () => {
    const a = beerNutrition(1.06, 1.012);
    expect(a.caloriesPer100Ml).toBeCloseTo(55.46678695643077, 10);
    expect(a.carbsGPer100Ml).toBeCloseTo(5.136822806439016, 10);
    expect(a.abwPct).toBeCloseTo(5.000787038247508, 10);

    const b = beerNutrition(1.04, 1.01);
    expect(b.caloriesPer100Ml).toBeCloseTo(36.985560347897504, 10);
    expect(b.carbsGPer100Ml).toBeCloseTo(3.8415286448536565, 10);
    expect(b.abwPct).toBeCloseTo(3.102230702896094, 10);
  });
});

describe('AC-21: nutrition is unclamped at and past the degenerate boundary', () => {
  it('zero attenuation and FG > OG both compute without clamping', () => {
    const zero = beerNutrition(1.05, 1.05);
    expect(zero.abwPct).toBe(0);
    expect(zero.alcoholGPer100Ml).toBe(0);
    expect(zero.caloriesPer100Ml).toBeCloseTo(51.55223849999982, 10);
    expect(zero.carbsGPer100Ml).toBeCloseTo(12.888059624999954, 10);

    const stuck = beerNutrition(1.05, 1.06);
    expect(stuck.abwPct).toBeCloseTo(-0.995296435422155, 10);
    expect(stuck.alcoholGPer100Ml).toBeCloseTo(-1.0550142215474843, 10);
  });
});

describe('AC-22: serving figures are the per-100 mL figures scaled by 3.55', () => {
  it('caloriesPerServing/carbsGPerServing/alcoholGPerServing', () => {
    const n = beerNutrition(1.05, 1.01);
    expect(n.caloriesPerServing).toBeCloseTo(163.5515688276861, 9);
    expect(n.carbsGPerServing).toBeCloseTo(15.187030271582277, 9);
    expect(n.alcoholGPerServing).toBeCloseTo(14.899050397298113, 9);

    const factor = NUTRITION_SERVING_ML / 100;
    expect(n.caloriesPerServing).toBe(n.caloriesPer100Ml * factor);
    expect(n.carbsGPerServing).toBe(n.carbsGPer100Ml * factor);
    expect(n.alcoholGPerServing).toBe(n.alcoholGPer100Ml * factor);
  });
});

describe('AC-23: nutritionFromClosingSnapshot, and no second Plato conversion', () => {
  it('null in null out; snapshot delegates to beerNutrition; no re-derived Plato coefficients', () => {
    expect(nutritionFromClosingSnapshot(null)).toBeNull();

    const snapshot = closingSnapshot({ originalGravity: 1.05, finalGravity: 1.01 });
    expect(nutritionFromClosingSnapshot(snapshot)).toEqual(beerNutrition(1.05, 1.01));

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const source = readFileSync(path.resolve(__dirname, '..', 'src', 'nutrition.ts'), 'utf-8');
    for (const coeff of ['-668.96', '1262.45', '-776.43', '182.94']) {
      expect(source).not.toContain(coeff);
    }
    expect(source).toMatch(/import\s+\{[^}]*sgToPlato[^}]*\}\s+from\s+['"]\.\/config['"]/);

    // Exported coefficient constants (spec §1.1).
    expect(REAL_EXTRACT_OE_COEFF).toBe(0.1808);
    expect(REAL_EXTRACT_AE_COEFF).toBe(0.8192);
  });
});
