import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dilutionWaterL, dmeToAddKg, additionalBoilMinutes, sgToPointsExact, kgToLb, gravityAtVolume } from '../src';

// Every pinned value below was independently recomputed from the spec's
// §2.1 formulas (not copied from the spec text, not read back from this
// implementation) before this file was written.

describe('AC-11: dilutionWaterL pinned', () => {
  it('20L, 1.060 -> 1.050 is 4L within 1e-9 (the true value is 4.0000000000000036 — toBe(4) is forbidden)', () => {
    const result = dilutionWaterL({ volumeL: 20, currentSg: 1.06, targetSg: 1.05 });
    expect(Math.abs(result - 4)).toBeLessThan(1e-9);
    expect(result).not.toBe(4);
  });

  it('23L, 1.055 -> 1.048', () => {
    expect(Math.abs(dilutionWaterL({ volumeL: 23, currentSg: 1.055, targetSg: 1.048 }) - 3.3541666666666137)).toBeLessThan(1e-9);
  });

  it('equal gravities returns 0 within 1e-9', () => {
    expect(Math.abs(dilutionWaterL({ volumeL: 20, currentSg: 1.05, targetSg: 1.05 }))).toBeLessThan(1e-9);
  });

  it('identity: the diluted result checks out against the imported sgToPointsExact', () => {
    const volumeL = 20;
    const currentSg = 1.06;
    const targetSg = 1.05;
    const water = dilutionWaterL({ volumeL, currentSg, targetSg });
    const lhs = (volumeL + water) * sgToPointsExact(targetSg);
    const rhs = volumeL * sgToPointsExact(currentSg);
    expect(Math.abs(lhs - rhs)).toBeLessThan(1e-9);
  });
});

describe('AC-12: dmeToAddKg pinned, using the engine\'s own gravity basis', () => {
  it('pinned value', () => {
    const result = dmeToAddKg({ volumeL: 20, currentSg: 1.045, targetSg: 1.05, dmePotentialSg: 1.045 });
    expect(Math.abs(result - 0.26628121349207723)).toBeLessThan(1e-9);
  });

  it('equal gravities returns 0 within 1e-9', () => {
    expect(Math.abs(dmeToAddKg({ volumeL: 20, currentSg: 1.045, targetSg: 1.045, dmePotentialSg: 1.045 }))).toBeLessThan(1e-9);
  });

  it('basis identity: adding that DME mass, evaluated through the imported gravityAtVolume/kgToLb/sgToPointsExact, raises the gravity contribution by 0.005 within 1e-9', () => {
    const dmeKg = dmeToAddKg({ volumeL: 20, currentSg: 1.045, targetSg: 1.05, dmePotentialSg: 1.045 });
    const gAdded = gravityAtVolume(kgToLb(dmeKg) * sgToPointsExact(1.045), 100, 20);
    expect(Math.abs(gAdded - 1.005)).toBeLessThan(1e-9);
  });

  it('gravityCorrection.ts contains no 2.20462, 0.264172, or 1000 literal', () => {
    const src = readFileSync(new URL('../src/gravityCorrection.ts', import.meta.url), 'utf8');
    expect(src.includes('2.20462')).toBe(false);
    expect(src.includes('0.264172')).toBe(false);
    expect(src.includes('1000')).toBe(false);
  });
});

describe('AC-13: additionalBoilMinutes pinned', () => {
  it('pinned value', () => {
    const result = additionalBoilMinutes({ volumeL: 25, currentSg: 1.04, targetSg: 1.05, boilOffRateLPerHour: 3 });
    expect(Math.abs(result - 100)).toBeLessThan(1e-9);
  });

  it('equal gravities returns 0 within 1e-9', () => {
    expect(Math.abs(additionalBoilMinutes({ volumeL: 25, currentSg: 1.04, targetSg: 1.04, boilOffRateLPerHour: 3 }))).toBeLessThan(1e-9);
  });

  it('boilOffRateLPerHour: 0 returns Infinity for unequal gravities, NaN for equal gravities — no guard', () => {
    const infResult = additionalBoilMinutes({ volumeL: 25, currentSg: 1.04, targetSg: 1.05, boilOffRateLPerHour: 0 });
    expect(Number.isFinite(infResult)).toBe(false);
    expect(Number.isNaN(infResult)).toBe(false);
    expect(infResult).toBe(Infinity);

    const nanResult = additionalBoilMinutes({ volumeL: 25, currentSg: 1.04, targetSg: 1.04, boilOffRateLPerHour: 0 });
    expect(Number.isNaN(nanResult)).toBe(true);
  });
});

describe('AC-14: signs are meaningful and nothing is clamped', () => {
  it('dmeToAddKg with target below current is exactly the negation of AC-12\'s value', () => {
    const positive = dmeToAddKg({ volumeL: 20, currentSg: 1.045, targetSg: 1.05, dmePotentialSg: 1.045 });
    const negative = dmeToAddKg({ volumeL: 20, currentSg: 1.05, targetSg: 1.045, dmePotentialSg: 1.045 });
    expect(Math.abs(negative - -positive)).toBeLessThan(1e-9);
    expect(negative).toBeLessThan(0);
  });

  it('additionalBoilMinutes with target below current is negative and pinned', () => {
    const result = additionalBoilMinutes({ volumeL: 25, currentSg: 1.05, targetSg: 1.04, boilOffRateLPerHour: 3 });
    expect(Math.abs(result - -125)).toBeLessThan(1e-9);
  });

  it('dilutionWaterL with target above current is negative', () => {
    const result = dilutionWaterL({ volumeL: 20, currentSg: 1.05, targetSg: 1.06 });
    expect(result).toBeLessThan(0);
    expect(Math.abs(result - -3.3333333333333335)).toBeLessThan(1e-9);
  });

  it('no Math.max/Math.abs clamp is applied to any of the three outputs', () => {
    const src = readFileSync(new URL('../src/gravityCorrection.ts', import.meta.url), 'utf8');
    expect(src.includes('Math.max')).toBe(false);
    expect(src.includes('Math.abs')).toBe(false);
  });
});
