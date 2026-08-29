import { describe, it, expect } from 'vitest';
import {
  calculateResidualAlkalinity,
  calculateFinishedIons,
  predictMashPh,
  suggestSaltAdditions,
  calculateAcidAdditions,
  calculatePostAcidMashPh,
  calculateDilutedWaterProfile,
  calculateSulfateToChlorideRatio,
  calculateSpargeAcid,
  SALT_CONTRIBUTIONS,
} from '../src/water';
import type { WaterProfile, FermentableItem, MiscItem } from '@truchabrew/shared-types';

// ---------------------------------------------------------------------------
// AC-1: Mineral Salt Constants
// ---------------------------------------------------------------------------
describe('SALT_CONTRIBUTIONS', () => {
  it('contains exactly 5 salts', () => {
    expect(SALT_CONTRIBUTIONS).toHaveLength(5);
  });

  it('Gypsum: +61.5 ppm Ca, +147.4 ppm SO4 per g/L', () => {
    const g = SALT_CONTRIBUTIONS.find((s) => s.name === 'Gypsum')!;
    expect(g.calcium).toBe(61.5);
    expect(g.sulfate).toBe(147.4);
    expect(g.magnesium).toBe(0);
    expect(g.sodium).toBe(0);
    expect(g.chloride).toBe(0);
    expect(g.bicarbonate).toBe(0);
  });

  it('Calcium Chloride: +72.0 ppm Ca, +127.0 ppm Cl per g/L', () => {
    const c = SALT_CONTRIBUTIONS.find((s) => s.name === 'Calcium Chloride')!;
    expect(c.calcium).toBe(72.0);
    expect(c.chloride).toBe(127.0);
  });

  it('Epsom Salt: +26.0 ppm Mg, +103.0 ppm SO4 per g/L', () => {
    const e = SALT_CONTRIBUTIONS.find((s) => s.name === 'Epsom Salt')!;
    expect(e.magnesium).toBe(26.0);
    expect(e.sulfate).toBe(103.0);
  });

  it('Table Salt: +104.0 ppm Na, +161.0 ppm Cl per g/L', () => {
    const t = SALT_CONTRIBUTIONS.find((s) => s.name === 'Table Salt')!;
    expect(t.sodium).toBe(104.0);
    expect(t.chloride).toBe(161.0);
  });

  it('Baking Soda: +80.0 ppm Na, +191.0 ppm HCO3 per g/L', () => {
    const b = SALT_CONTRIBUTIONS.find((s) => s.name === 'Baking Soda')!;
    expect(b.sodium).toBe(80.0);
    expect(b.bicarbonate).toBe(191.0);
  });
});

// ---------------------------------------------------------------------------
// AC-1..AC-6: Residual Alkalinity Math (Kolbach stoichiometric equation)
// ---------------------------------------------------------------------------
describe('calculateResidualAlkalinity (M11_P3 AC-1..AC-6)', () => {
  it('AC-1: evaluates to 1.4860 mEq/L for standard water (150, 60, 10)', () => {
    const result = calculateResidualAlkalinity(150, 60, 10);
    // RA = (150/61.0) - ((60/70.14) + (10/85.05)) = 2.459016 - 0.973010 = 1.486006
    expect(result).toBeCloseTo(1.4860, 4);
  });

  it('AC-2: returns 0 for all-zero inputs', () => {
    expect(calculateResidualAlkalinity(0, 0, 0)).toBe(0);
  });

  it('AC-3: evaluates to -0.8412 mEq/L for high mineral water (50, 100, 20)', () => {
    const result = calculateResidualAlkalinity(50, 100, 20);
    // RA = (50/61.0) - ((100/70.14) + (20/85.05)) = 0.819672 - 1.660876 = -0.841204
    expect(result).toBeCloseTo(-0.8412, 4);
  });

  it('AC-4: pure Calcium contribution yields -1.0000 mEq/L for 70.14 ppm Ca', () => {
    expect(calculateResidualAlkalinity(0, 70.14, 0)).toBeCloseTo(-1.0000, 4);
  });

  it('AC-5: pure Magnesium contribution yields -1.0000 mEq/L for 85.05 ppm Mg', () => {
    expect(calculateResidualAlkalinity(0, 0, 85.05)).toBeCloseTo(-1.0000, 4);
  });

  it('AC-6: pure Bicarbonate contribution yields +1.0000 mEq/L for 61.0 ppm HCO3', () => {
    expect(calculateResidualAlkalinity(61.0, 0, 0)).toBeCloseTo(1.0000, 4);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Finished Ion Accumulation
// ---------------------------------------------------------------------------
describe('calculateFinishedIons', () => {
  it('Adding 5g Gypsum to 20L water increases Ca by 15.375 ppm and SO4 by 36.85 ppm', () => {
    const miscs: MiscItem[] = [
      {
        id: 'misc-1',
        name: 'Gypsum',
        type: 'WaterAgent',
        use: 'Mash',
        timeMinutes: 0,
        amount: 5,
        unit: 'g',
      },
    ];

    const result = calculateFinishedIons(null, 20, miscs);
    expect(result.calcium).toBeCloseTo(15.375, 4);
    expect(result.sulfate).toBeCloseTo(36.85, 4);
  });

  it('source profile ions are included as baseline', () => {
    const source: WaterProfile = {
      id: 'wp-1', name: 'Tap', type: 'source',
      calcium: 50, magnesium: 10, sodium: 20, chloride: 30, sulfate: 40, bicarbonate: 100,
      ph: 7.5, description: null,
    };
    const miscs: MiscItem[] = [
      {
        id: 'misc-1', name: 'Gypsum', type: 'WaterAgent', use: 'Mash',
        timeMinutes: 0, amount: 5, unit: 'g',
      },
    ];
    const result = calculateFinishedIons(source, 20, miscs);
    expect(result.calcium).toBeCloseTo(50 + 15.375, 4);
    expect(result.sulfate).toBeCloseTo(40 + 36.85, 4);
    expect(result.sodium).toBe(20);
  });

  it('non-WaterAgent miscs are ignored', () => {
    const miscs: MiscItem[] = [
      {
        id: 'misc-1', name: 'Gypsum', type: 'Spice', use: 'Boil',
        timeMinutes: 10, amount: 5, unit: 'g',
      },
    ];
    const result = calculateFinishedIons(null, 20, miscs);
    expect(result.calcium).toBe(0);
  });

  it('returns zeros for null source and empty miscs', () => {
    const result = calculateFinishedIons(null, 20, []);
    expect(result.calcium).toBe(0);
    expect(result.magnesium).toBe(0);
    expect(result.sodium).toBe(0);
    expect(result.chloride).toBe(0);
    expect(result.sulfate).toBe(0);
    expect(result.bicarbonate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Predicted Mash pH Base Malt
// ---------------------------------------------------------------------------
describe('predictMashPh', () => {
  it('pure base malt grist with 0 RA yields predicted mash pH of 5.60', () => {
    const grist: FermentableItem[] = [
      { id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 },
    ];
    const result = predictMashPh(grist, 20, 0);
    expect(result).toBeCloseTo(5.60, 2);
  });

  // AC-5: Predicted Mash pH Dark Grist
  it('grist with dark roasted malts decreases predicted mash pH below 5.20', () => {
    const grist: FermentableItem[] = [
      { id: 'f-1', name: 'Chocolate Malt', type: 'Grain', amountKg: 5, colorSrm: 350, potentialSg: 1.028 },
    ];
    const result = predictMashPh(grist, 20, 0);
    expect(result).toBeLessThan(5.20);
  });

  it('returns 5.60 for empty grist', () => {
    expect(predictMashPh([], 20, 0)).toBe(5.60);
  });

  // AC-7 (M11_P3): Positive RA water profile shifts predicted pH upward
  it('AC-7: 5kg Pale Malt with positive RA (+1.4860) yields predicted pH ~5.67 (5.665)', () => {
    const grist: FermentableItem[] = [
      { id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 },
    ];
    // delta = 1.486006 * 0.044 = 0.06538 -> 5.60 + 0.06538 = 5.66538
    const result = predictMashPh(grist, 20, 1.486006);
    expect(result).toBeCloseTo(5.665, 2);
  });

  // AC-8 (M11_P3): Negative RA water profile shifts predicted pH downward
  it('AC-8: 5kg Pale Malt with negative RA (-0.8412) yields predicted pH ~5.56 (5.563)', () => {
    const grist: FermentableItem[] = [
      { id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 },
    ];
    // delta = -0.841204 * 0.044 = -0.03701 -> 5.60 - 0.03701 = 5.56299
    const result = predictMashPh(grist, 20, -0.841204);
    expect(result).toBeCloseTo(5.563, 2);
  });

  it('AC-9: clamps predicted pH to [4.50, 6.50]', () => {
    const grist: FermentableItem[] = [
      { id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 },
    ];
    const highRA = predictMashPh(grist, 20, 100);
    expect(highRA).toBeLessThanOrEqual(6.50);
    const lowRA = predictMashPh(grist, 20, -100);
    expect(lowRA).toBeGreaterThanOrEqual(4.50);
  });

  it('only counts Grain-type fermentables', () => {
    const grist: FermentableItem[] = [
      { id: 'f-1', name: 'Table Sugar', type: 'Sugar', amountKg: 5, colorSrm: 0, potentialSg: 1.046 },
    ];
    expect(predictMashPh(grist, 20, 0)).toBe(5.60);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Salt Auto-Suggest Non-Negative
// ---------------------------------------------------------------------------
describe('suggestSaltAdditions', () => {
  it('auto-suggest salt amounts are always >= 0 grams; excess source ions yield 0g', () => {
    const source: WaterProfile = {
      id: 'wp-1', name: 'High Mineral', type: 'source',
      calcium: 200, magnesium: 100, sodium: 150, chloride: 200, sulfate: 300, bicarbonate: 400,
      ph: 8.0, description: null,
    };
    const target: WaterProfile = {
      id: 'wp-2', name: 'Low Target', type: 'target',
      calcium: 50, magnesium: 10, sodium: 20, chloride: 30, sulfate: 40, bicarbonate: 50,
      ph: 7.0, description: null,
    };
    const result = suggestSaltAdditions(source, target, 20);
    for (const addition of result) {
      expect(addition.amountGrams).toBeGreaterThanOrEqual(0);
    }
  });

  it('suggests correct salts in priority order', () => {
    const source: WaterProfile = {
      id: 'wp-1', name: 'RO', type: 'source',
      calcium: 0, magnesium: 0, sodium: 0, chloride: 0, sulfate: 0, bicarbonate: 0,
      ph: 7.0, description: null,
    };
    const target: WaterProfile = {
      id: 'wp-2', name: 'Hoppy', type: 'target',
      calcium: 75, magnesium: 15, sodium: 10, chloride: 50, sulfate: 150, bicarbonate: 0,
      ph: 6.5, description: null,
    };
    const result = suggestSaltAdditions(source, target, 20);
    expect(result).toHaveLength(5);
    expect(result[0].saltName).toBe('Calcium Chloride');
    expect(result[1].saltName).toBe('Gypsum');
    expect(result[2].saltName).toBe('Epsom Salt');
    expect(result[3].saltName).toBe('Baking Soda');
    expect(result[4].saltName).toBe('Table Salt');
    for (const r of result) {
      expect(r.amountGrams).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns all zeros when no target', () => {
    const result = suggestSaltAdditions(null, null, 20);
    for (const r of result) {
      expect(r.amountGrams).toBe(0);
    }
  });

  it('returns all zeros when waterVolumeL <= 0', () => {
    const target: WaterProfile = {
      id: 'wp-2', name: 'Target', type: 'target',
      calcium: 75, magnesium: 15, sodium: 10, chloride: 50, sulfate: 150, bicarbonate: 50,
      ph: 6.5, description: null,
    };
    const result = suggestSaltAdditions(null, target, 0);
    for (const r of result) {
      expect(r.amountGrams).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// M11_P1 AC-1..AC-4: Water Acid Additions & Neutralization (FEAT-001)
// ---------------------------------------------------------------------------
describe('calculateAcidAdditions (M11_P1 AC-1..AC-4)', () => {
  it('AC-1: Acid addition calculation (Lactic 88%) with 5.0 kg malt, 5.60 -> 5.30 calculates correct lactic mL (~3.8 mL)', () => {
    const result = calculateAcidAdditions(5.0, 5.60, 5.30);
    expect(result.deltaPh).toBe(0.30);
    expect(result.mEqRequired).toBe(45.0);
    // 45 / 11.8 = 3.813559... -> 3.81 mL
    expect(result.lacticAcid88Ml).toBeCloseTo(3.81, 1);
  });

  it('AC-2: Acid addition calculation (Phosphoric 75%) calculates correct phosphoric acid dosage for the same delta (~3.0 mL)', () => {
    const result = calculateAcidAdditions(5.0, 5.60, 5.30);
    // 45 / 14.9 = 3.020134... -> 3.02 mL
    expect(result.phosphoricAcid75Ml).toBeCloseTo(3.02, 1);
  });

  it('AC-3: Acidulated malt dosage calculation (150 g for 0.30 pH shift on 5.0 kg grain)', () => {
    const result = calculateAcidAdditions(5.0, 5.60, 5.30);
    // 5.0 * 100 * 0.30 = 150 g
    expect(result.acidulatedMaltGrams).toBe(150.0);
  });

  it('AC-4: Acid calculation zero/negative delta guard (target >= predicted returns 0 without error)', () => {
    const resultSame = calculateAcidAdditions(5.0, 5.40, 5.40);
    expect(resultSame.deltaPh).toBe(0);
    expect(resultSame.mEqRequired).toBe(0);
    expect(resultSame.lacticAcid88Ml).toBe(0);
    expect(resultSame.phosphoricAcid75Ml).toBe(0);
    expect(resultSame.acidulatedMaltGrams).toBe(0);

    const resultHigher = calculateAcidAdditions(5.0, 5.20, 5.40);
    expect(resultHigher.deltaPh).toBe(0);
    expect(resultHigher.mEqRequired).toBe(0);
    expect(resultHigher.lacticAcid88Ml).toBe(0);
    expect(resultHigher.phosphoricAcid75Ml).toBe(0);
    expect(resultHigher.acidulatedMaltGrams).toBe(0);

    const resultZeroGrain = calculateAcidAdditions(0, 5.60, 5.30);
    expect(resultZeroGrain.mEqRequired).toBe(0);
    expect(resultZeroGrain.lacticAcid88Ml).toBe(0);
  });

  it('calculatePostAcidMashPh predicts mash pH shift accurately from additions', () => {
    const postPhLactic = calculatePostAcidMashPh(5.60, 5.0, 15, { lacticAcid88Ml: 3.81 });
    expect(postPhLactic).toBeCloseTo(5.30, 1);

    const postPhMalt = calculatePostAcidMashPh(5.60, 5.0, 15, { acidulatedMaltGrams: 150 });
    expect(postPhMalt).toBeCloseTo(5.30, 1);
  });
});

// ---------------------------------------------------------------------------
// M21_P1: Dilution, SO4/Cl Ratio & Sparge Acid Tests (FEAT-012, FEAT-001)
// ---------------------------------------------------------------------------
describe('M21_P1 Water Calculations: Dilution, SO4/Cl Ratio, Sparge Acid', () => {
  const sampleSource: WaterProfile = {
    id: 'wp-src',
    name: 'Tap Water',
    type: 'source',
    calcium: 100,
    magnesium: 20,
    sodium: 30,
    chloride: 50,
    sulfate: 100,
    bicarbonate: 120,
    ph: 7.8,
    description: null,
  };

  it('calculateDilutedWaterProfile scales all ions proportionally by dilution percentage', () => {
    const diluted50 = calculateDilutedWaterProfile(sampleSource, 50);
    expect(diluted50).not.toBeNull();
    expect(diluted50!.calcium).toBe(50);
    expect(diluted50!.magnesium).toBe(10);
    expect(diluted50!.sodium).toBe(15);
    expect(diluted50!.chloride).toBe(25);
    expect(diluted50!.sulfate).toBe(50);
    expect(diluted50!.bicarbonate).toBe(60);

    const diluted100 = calculateDilutedWaterProfile(sampleSource, 100);
    expect(diluted100!.calcium).toBe(0);
    expect(diluted100!.bicarbonate).toBe(0);

    const diluted0 = calculateDilutedWaterProfile(sampleSource, 0);
    expect(diluted0!.calcium).toBe(100);
  });

  it('calculateSulfateToChlorideRatio classifies balance accurately', () => {
    expect(calculateSulfateToChlorideRatio(200, 50)).toEqual({ ratio: 4.0, descriptor: 'Very Bitter / Dry' });
    expect(calculateSulfateToChlorideRatio(150, 100)).toEqual({ ratio: 1.5, descriptor: 'Bitter / Crisp' });
    expect(calculateSulfateToChlorideRatio(100, 100)).toEqual({ ratio: 1.0, descriptor: 'Balanced' });
    expect(calculateSulfateToChlorideRatio(60, 100)).toEqual({ ratio: 0.6, descriptor: 'Malty / Full' });
    expect(calculateSulfateToChlorideRatio(30, 100)).toEqual({ ratio: 0.3, descriptor: 'Very Malty' });
    expect(calculateSulfateToChlorideRatio(0, 0)).toEqual({ ratio: null, descriptor: 'None' });
  });

  it('calculateSpargeAcid computes acid needed to neutralize sparge bicarbonate alkalinity', () => {
    const result = calculateSpargeAcid(15.0, 120, 5.5);
    expect(result.mEqRequired).toBeGreaterThan(0);
    expect(result.lacticAcid88Ml).toBeGreaterThan(0);
    expect(result.phosphoricAcid75Ml).toBeGreaterThan(0);

    const zeroResult = calculateSpargeAcid(0, 120, 5.5);
    expect(zeroResult.mEqRequired).toBe(0);
    expect(zeroResult.lacticAcid88Ml).toBe(0);
  });
});


