import { describe, it, expect } from 'vitest';
import {
  solveOptimalSalts,
  optimizeWaterProfile,
  type OptimizeWaterProfileResult,
} from '../src/waterOptimization';
import { suggestSaltAdditions } from '../src/water';
import type { WaterProfile } from '@truchabrew/shared-types';

// ---------------------------------------------------------------------------
// Fixture helper — build a WaterProfile with just the ion fields we need.
// ---------------------------------------------------------------------------

interface IonProfile {
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
}

function profile(ions: IonProfile, name: string): WaterProfile {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    type: 'target',
    ...ions,
    ph: 7.0,
    description: null,
  };
}

const RO: WaterProfile = profile(
  { calcium: 0, magnesium: 0, sodium: 0, chloride: 0, sulfate: 0, bicarbonate: 0 },
  'RO / Distilled',
);

function saltMap(result: { saltName: string; amountGrams: number }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of result) map[s.saltName] = s.amountGrams;
  return map;
}

// ---------------------------------------------------------------------------
// AC-1: module exports & public API shape
// ---------------------------------------------------------------------------

describe('M37_P1 AC-1: module architecture', () => {
  it('exports solveOptimalSalts and optimizeWaterProfile as functions', () => {
    expect(typeof solveOptimalSalts).toBe('function');
    expect(typeof optimizeWaterProfile).toBe('function');
  });

  it('optimizeWaterProfile returns the full result contract', () => {
    const target = profile(
      { calcium: 75, magnesium: 10, sodium: 20, chloride: 50, sulfate: 150, bicarbonate: 40 },
      'Pale Ale',
    );
    const result: OptimizeWaterProfileResult = optimizeWaterProfile(RO, target, 20);
    expect(result).toHaveProperty('salts');
    expect(result).toHaveProperty('resultingWater');
    expect(result).toHaveProperty('residualDeltas');
    expect(result).toHaveProperty('sulfateToChlorideRatio');
    expect(result).toHaveProperty('fitScorePct');
    expect(result.salts).toHaveLength(5);
    for (const ion of ['calcium', 'magnesium', 'sodium', 'chloride', 'sulfate', 'bicarbonate'] as const) {
      expect(typeof result.resultingWater[ion]).toBe('number');
      expect(typeof result.residualDeltas[ion]).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2: non-negativity invariant
// ---------------------------------------------------------------------------

describe('M37_P1 AC-2: non-negativity', () => {
  it('all recommended doses are >= 0 and rounded to 2dp', () => {
    const target = profile(
      { calcium: 295, magnesium: 30, sodium: 30, chloride: 25, sulfate: 725, bicarbonate: 30 },
      'Burton-on-Trent',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    for (const s of result.salts) {
      expect(s.amountGrams).toBeGreaterThanOrEqual(0);
      expect(Math.round(s.amountGrams * 100) / 100).toBe(s.amountGrams);
    }
    // suggestSaltAdditions delegates to the same solver (AC-15)
    for (const s of suggestSaltAdditions(RO, target, 23)) {
      expect(s.amountGrams).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-3: calcium overshoot fix (BUG-024)
// ---------------------------------------------------------------------------

describe('M37_P1 AC-3: calcium overshoot fix (BUG-024)', () => {
  it('does not overshoot Ca by >25% for elevated Cl AND SO4 targets', () => {
    // The exact BUG-024 class: both Cl and SO4 elevated, so the greedy chain
    // used to pile on Calcium Chloride + Gypsum and overshoot calcium.
    const target = profile(
      { calcium: 100, magnesium: 10, sodium: 10, chloride: 150, sulfate: 150, bicarbonate: 40 },
      'High Cl + SO4',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    const finished = result.resultingWater;
    // Calcium must not overshoot target by more than 25%.
    expect(finished.calcium).toBeLessThanOrEqual(100 * 1.25);
    // And we should be reasonably close to target (not wildly under either).
    expect(finished.calcium).toBeGreaterThan(100 * 0.6);
  });

  it('reproduces the BUG-024 profile and lands closer than the greedy baseline', () => {
    const target = profile(
      { calcium: 100, magnesium: 10, sodium: 10, chloride: 60, sulfate: 150, bicarbonate: 40 },
      'M23_P2 BUG-024 fixture',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    const finished = result.resultingWater;
    // The greedy baseline gave SO4 = 189.6 (a +39.6 ppm overshoot). The solver
    // should do strictly better: SO4 within ±15 ppm of 150, and no ion wildly off.
    expect(Math.abs(finished.sulfate - 150)).toBeLessThan(15);
    // Sodium should not overshoot badly either (greedy gave +6.8).
    expect(finished.sodium).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// AC-4: sulfate-to-chloride ratio preserved
// ---------------------------------------------------------------------------

describe('M37_P1 AC-4: sulfate-to-chloride ratio', () => {
  it('preserves the SO4:Cl ratio within ±15% when achievable', () => {
    const target = profile(
      { calcium: 75, magnesium: 10, sodium: 15, chloride: 50, sulfate: 150, bicarbonate: 20 },
      'West Coast (3:1)',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    const ratio = result.resultingWater.sulfate / result.resultingWater.chloride;
    const targetRatio = target.sulfate / target.chloride;
    expect(Math.abs(ratio - targetRatio)).toBeLessThanOrEqual(targetRatio * 0.15);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Epsom salt synergy
// ---------------------------------------------------------------------------

describe('M37_P1 AC-5: Epsom salt synergy', () => {
  it('allocates Epsom Salt when both Mg and SO4 are needed', () => {
    const target = profile(
      { calcium: 100, magnesium: 25, sodium: 10, chloride: 30, sulfate: 250, bicarbonate: 30 },
      'High Mg + SO4',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    const map = saltMap(result.salts);
    // Epsom is dosed (nonzero) to carry magnesium alongside the sulfate load.
    expect(map['Epsom Salt']).toBeGreaterThan(0);
    // Magnesium rises materially above the no-dose 0 ppm baseline.
    expect(result.resultingWater.magnesium).toBeGreaterThan(10);
    // The high-weight sulfate ion is landed near-exactly (weight 1.0), even
    // though that caps how much magnesium Epsom can add without overshooting.
    expect(Math.abs(result.resultingWater.sulfate - 250)).toBeLessThan(2);
    // Magnesium never overshoots its target.
    expect(result.resultingWater.magnesium).toBeLessThanOrEqual(25);
  });
});

// ---------------------------------------------------------------------------
// AC-6: table salt synergy
// ---------------------------------------------------------------------------

describe('M37_P1 AC-6: table salt synergy', () => {
  it('allocates Table Salt when both Na and Cl are needed', () => {
    const target = profile(
      { calcium: 60, magnesium: 10, sodium: 40, chloride: 80, sulfate: 60, bicarbonate: 20 },
      'High Na + Cl',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    const map = saltMap(result.salts);
    // Table Salt is dosed to carry sodium alongside the chloride load.
    expect(map['Table Salt']).toBeGreaterThan(0);
    // Sodium rises materially above the no-dose 0 ppm baseline.
    expect(result.resultingWater.sodium).toBeGreaterThan(15);
    // The high-weight chloride ion is landed near-exactly (weight 1.0).
    expect(Math.abs(result.resultingWater.chloride - 80)).toBeLessThan(2);
    // Sodium never overshoots its target (weight 0.4 + overshoot penalty).
    expect(result.resultingWater.sodium).toBeLessThanOrEqual(40 * 1.1);
  });
});

// ---------------------------------------------------------------------------
// AC-7: baking soda synergy
// ---------------------------------------------------------------------------

describe('M37_P1 AC-7: baking soda synergy', () => {
  it('doses Baking Soda for HCO3 and factors its Na contribution', () => {
    // Baking soda adds ~7.4 ppm Na per g/L alongside ~19.7 ppm HCO3, so a
    // target that needs meaningful bicarbonate must accommodate the sodium it
    // carries. This fixture's Na target is high enough that dosing baking soda
    // for the HCO3 delta stays within bounds.
    const target = profile(
      { calcium: 60, magnesium: 10, sodium: 60, chloride: 50, sulfate: 80, bicarbonate: 120 },
      'High HCO3',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    const map = saltMap(result.salts);
    expect(map['Baking Soda']).toBeGreaterThan(0);
    // The high-weight bicarbonate ion is landed near-exactly (weight 0.3 but
    // baking soda is the only HCO3 source, so the objective still rewards it).
    expect(Math.abs(result.resultingWater.bicarbonate - 120)).toBeLessThan(3);
    // Its sodium is counted toward the sodium target — no wild overshoot.
    expect(result.resultingWater.sodium).toBeLessThanOrEqual(60 * 1.3);
  });
});

// ---------------------------------------------------------------------------
// AC-8: zero volume / null target
// ---------------------------------------------------------------------------

describe('M37_P1 AC-8: degenerate inputs', () => {
  it('returns all zeros for waterVolumeL <= 0 without throwing', () => {
    const target = profile(
      { calcium: 75, magnesium: 10, sodium: 10, chloride: 50, sulfate: 150, bicarbonate: 40 },
      'Pale Ale',
    );
    const result = optimizeWaterProfile(RO, target, 0);
    for (const s of result.salts) expect(s.amountGrams).toBe(0);
    const suggested = suggestSaltAdditions(RO, target, -5);
    for (const s of suggested) expect(s.amountGrams).toBe(0);
  });

  it('returns all zeros for null target without throwing', () => {
    const result = optimizeWaterProfile(RO, null, 20);
    for (const s of result.salts) expect(s.amountGrams).toBe(0);
    const suggested = suggestSaltAdditions(RO, null, 20);
    for (const s of suggested) expect(s.amountGrams).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-9: source exceeds target
// ---------------------------------------------------------------------------

describe('M37_P1 AC-9: source exceeds target', () => {
  it('doses 0g when source already exceeds the target ion', () => {
    const source = profile(
      { calcium: 200, magnesium: 100, sodium: 150, chloride: 200, sulfate: 300, bicarbonate: 400 },
      'High Mineral Source',
    );
    const target = profile(
      { calcium: 50, magnesium: 10, sodium: 20, chloride: 30, sulfate: 40, bicarbonate: 50 },
      'Low Target',
    );
    const result = optimizeWaterProfile(source, target, 20);
    for (const s of result.salts) {
      expect(s.amountGrams).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-10..AC-13: world water profile fixtures
// ---------------------------------------------------------------------------

describe('M37_P1 AC-10: Burton-on-Trent fixture', () => {
  it('doses Gypsum, Epsom, and Calcium Chloride for the high-mineral Burton profile', () => {
    const target = profile(
      { calcium: 295, magnesium: 30, sodium: 30, chloride: 25, sulfate: 725, bicarbonate: 30 },
      'Burton-on-Trent',
    );
    const map = saltMap(optimizeWaterProfile(RO, target, 23).salts);
    expect(map.Gypsum).toBeGreaterThan(0);
    expect(map['Epsom Salt']).toBeGreaterThan(0);
    expect(map['Calcium Chloride']).toBeGreaterThan(0);
  });
});

describe('M37_P1 AC-11: Pilsen soft water fixture', () => {
  it('returns minimal salt additions for the soft Pilsen profile', () => {
    const target = profile(
      { calcium: 10, magnesium: 5, sodium: 3, chloride: 5, sulfate: 5, bicarbonate: 20 },
      'Pilsen',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    const totalGrams = result.salts.reduce((sum, s) => sum + s.amountGrams, 0);
    // Minimal additions — soft profile needs only trace salts.
    expect(totalGrams).toBeLessThan(10);
  });
});

describe('M37_P1 AC-12: NEIPA high-chloride fixture', () => {
  it('prioritizes Calcium Chloride for a 2:1 Cl:SO4 NEIPA without excess Gypsum', () => {
    const target = profile(
      { calcium: 90, magnesium: 5, sodium: 10, chloride: 120, sulfate: 60, bicarbonate: 0 },
      'NEIPA / Juicy IPA',
    );
    const map = saltMap(optimizeWaterProfile(RO, target, 23).salts);
    // Chloride-dominated target → Calcium Chloride is the primary salt.
    expect(map['Calcium Chloride']).toBeGreaterThan(map.Gypsum);
    // Finished ratio should land near 0.5 (Cl:SO4 2:1 => SO4:Cl 0.5).
    const ratio = optimizeWaterProfile(RO, target, 23).resultingWater.sulfate /
      Math.max(1e-6, optimizeWaterProfile(RO, target, 23).resultingWater.chloride);
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.8);
  });
});

describe('M37_P1 AC-13: West Coast IPA fixture', () => {
  it('prioritizes Gypsum for a 3:1 SO4:Cl West Coast profile', () => {
    const target = profile(
      { calcium: 100, magnesium: 10, sodium: 10, chloride: 50, sulfate: 150, bicarbonate: 10 },
      'West Coast IPA',
    );
    const map = saltMap(optimizeWaterProfile(RO, target, 23).salts);
    // Sulfate-dominated target → Gypsum is the primary salt.
    expect(map.Gypsum).toBeGreaterThan(map['Calcium Chloride']);
    const ratio = optimizeWaterProfile(RO, target, 23).resultingWater.sulfate /
      Math.max(1e-6, optimizeWaterProfile(RO, target, 23).resultingWater.chloride);
    expect(ratio).toBeGreaterThan(2.0);
  });
});

// ---------------------------------------------------------------------------
// AC-14: fit score
// ---------------------------------------------------------------------------

describe('M37_P1 AC-14: fit score calculation', () => {
  it('returns a normalized 0-100 fitScorePct', () => {
    const target = profile(
      { calcium: 75, magnesium: 10, sodium: 15, chloride: 50, sulfate: 150, bicarbonate: 40 },
      'Pale Ale',
    );
    const result = optimizeWaterProfile(RO, target, 23);
    expect(result.fitScorePct).toBeGreaterThanOrEqual(0);
    expect(result.fitScorePct).toBeLessThanOrEqual(100);
  });

  it('perfect match on a fully-achievable single-ion profile scores near 100', () => {
    // Pure gypsum target: only SO4 + Ca needed, nothing else. The solver can
    // land this almost exactly, so fit should be high.
    const target = profile(
      { calcium: 50, magnesium: 0, sodium: 0, chloride: 0, sulfate: 120, bicarbonate: 0 },
      'Gypsum-only',
    );
    const result = optimizeWaterProfile(RO, target, 20);
    expect(result.fitScorePct).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// AC-15: backward compatibility of suggestSaltAdditions
// ---------------------------------------------------------------------------

describe('M37_P1 AC-15: backward compatibility', () => {
  it('suggestSaltAdditions keeps its 3-arg signature and 5-salt array shape', () => {
    const target = profile(
      { calcium: 75, magnesium: 15, sodium: 10, chloride: 50, sulfate: 150, bicarbonate: 0 },
      'Hoppy',
    );
    const result = suggestSaltAdditions(RO, target, 20);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(5);
    for (const r of result) {
      expect(typeof r.saltName).toBe('string');
      expect(typeof r.amountGrams).toBe('number');
    }
    // Existing water.test.ts pins the greedy-priority salt order — the solver
    // must preserve it (AC-15).
    expect(result.map((r) => r.saltName)).toEqual([
      'Calcium Chloride',
      'Gypsum',
      'Epsom Salt',
      'Baking Soda',
      'Table Salt',
    ]);
  });
});
