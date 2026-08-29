import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  targetCellsBillions,
  viabilityAfterMonths,
  viableCellsBillions,
  starterExtractGrams,
  starterGrowthRateBPerG,
  starterEndCellsBillions,
  alphaAcidAfterStorage,
  hopDecayRateConstant,
  hopTemperatureFactor,
  dilutionWaterL,
  dmeToAddKg,
  additionalBoilMinutes,
  PITCH_RATE_PRESETS,
  DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH,
  STARTER_TYPES,
  sgToPlato,
  type StarterType,
} from '../src';

// Every pinned value below was independently recomputed from the spec's
// §2.1 formulas (not copied from the spec text, not read back from this
// implementation) before this file was written.

describe('AC-1: yeast.ts exports', () => {
  it('PITCH_RATE_PRESETS, DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH, STARTER_TYPES are pinned', () => {
    expect(PITCH_RATE_PRESETS).toEqual({ ale: 0.75, highGravityAle: 1.25, lager: 1.5 });
    expect(STARTER_TYPES).toEqual(['stirPlate', 'shaken', 'simple']);
    expect(DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH).toBe(21);
  });
});

describe('AC-2: targetCellsBillions pinned, °P comes from sgToPlato', () => {
  it('sgToPlato(1.050) === 12.374342499999955', () => {
    expect(sgToPlato(1.05)).toBe(12.374342499999955);
  });

  it('ale preset at OG 1.050 / 20L === 185.61513749999932', () => {
    const ogPlato = sgToPlato(1.05);
    const result = targetCellsBillions({ ogPlato, volumeL: 20, pitchRateMillionCellsPerMlPerP: PITCH_RATE_PRESETS.ale });
    expect(result).toBe(185.61513749999932);
  });

  it('lager preset is exactly 2x the ale figure (homogeneous in rate)', () => {
    const ogPlato = sgToPlato(1.05);
    const aleResult = targetCellsBillions({ ogPlato, volumeL: 20, pitchRateMillionCellsPerMlPerP: PITCH_RATE_PRESETS.ale });
    const lagerResult = targetCellsBillions({ ogPlato, volumeL: 20, pitchRateMillionCellsPerMlPerP: PITCH_RATE_PRESETS.lager });
    expect(lagerResult).toBe(371.23027499999864);
    expect(Math.abs(lagerResult - aleResult * 2)).toBeLessThan(1e-9);
  });

  it('volumeL: 0 returns 0 exactly', () => {
    expect(targetCellsBillions({ ogPlato: sgToPlato(1.05), volumeL: 0, pitchRateMillionCellsPerMlPerP: PITCH_RATE_PRESETS.ale })).toBe(0);
  });
});

describe('AC-3: viabilityAfterMonths pinned', () => {
  it('pinned values at DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH', () => {
    const d = DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH;
    expect(viabilityAfterMonths(0, d)).toBe(1);
    expect(viabilityAfterMonths(1, d)).toBe(0.79);
    expect(viabilityAfterMonths(3, d)).toBe(0.49303900000000006);
    expect(viabilityAfterMonths(6, d)).toBe(0.24308745552100006);
    expect(viabilityAfterMonths(12, d)).toBe(0.05909151103167418);
  });

  it('is strictly decreasing across months 0..12', () => {
    const d = DEFAULT_YEAST_VIABILITY_DECAY_PCT_PER_MONTH;
    const values = Array.from({ length: 13 }, (_, m) => viabilityAfterMonths(m, d));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });

  it('zero decay: viabilityAfterMonths(6, 0) === 1 exactly', () => {
    expect(viabilityAfterMonths(6, 0)).toBe(1);
  });
});

describe('AC-4: viableCellsBillions delegates to viabilityAfterMonths', () => {
  it('pinned value, and equals packCellsBillions * viabilityAfterMonths(...) as an identity', () => {
    const result = viableCellsBillions({ packCellsBillions: 100, months: 3, monthlyDecayPct: 21 });
    expect(result).toBe(49.303900000000006);
    expect(result).toBe(100 * viabilityAfterMonths(3, 21));
  });

  it('packCellsBillions: 0 returns 0 exactly', () => {
    expect(viableCellsBillions({ packCellsBillions: 0, months: 3, monthlyDecayPct: 21 })).toBe(0);
  });
});

describe('AC-5: starterExtractGrams pinned, and sgToPlato is not duplicated', () => {
  it('pinned values, including the exact-half ratio', () => {
    const full = starterExtractGrams({ starterVolumeL: 2, starterGravitySg: 1.037 });
    const half = starterExtractGrams({ starterVolumeL: 1, starterGravitySg: 1.037 });
    expect(full).toBe(192.0283077900688);
    expect(half).toBe(96.0141538950344);
    expect(Math.abs(half - full / 2)).toBeLessThan(1e-9);
  });

  it('starterVolumeL: 0 returns 0 exactly', () => {
    expect(starterExtractGrams({ starterVolumeL: 0, starterGravitySg: 1.037 })).toBe(0);
  });

  it('yeast.ts contains no Plato coefficient (1262.45 / 668.96 appear only in config.ts)', () => {
    const yeastSrc = readFileSync(new URL('../src/yeast.ts', import.meta.url), 'utf8');
    expect(yeastSrc.includes('1262.45')).toBe(false);
    expect(yeastSrc.includes('668.96')).toBe(false);
  });
});

describe('AC-6: starterGrowthRateBPerG piecewise model, both sides of every breakpoint', () => {
  it('stirPlate: plateau, the 0.008 discontinuity at ir=1.4, decline, and the zero floor', () => {
    expect(starterGrowthRateBPerG(0, 'stirPlate')).toBe(1.4);
    expect(starterGrowthRateBPerG(1.39999, 'stirPlate')).toBe(1.4);
    expect(Math.abs(starterGrowthRateBPerG(1.4, 'stirPlate') - 1.392)).toBeLessThan(1e-9);
    expect(Math.abs(starterGrowthRateBPerG(2, 'stirPlate') - 0.99)).toBeLessThan(1e-9);
    expect(starterGrowthRateBPerG(3.5, 'stirPlate')).toBe(0);
    expect(starterGrowthRateBPerG(10, 'stirPlate')).toBe(0);
  });

  it('shaken: plateau up to (not including) 3.5, zero at and above', () => {
    expect(starterGrowthRateBPerG(0, 'shaken')).toBe(0.62);
    expect(starterGrowthRateBPerG(3.49999, 'shaken')).toBe(0.62);
    expect(starterGrowthRateBPerG(3.5, 'shaken')).toBe(0);
  });

  it('simple: plateau up to (not including) 3.5, zero at and above', () => {
    expect(starterGrowthRateBPerG(0, 'simple')).toBe(0.4);
    expect(starterGrowthRateBPerG(3.49999, 'simple')).toBe(0.4);
    expect(starterGrowthRateBPerG(3.5, 'simple')).toBe(0);
  });

  it('ordering at ir=1: stirPlate > shaken > simple', () => {
    const sp = starterGrowthRateBPerG(1, 'stirPlate');
    const sh = starterGrowthRateBPerG(1, 'shaken');
    const si = starterGrowthRateBPerG(1, 'simple');
    expect(sp).toBeGreaterThan(sh);
    expect(sh).toBeGreaterThan(si);
  });
});

describe('AC-7: starterEndCellsBillions worked example, delegating to both helpers', () => {
  const fixture = { initialCellsBillions: 100, starterVolumeL: 2, starterGravitySg: 1.037 } as const;

  it('stirPlate: pinned end-cells, decomposed piecewise from the imported helpers', () => {
    const extract = starterExtractGrams({ starterVolumeL: fixture.starterVolumeL, starterGravitySg: fixture.starterGravitySg });
    expect(extract).toBe(192.0283077900688);
    const ir = fixture.initialCellsBillions / extract;
    expect(ir).toBe(0.5207565548581673);
    const growth = starterGrowthRateBPerG(ir, 'stirPlate');
    expect(growth).toBe(1.4);
    const newCells = growth * extract;
    expect(newCells).toBe(268.8396309060963);
    const end = starterEndCellsBillions({ ...fixture, starterType: 'stirPlate' });
    expect(end).toBe(368.8396309060963);
    expect(end).toBe(fixture.initialCellsBillions + newCells);
  });

  it('shaken: 100 + 0.62 * extract', () => {
    const end = starterEndCellsBillions({ ...fixture, starterType: 'shaken' });
    expect(Math.abs(end - 219.05755082984265)).toBeLessThan(1e-9);
  });

  it('simple', () => {
    const end = starterEndCellsBillions({ ...fixture, starterType: 'simple' });
    expect(Math.abs(end - 176.81132311602752)).toBeLessThan(1e-9);
  });

  it('initialCellsBillions: 0 returns exactly the new-cells figure, not NaN — zero pitched cells is legitimate (ir=0)', () => {
    const end = starterEndCellsBillions({ initialCellsBillions: 0, starterVolumeL: 2, starterGravitySg: 1.037, starterType: 'stirPlate' });
    expect(end).toBe(268.8396309060963);
    expect(Number.isNaN(end)).toBe(false);
  });
});

describe('AC-16: non-finite passthrough across every new pure function (32 pairs, all three modules)', () => {
  interface Case {
    label: string;
    call: () => number;
  }

  const cases: Case[] = [
    // targetCellsBillions — 3
    { label: 'targetCellsBillions.ogPlato', call: () => targetCellsBillions({ ogPlato: NaN, volumeL: 20, pitchRateMillionCellsPerMlPerP: 0.75 }) },
    { label: 'targetCellsBillions.volumeL', call: () => targetCellsBillions({ ogPlato: 12, volumeL: NaN, pitchRateMillionCellsPerMlPerP: 0.75 }) },
    {
      label: 'targetCellsBillions.pitchRateMillionCellsPerMlPerP',
      call: () => targetCellsBillions({ ogPlato: 12, volumeL: 20, pitchRateMillionCellsPerMlPerP: NaN }),
    },
    // viabilityAfterMonths — 2 (monthlyDecayPct row uses months:6, non-zero,
    // per the fixture constraint: (NaN)**0 === 1, not NaN)
    { label: 'viabilityAfterMonths.months', call: () => viabilityAfterMonths(NaN, 21) },
    { label: 'viabilityAfterMonths.monthlyDecayPct', call: () => viabilityAfterMonths(6, NaN) },
    // viableCellsBillions — 3
    { label: 'viableCellsBillions.packCellsBillions', call: () => viableCellsBillions({ packCellsBillions: NaN, months: 3, monthlyDecayPct: 21 }) },
    { label: 'viableCellsBillions.months', call: () => viableCellsBillions({ packCellsBillions: 100, months: NaN, monthlyDecayPct: 21 }) },
    { label: 'viableCellsBillions.monthlyDecayPct', call: () => viableCellsBillions({ packCellsBillions: 100, months: 6, monthlyDecayPct: NaN }) },
    // starterExtractGrams — 2
    { label: 'starterExtractGrams.starterVolumeL', call: () => starterExtractGrams({ starterVolumeL: NaN, starterGravitySg: 1.037 }) },
    { label: 'starterExtractGrams.starterGravitySg', call: () => starterExtractGrams({ starterVolumeL: 2, starterGravitySg: NaN }) },
    // starterGrowthRateBPerG — 1 (starterType is non-numeric, out of scope)
    { label: 'starterGrowthRateBPerG.inoculationRateBPerG', call: () => starterGrowthRateBPerG(NaN, 'stirPlate') },
    // starterEndCellsBillions — 3 (starterType is non-numeric, out of scope)
    {
      label: 'starterEndCellsBillions.initialCellsBillions',
      call: () => starterEndCellsBillions({ initialCellsBillions: NaN, starterVolumeL: 2, starterGravitySg: 1.037, starterType: 'stirPlate' }),
    },
    {
      label: 'starterEndCellsBillions.starterVolumeL',
      call: () => starterEndCellsBillions({ initialCellsBillions: 100, starterVolumeL: NaN, starterGravitySg: 1.037, starterType: 'stirPlate' }),
    },
    {
      label: 'starterEndCellsBillions.starterGravitySg',
      call: () => starterEndCellsBillions({ initialCellsBillions: 100, starterVolumeL: 2, starterGravitySg: NaN, starterType: 'stirPlate' }),
    },
    // hopDecayRateConstant — 1
    { label: 'hopDecayRateConstant.percentLostSixMonths', call: () => hopDecayRateConstant(NaN) },
    // hopTemperatureFactor — 1
    { label: 'hopTemperatureFactor.storageTempC', call: () => hopTemperatureFactor(NaN) },
    // alphaAcidAfterStorage — 5
    {
      label: 'alphaAcidAfterStorage.initialAlphaAcidPct',
      call: () => alphaAcidAfterStorage({ initialAlphaAcidPct: NaN, percentLostSixMonths: 0.3, storageTempC: 4, storageFactor: 0.5, days: 180 }),
    },
    {
      label: 'alphaAcidAfterStorage.percentLostSixMonths',
      call: () => alphaAcidAfterStorage({ initialAlphaAcidPct: 10, percentLostSixMonths: NaN, storageTempC: 4, storageFactor: 0.5, days: 180 }),
    },
    {
      label: 'alphaAcidAfterStorage.storageTempC',
      call: () => alphaAcidAfterStorage({ initialAlphaAcidPct: 10, percentLostSixMonths: 0.3, storageTempC: NaN, storageFactor: 0.5, days: 180 }),
    },
    {
      label: 'alphaAcidAfterStorage.storageFactor',
      call: () => alphaAcidAfterStorage({ initialAlphaAcidPct: 10, percentLostSixMonths: 0.3, storageTempC: 4, storageFactor: NaN, days: 180 }),
    },
    {
      label: 'alphaAcidAfterStorage.days',
      call: () => alphaAcidAfterStorage({ initialAlphaAcidPct: 10, percentLostSixMonths: 0.3, storageTempC: 4, storageFactor: 0.5, days: NaN }),
    },
    // dilutionWaterL — 3
    { label: 'dilutionWaterL.volumeL', call: () => dilutionWaterL({ volumeL: NaN, currentSg: 1.06, targetSg: 1.05 }) },
    { label: 'dilutionWaterL.currentSg', call: () => dilutionWaterL({ volumeL: 20, currentSg: NaN, targetSg: 1.05 }) },
    { label: 'dilutionWaterL.targetSg', call: () => dilutionWaterL({ volumeL: 20, currentSg: 1.06, targetSg: NaN }) },
    // dmeToAddKg — 4
    { label: 'dmeToAddKg.volumeL', call: () => dmeToAddKg({ volumeL: NaN, currentSg: 1.045, targetSg: 1.05, dmePotentialSg: 1.045 }) },
    { label: 'dmeToAddKg.currentSg', call: () => dmeToAddKg({ volumeL: 20, currentSg: NaN, targetSg: 1.05, dmePotentialSg: 1.045 }) },
    { label: 'dmeToAddKg.targetSg', call: () => dmeToAddKg({ volumeL: 20, currentSg: 1.045, targetSg: NaN, dmePotentialSg: 1.045 }) },
    { label: 'dmeToAddKg.dmePotentialSg', call: () => dmeToAddKg({ volumeL: 20, currentSg: 1.045, targetSg: 1.05, dmePotentialSg: NaN }) },
    // additionalBoilMinutes — 4
    { label: 'additionalBoilMinutes.volumeL', call: () => additionalBoilMinutes({ volumeL: NaN, currentSg: 1.04, targetSg: 1.05, boilOffRateLPerHour: 3 }) },
    { label: 'additionalBoilMinutes.currentSg', call: () => additionalBoilMinutes({ volumeL: 25, currentSg: NaN, targetSg: 1.05, boilOffRateLPerHour: 3 }) },
    { label: 'additionalBoilMinutes.targetSg', call: () => additionalBoilMinutes({ volumeL: 25, currentSg: 1.04, targetSg: NaN, boilOffRateLPerHour: 3 }) },
    {
      label: 'additionalBoilMinutes.boilOffRateLPerHour',
      call: () => additionalBoilMinutes({ volumeL: 25, currentSg: 1.04, targetSg: 1.05, boilOffRateLPerHour: NaN }),
    },
  ];

  it('has exactly 32 pairs (3+2+3+2+1+3+1+1+5+3+4+4)', () => {
    expect(cases).toHaveLength(32);
  });

  it.each(cases)('$label: NaN in returns NaN out, never throws, never 0 or undefined', ({ call }) => {
    const result = call();
    expect(Number.isNaN(result)).toBe(true);
    expect(result).not.toBe(0);
    expect(result).not.toBeUndefined();
  });

  it('(d) the excluded-pair table is empty this phase — every numeric argument of every §2.1 function is structurally observable', () => {
    // No delegation contract in this phase makes any numeric argument
    // unreadable (unlike M8_P1's refractometerOriginalGravity/finalBrix).
    // The count assertion above (32) is what actually enforces this.
    expect(true).toBe(true);
  });
});

describe('AC-17: degenerate and zero cases, per §2.3', () => {
  it('starterVolumeL: 0 -> extract 0 -> ir Infinity -> the leading guard returns NaN, not 100, not 0', () => {
    const result = starterEndCellsBillions({ initialCellsBillions: 100, starterVolumeL: 0, starterGravitySg: 1.037, starterType: 'stirPlate' });
    expect(Number.isNaN(result)).toBe(true);
  });

  it('starterGrowthRateBPerG(Infinity, type) returns NaN for all three types — not 0', () => {
    for (const type of STARTER_TYPES) {
      expect(Number.isNaN(starterGrowthRateBPerG(Infinity, type))).toBe(true);
    }
  });

  it('starterGrowthRateBPerG(NaN, "simple") returns NaN, not 0.4', () => {
    expect(Number.isNaN(starterGrowthRateBPerG(NaN, 'simple' as StarterType))).toBe(true);
  });

  it('alphaAcidAfterStorage with days:0 and every OTHER argument NaN still returns NaN — the days:0 identity is not an early return', () => {
    const result = alphaAcidAfterStorage({
      initialAlphaAcidPct: NaN,
      percentLostSixMonths: NaN,
      storageTempC: NaN,
      storageFactor: NaN,
      days: 0,
    });
    expect(Number.isNaN(result)).toBe(true);
  });
});
