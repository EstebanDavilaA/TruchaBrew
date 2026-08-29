import { describe, it, expect } from 'vitest';
import { hopDecayRateConstant, hopTemperatureFactor, alphaAcidAfterStorage, HOP_STORAGE_FACTORS, fahrenheitToCelsius } from '../src';

// Every pinned value below was independently recomputed from the spec's
// §2.1 formulas (not copied from the spec text, not read back from this
// implementation) before this file was written.

describe('AC-1: hops.ts exports', () => {
  it('HOP_STORAGE_FACTORS is pinned', () => {
    expect(HOP_STORAGE_FACTORS).toEqual({ nitrogenFlushedOxygenBarrier: 0.5, sealedNotEvacuated: 0.75, looseInAir: 1.0 });
  });
});

describe('AC-8: hopDecayRateConstant pinned AND cross-checked against Garetz\'s published table value', () => {
  it('pinned values', () => {
    expect(hopDecayRateConstant(0.5)).toBe(0.003850817669777474);
    expect(hopDecayRateConstant(0.3)).toBe(0.0019815274663262912);
    expect(hopDecayRateConstant(0.2)).toBe(0.001239686396190054);
    // -ln(1-0)/180 is mathematically zero but computes as -0 in IEEE 754
    // (Math.log(1) === 0, and -0/180 === -0); Math.abs normalizes the sign
    // so this assertion checks the VALUE, not incidental float sign bit.
    expect(Math.abs(hopDecayRateConstant(0))).toBe(0);
  });

  it('published-anchor check: k(0.5) rounded to 5dp === 0.00385 (Garetz, Cascade, 50% six-month loss)', () => {
    expect(hopDecayRateConstant(0.5).toFixed(5)).toBe('0.00385');
  });

  it('percentLostSixMonths: 1 -> Infinity; > 1 -> NaN (ln of a negative)', () => {
    expect(hopDecayRateConstant(1)).toBe(Infinity);
    expect(Number.isNaN(hopDecayRateConstant(1.5))).toBe(true);
  });
});

describe('AC-9: hopTemperatureFactor pinned, normalised at the reference, within 1.1% of the published table', () => {
  it('TF(20) === 1 exactly (the reference temperature)', () => {
    expect(hopTemperatureFactor(20)).toBe(1);
  });

  it('doubling-per-15°C property at both ends', () => {
    expect(Math.abs(hopTemperatureFactor(5) - 0.5)).toBeLessThan(1e-9);
    expect(Math.abs(hopTemperatureFactor(35) - 2)).toBeLessThan(1e-9);
  });

  it('pinned interior values', () => {
    expect(hopTemperatureFactor(4)).toBe(0.4774208019552083);
    expect(hopTemperatureFactor(-18)).toBe(0.17273910999597203);
  });

  it('published-anchor check: TF(F2C(10°F)) is pinned AND within 0.01 of Garetz\'s published ~0.228', () => {
    const tf = hopTemperatureFactor(fahrenheitToCelsius(10));
    expect(tf).toBe(0.22560201395017815);
    expect(Math.abs(tf - 0.228)).toBeLessThan(0.01);
  });
});

describe('AC-10: alphaAcidAfterStorage pinned, plus two self-consistency identities', () => {
  it('worked example pinned', () => {
    const result = alphaAcidAfterStorage({
      initialAlphaAcidPct: 10,
      percentLostSixMonths: 0.3,
      storageTempC: 4,
      storageFactor: HOP_STORAGE_FACTORS.nitrogenFlushedOxygenBarrier,
      days: 180,
    });
    expect(result).toBe(9.183818475722585);
  });

  it('Identity 1 — the definition of percentLost: 50% loss at 20°C over 180 days halves the input exactly', () => {
    const result = alphaAcidAfterStorage({
      initialAlphaAcidPct: 10,
      percentLostSixMonths: 0.5,
      storageTempC: 20,
      storageFactor: 1.0,
      days: 180,
    });
    expect(Math.abs(result - 5)).toBeLessThan(1e-9);
  });

  it('Identity 2 — days: 0 returns initialAlphaAcidPct exactly, for every combination of the other arguments', () => {
    const combos = [
      { initialAlphaAcidPct: 10, percentLostSixMonths: 0.3, storageTempC: 4, storageFactor: 0.5, days: 0 },
      { initialAlphaAcidPct: 5, percentLostSixMonths: 0.2, storageTempC: 30, storageFactor: 1.0, days: 0 },
      { initialAlphaAcidPct: 15, percentLostSixMonths: 0.6, storageTempC: -10, storageFactor: 0.75, days: 0 },
    ];
    for (const combo of combos) {
      expect(alphaAcidAfterStorage(combo)).toBe(combo.initialAlphaAcidPct);
    }
  });

  it('monotonicity: strictly decreases as days increases, strictly increases as storageTempC decreases', () => {
    const base = { initialAlphaAcidPct: 10, percentLostSixMonths: 0.3, storageFactor: 0.5 };
    const d0 = alphaAcidAfterStorage({ ...base, storageTempC: 20, days: 0 });
    const d90 = alphaAcidAfterStorage({ ...base, storageTempC: 20, days: 90 });
    const d180 = alphaAcidAfterStorage({ ...base, storageTempC: 20, days: 180 });
    expect(d0).toBeGreaterThan(d90);
    expect(d90).toBeGreaterThan(d180);

    const warm = alphaAcidAfterStorage({ ...base, storageTempC: 20, days: 90 });
    const cold = alphaAcidAfterStorage({ ...base, storageTempC: 0, days: 90 });
    expect(cold).toBeGreaterThan(warm);
  });

  it('no clamp: percentLostSixMonths: 1 returns 0, not NaN', () => {
    const result = alphaAcidAfterStorage({ initialAlphaAcidPct: 10, percentLostSixMonths: 1, storageTempC: 20, storageFactor: 1, days: 180 });
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });
});
