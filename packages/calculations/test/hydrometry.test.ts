import { describe, it, expect } from 'vitest';
import {
  brixToSg,
  sgToBrix,
  hydrometerCorrectedSg,
  refractometerOriginalGravity,
  refractometerFinalGravity,
  DEFAULT_WORT_CORRECTION_FACTOR,
  sgToPlato,
  platoToSg,
  calculateAbvWithStrategy,
  hotWortToColdVolumeL,
  coldToHotWortVolumeL,
  WORT_THERMAL_EXPANSION_COEFF,
} from '../src/index';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AC-1: hydrometry exports are root-exported', () => {
  it('all new hydrometry exports are importable and defined', () => {
    expect(brixToSg).toBeDefined();
    expect(sgToBrix).toBeDefined();
    expect(hydrometerCorrectedSg).toBeDefined();
    expect(refractometerOriginalGravity).toBeDefined();
    expect(refractometerFinalGravity).toBeDefined();
    expect(DEFAULT_WORT_CORRECTION_FACTOR).toBe(1.04);
  });
});

describe('AC-2: brixToSg pinned', () => {
  it('matches the pinned full-precision values', () => {
    expect(brixToSg(12)).toBe(1.0483782421572725);
    expect(brixToSg(10)).toBe(1.0400313056593289);
    expect(brixToSg(20)).toBe(1.0829844579302224);
    expect(brixToSg(6)).toBe(1.023685205094429);
    expect(brixToSg(0)).toBe(1);
  });
});

describe('AC-3: sgToBrix pinned + round-trip', () => {
  it('matches the pinned full-precision values', () => {
    expect(sgToBrix(1.048)).toBe(11.911555280179186);
    expect(sgToBrix(1.05)).toBe(12.387028012500082);
    expect(sgToBrix(1.012)).toBe(3.068185831852702);
  });

  it('round-trips brixToSg(12) to within 0.02 °Bx', () => {
    expect(Math.abs(sgToBrix(brixToSg(12)) - 12)).toBeLessThanOrEqual(0.02);
    expect(sgToBrix(brixToSg(12))).toBe(12.00160085716334);
  });
});

describe('AC-4: Brix and Plato are distinct scales', () => {
  it('sgToBrix and sgToPlato disagree, but by less than 0.05', () => {
    const brix = sgToBrix(1.05);
    const plato = sgToPlato(1.05);
    expect(brix).not.toBe(plato);
    expect(Math.abs(brix - plato)).toBeLessThan(0.05);
  });

  it('sgToPlato/platoToSg have exactly one definition each, in config.ts, and the coefficient sets do not cross-contaminate', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const configSrc = readFileSync(path.join(srcDir, 'config.ts'), 'utf8');
    const hydrometrySrc = readFileSync(path.join(srcDir, 'hydrometry.ts'), 'utf8');

    // Plato coefficients: config.ts only, hydrometry.ts nowhere.
    for (const literal of ['1262.45', '-668.96']) {
      expect(configSrc.includes(literal)).toBe(true);
      expect(hydrometrySrc.includes(literal)).toBe(false);
    }
    // Brix coefficients: hydrometry.ts only, config.ts nowhere.
    for (const literal of ['1262.7794', '182.4601']) {
      expect(hydrometrySrc.includes(literal)).toBe(true);
      expect(configSrc.includes(literal)).toBe(false);
    }

    expect((configSrc.match(/export function sgToPlato/g) ?? []).length).toBe(1);
    expect((configSrc.match(/export function platoToSg/g) ?? []).length).toBe(1);
    expect(platoToSg).toBeDefined();
  });
});

describe('AC-5: hydrometerCorrectedSg pinned (Fahrenheit-domain)', () => {
  it('matches the pinned full-precision values', () => {
    expect(hydrometerCorrectedSg({ readingSg: 1.05, sampleTempC: 30, calibrationTempC: 20 })).toBe(1.0526044557208447);
    expect(hydrometerCorrectedSg({ readingSg: 1.04, sampleTempC: 10, calibrationTempC: 20 })).toBe(1.0384745268783007);
    expect(hydrometerCorrectedSg({ readingSg: 1.06, sampleTempC: 35, calibrationTempC: 20 })).toBe(1.0643198454796021);
    expect(hydrometerCorrectedSg({ readingSg: 1.045, sampleTempC: 28, calibrationTempC: 20 })).toBe(1.0469929861440606);
  });

  it('identity: sample === calibration returns the reading exactly', () => {
    expect(hydrometerCorrectedSg({ readingSg: 1.05, sampleTempC: 20, calibrationTempC: 20 })).toBe(1.05);
  });

  it('direction: warmer-than-calibration corrects up, cooler corrects down', () => {
    const warmer = hydrometerCorrectedSg({ readingSg: 1.05, sampleTempC: 30, calibrationTempC: 20 });
    const cooler = hydrometerCorrectedSg({ readingSg: 1.05, sampleTempC: 10, calibrationTempC: 20 });
    expect(warmer).toBeGreaterThan(1.05);
    expect(cooler).toBeLessThan(1.05);
  });
});

describe('AC-6: negative control — the Celsius-domain reading is not produced', () => {
  it('does not produce the value literal Celsius parameters would give', () => {
    const result = hydrometerCorrectedSg({ readingSg: 1.05, sampleTempC: 30, calibrationTempC: 20 });
    expect(Math.abs(result - 1.0496100146314251)).toBeGreaterThan(1e-9);
  });
});

describe('AC-7: refractometer pinned, WCF applied to both readings', () => {
  it('matches the pinned full-precision values at wcf=1.04', () => {
    const og = refractometerOriginalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1.04 });
    const fg = refractometerFinalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1.04 });
    expect(og).toBe(1.0484590758592531);
    expect(fg).toBe(1.0124896082770896);
  });

  it('matches the pinned full-precision values at wcf=1', () => {
    const og = refractometerOriginalGravity({ initialBrix: 12, finalBrix: 6, wortCorrectionFactor: 1 });
    const fg = refractometerFinalGravity({ initialBrix: 12, finalBrix: 6, wortCorrectionFactor: 1 });
    expect(og).toBe(1.0483782421572725);
    expect(fg).toBe(1.0116792879999998);
  });

  it('changing only wortCorrectionFactor changes both OG and FG', () => {
    const og104 = refractometerOriginalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1.04 });
    const fg104 = refractometerFinalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1.04 });
    const og1 = refractometerOriginalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1 });
    const fg1 = refractometerFinalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1 });
    expect(og104).not.toBe(og1);
    expect(fg104).not.toBe(fg1);
  });
});

describe('AC-8: the alcohol correction actually corrects', () => {
  it('refractometerFinalGravity is strictly less than the naive uncorrected brixToSg by more than 0.010', () => {
    const fg = refractometerFinalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1.04 });
    const naive = brixToSg(6.5 / 1.04);
    expect(fg).toBeLessThan(naive);
    expect(naive - fg).toBeGreaterThan(0.01);
  });

  it('derived ABV and apparent attenuation are inside a plausible ale band', () => {
    const og = refractometerOriginalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1.04 });
    const fg = refractometerFinalGravity({ initialBrix: 12.5, finalBrix: 6.5, wortCorrectionFactor: 1.04 });
    const abv = calculateAbvWithStrategy(og, fg, 'simple');
    const apparentAttenuation = ((og - fg) / (og - 1)) * 100;
    expect(abv).toBeCloseTo(4.7209926201589685, 9);
    expect(apparentAttenuation).toBeCloseTo(74.22648274728768, 9);
    expect(abv).toBeGreaterThan(3.5);
    expect(abv).toBeLessThan(6);
    expect(apparentAttenuation).toBeGreaterThan(65);
    expect(apparentAttenuation).toBeLessThan(85);
  });
});

describe('AC-9: refractometer degenerate cases', () => {
  it('does not throw and returns the finite non-degenerate cubic value at Bf === Bi', () => {
    let result: number = NaN;
    expect(() => {
      result = refractometerFinalGravity({ initialBrix: 12, finalBrix: 12, wortCorrectionFactor: 1 });
    }).not.toThrow();
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(1.040678704);
  });

  it('{0,0,1} returns finite 1', () => {
    expect(refractometerFinalGravity({ initialBrix: 0, finalBrix: 0, wortCorrectionFactor: 1 })).toBe(1);
  });

  it('wortCorrectionFactor: 0 returns NaN for both OG and FG, no guard', () => {
    expect(Number.isNaN(refractometerOriginalGravity({ initialBrix: 12, finalBrix: 6, wortCorrectionFactor: 0 }))).toBe(true);
    expect(Number.isNaN(refractometerFinalGravity({ initialBrix: 12, finalBrix: 6, wortCorrectionFactor: 0 }))).toBe(true);
  });
});

describe('AC-11: non-finite passthrough over structurally observable arguments (10 of 14 pairs — the other 4 pressure pairs live in pressure.test.ts, AC-11)', () => {
  const cases: Array<[string, () => number]> = [
    ['brixToSg', () => brixToSg(NaN)],
    ['sgToBrix', () => sgToBrix(NaN)],
    ['hydrometerCorrectedSg (readingSg)', () => hydrometerCorrectedSg({ readingSg: NaN, sampleTempC: 20, calibrationTempC: 20 })],
    ['hydrometerCorrectedSg (sampleTempC)', () => hydrometerCorrectedSg({ readingSg: 1.05, sampleTempC: NaN, calibrationTempC: 20 })],
    ['hydrometerCorrectedSg (calibrationTempC)', () => hydrometerCorrectedSg({ readingSg: 1.05, sampleTempC: 20, calibrationTempC: NaN })],
    [
      'refractometerOriginalGravity (initialBrix)',
      () => refractometerOriginalGravity({ initialBrix: NaN, finalBrix: 6, wortCorrectionFactor: 1.04 }),
    ],
    [
      'refractometerOriginalGravity (wortCorrectionFactor)',
      () => refractometerOriginalGravity({ initialBrix: 12, finalBrix: 6, wortCorrectionFactor: NaN }),
    ],
    [
      'refractometerFinalGravity (initialBrix)',
      () => refractometerFinalGravity({ initialBrix: NaN, finalBrix: 6, wortCorrectionFactor: 1.04 }),
    ],
    [
      'refractometerFinalGravity (finalBrix)',
      () => refractometerFinalGravity({ initialBrix: 12, finalBrix: NaN, wortCorrectionFactor: 1.04 }),
    ],
    [
      'refractometerFinalGravity (wortCorrectionFactor)',
      () => refractometerFinalGravity({ initialBrix: 12, finalBrix: 6, wortCorrectionFactor: NaN }),
    ],
  ];

  it.each(cases)('%s returns NaN, does not throw, and is not 0 or undefined', (_name, fn) => {
    let result: number | undefined;
    expect(() => {
      result = fn();
    }).not.toThrow();
    expect(Number.isNaN(result)).toBe(true);
    expect(result).not.toBe(0);
    expect(result).not.toBeUndefined();
  });

  // AC-11(c): the excluded pair, enumerated rather than silently omitted.
  // §2.1 binds refractometerOriginalGravity to brixToSg(initialBrix /
  // wortCorrectionFactor), which never reads finalBrix — so finalBrix is
  // structurally unobservable by this function, and a NaN there must NOT
  // propagate. Asserted as the opposite of the passthrough requirement above
  // so a future change making refractometerOriginalGravity observe
  // finalBrix breaks this row loudly rather than passing unnoticed.
  it('refractometerOriginalGravity (finalBrix) — excluded pair: finalBrix is not structurally observable, so NaN there does NOT propagate', () => {
    const result = refractometerOriginalGravity({ initialBrix: 12, finalBrix: NaN, wortCorrectionFactor: 1.04 });
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeCloseTo(1.046441535179445, 9);
    expect(result).toBe(brixToSg(12 / 1.04));
  });
});

describe('AC-14 (M15_P1): hot wort thermal expansion', () => {
  it('WORT_THERMAL_EXPANSION_COEFF is 0.04', () => {
    expect(WORT_THERMAL_EXPANSION_COEFF).toBe(0.04);
  });

  it('hotWortToColdVolumeL divides by (1 + coeff) and rounds to 2 decimals', () => {
    expect(hotWortToColdVolumeL(23)).toBe(22.12);
    expect(hotWortToColdVolumeL(20.8)).toBe(20);
  });

  it('coldToHotWortVolumeL multiplies by (1 + coeff) and rounds to 2 decimals', () => {
    expect(coldToHotWortVolumeL(20)).toBe(20.8);
    expect(coldToHotWortVolumeL(22.12)).toBe(23);
  });

  it('round-trip: hot -> cold -> hot recovers the original to within rounding', () => {
    const hot = 25;
    const cold = hotWortToColdVolumeL(hot);
    const backToHot = coldToHotWortVolumeL(cold);
    expect(Math.abs(backToHot - hot)).toBeLessThanOrEqual(0.02);
  });

  it('a custom expansionCoeff is honoured by both directions', () => {
    expect(hotWortToColdVolumeL(21, 0.05)).toBe(20);
    expect(coldToHotWortVolumeL(20, 0.05)).toBe(21);
  });

  it('degenerate guards: <= 0 or NaN return 0 for both directions, no throw', () => {
    expect(hotWortToColdVolumeL(0)).toBe(0);
    expect(hotWortToColdVolumeL(-5)).toBe(0);
    expect(hotWortToColdVolumeL(NaN)).toBe(0);
    expect(coldToHotWortVolumeL(0)).toBe(0);
    expect(coldToHotWortVolumeL(-5)).toBe(0);
    expect(coldToHotWortVolumeL(NaN)).toBe(0);
  });
});
