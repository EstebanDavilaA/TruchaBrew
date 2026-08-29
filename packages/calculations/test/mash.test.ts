import { describe, it, expect } from 'vitest';
import type { EquipmentProfile, MashProfile } from '@truchabrew/shared-types';
import {
  strikeTemperatureC,
  calculateStrikeTemperature,
  strikeTempExceedsEnzymeLimit,
  calculateBoilingPoint,
  calculateAltitudeHopUtilization,
  infusionVolumeL,
  resolveSpargeTemperatureC,
  STRIKE_GRAIN_HEAT_COEFF,
} from '../src';

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

function baseMashProfile(overrides: Partial<MashProfile> = {}): MashProfile {
  return {
    id: 'mash-test',
    name: 'Test Mash',
    targetPh: 5.4,
    spargeTempC: null,
    steps: [],
    ...overrides,
  };
}

describe('AC-6: strikeTemperatureC reads the two P1 fields', () => {
  it('differs only in mashTunHeatCapacityL (0 vs 5) — larger tun mass produces the higher strike temp', () => {
    const base = { targetMashTempC: 67, grainTemperatureC: 20, waterVolumeL: 15, grainWeightKg: 5 };
    const at0 = strikeTemperatureC({ ...base, mashTunHeatCapacityL: 0 });
    const at5 = strikeTemperatureC({ ...base, mashTunHeatCapacityL: 5 });
    expect(at5).toBeGreaterThan(at0);
  });

  it('differs only in grainTemperatureC (10 vs 20) — the colder grain produces the higher strike temp', () => {
    const base = { targetMashTempC: 67, waterVolumeL: 15, grainWeightKg: 5, mashTunHeatCapacityL: 0 };
    const at10 = strikeTemperatureC({ ...base, grainTemperatureC: 10 });
    const at20 = strikeTemperatureC({ ...base, grainTemperatureC: 20 });
    expect(at10).toBeGreaterThan(at20);
  });
});

describe('AC-7: strike temperature reduces to the classic form at zero tun mass', () => {
  it('matches the two-term formula within 1e-9', () => {
    const targetMashTempC = 67;
    const grainTemperatureC = 20;
    const waterVolumeL = 15;
    const grainWeightKg = 5;
    const result = strikeTemperatureC({ targetMashTempC, grainTemperatureC, waterVolumeL, grainWeightKg, mashTunHeatCapacityL: 0 });
    const expected = targetMashTempC + (0.41 / (waterVolumeL / grainWeightKg)) * (targetMashTempC - grainTemperatureC);
    expect(Math.abs(result - expected)).toBeLessThanOrEqual(1e-9);
  });
});

describe('AC-8: strike temperature identity at equal temperatures', () => {
  it('grainTemperatureC === targetMashTempC returns exactly targetMashTempC for any positive water/grain/tun', () => {
    for (const [waterVolumeL, grainWeightKg, mashTunHeatCapacityL] of [
      [15, 5, 0],
      [30, 10, 5],
      [8, 1, 12],
    ]) {
      const result = strikeTemperatureC({
        targetMashTempC: 67,
        grainTemperatureC: 67,
        waterVolumeL,
        grainWeightKg,
        mashTunHeatCapacityL,
      });
      expect(result).toBe(67);
    }
  });
});

describe('AC-9: strike temperature degenerate inputs', () => {
  it('grainWeightKg === 0 returns exactly targetMashTempC', () => {
    const result = strikeTemperatureC({
      targetMashTempC: 67,
      grainTemperatureC: 20,
      waterVolumeL: 15,
      grainWeightKg: 0,
      mashTunHeatCapacityL: 0,
    });
    expect(result).toBe(67);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('waterVolumeL === 0 returns exactly targetMashTempC', () => {
    const result = strikeTemperatureC({
      targetMashTempC: 67,
      grainTemperatureC: 20,
      waterVolumeL: 0,
      grainWeightKg: 5,
      mashTunHeatCapacityL: 0,
    });
    expect(result).toBe(67);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('both zero returns exactly targetMashTempC, no NaN, no Infinity', () => {
    const result = strikeTemperatureC({
      targetMashTempC: 67,
      grainTemperatureC: 20,
      waterVolumeL: 0,
      grainWeightKg: 0,
      mashTunHeatCapacityL: 0,
    });
    expect(result).toBe(67);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('negative grainWeightKg/waterVolumeL also guard (<=0)', () => {
    expect(
      strikeTemperatureC({ targetMashTempC: 67, grainTemperatureC: 20, waterVolumeL: 15, grainWeightKg: -1, mashTunHeatCapacityL: 0 }),
    ).toBe(67);
    expect(
      strikeTemperatureC({ targetMashTempC: 67, grainTemperatureC: 20, waterVolumeL: -1, grainWeightKg: 5, mashTunHeatCapacityL: 0 }),
    ).toBe(67);
  });
});

describe('AC-10: infusion volume degenerate inputs', () => {
  const base = { grainWeightKg: 5, currentMashVolumeL: 20, infusionWaterTempC: 100 };

  it('targetTempC === currentTempC -> 0', () => {
    expect(infusionVolumeL({ ...base, currentTempC: 67, targetTempC: 67 })).toBe(0);
  });

  it('targetTempC < currentTempC -> 0', () => {
    expect(infusionVolumeL({ ...base, currentTempC: 72, targetTempC: 67 })).toBe(0);
  });

  it('infusionWaterTempC === targetTempC -> 0', () => {
    expect(infusionVolumeL({ ...base, currentTempC: 67, targetTempC: 72, infusionWaterTempC: 72 })).toBe(0);
  });

  it('infusionWaterTempC < targetTempC -> 0', () => {
    expect(infusionVolumeL({ ...base, currentTempC: 67, targetTempC: 72, infusionWaterTempC: 70 })).toBe(0);
  });

  it('grainWeightKg === 0 && currentMashVolumeL === 0 -> 0', () => {
    expect(
      infusionVolumeL({ grainWeightKg: 0, currentMashVolumeL: 0, infusionWaterTempC: 100, currentTempC: 67, targetTempC: 72 }),
    ).toBe(0);
  });

  it('none of the above ever produce NaN, Infinity, or a negative result', () => {
    const cases = [
      { ...base, currentTempC: 67, targetTempC: 67 },
      { ...base, currentTempC: 72, targetTempC: 67 },
      { ...base, currentTempC: 67, targetTempC: 72, infusionWaterTempC: 72 },
      { grainWeightKg: 0, currentMashVolumeL: 0, infusionWaterTempC: 100, currentTempC: 67, targetTempC: 72 },
    ];
    for (const c of cases) {
      const result = infusionVolumeL(c);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('AC-11: infusion volume is monotone and correct', () => {
  it('a larger target-temperature gap yields a strictly larger volume, for a fixed grist and mash volume', () => {
    const base = { grainWeightKg: 5, currentMashVolumeL: 20, currentTempC: 52, infusionWaterTempC: 100 };
    const small = infusionVolumeL({ ...base, targetTempC: 60 });
    const large = infusionVolumeL({ ...base, targetTempC: 67 });
    expect(large).toBeGreaterThan(small);
  });

  it('matches a hand-computed reference case within 1e-9', () => {
    const input = { grainWeightKg: 5, currentTempC: 52, targetTempC: 67, infusionWaterTempC: 100, currentMashVolumeL: 20 };
    const result = infusionVolumeL(input);
    const expected = ((67 - 52) * (0.4 * 5 + 20)) / (100 - 67);
    expect(Math.abs(result - expected)).toBeLessThanOrEqual(1e-9);
  });
});

describe('AC-12: resolveSpargeTemperatureC precedence, all four rows', () => {
  it('mashProfile === null -> equipment.spargeTemperatureC', () => {
    const equipment = baseEquipment({ spargeTemperatureC: 76 });
    expect(resolveSpargeTemperatureC(equipment, null)).toBe(76);
  });

  it('mashProfile present, spargeTempC === null -> equipment.spargeTemperatureC', () => {
    const equipment = baseEquipment({ spargeTemperatureC: 76 });
    const mashProfile = baseMashProfile({ spargeTempC: null });
    expect(resolveSpargeTemperatureC(equipment, mashProfile)).toBe(76);
  });

  it('mashProfile present, spargeTempC === 0 -> 0, NOT the equipment value', () => {
    const equipment = baseEquipment({ spargeTemperatureC: 76 });
    const mashProfile = baseMashProfile({ spargeTempC: 0 });
    expect(resolveSpargeTemperatureC(equipment, mashProfile)).toBe(0);
  });

  it('mashProfile present, spargeTempC === 72.5 -> 72.5', () => {
    const equipment = baseEquipment({ spargeTemperatureC: 76 });
    const mashProfile = baseMashProfile({ spargeTempC: 72.5 });
    expect(resolveSpargeTemperatureC(equipment, mashProfile)).toBe(72.5);
  });
});

describe('AC-5: no brewhouse constant literal appears in mash.ts (spot-check via behaviour)', () => {
  it('STRIKE_GRAIN_HEAT_COEFF is 0.41, imported not hardcoded (sanity re-check tied to AC-7)', () => {
    expect(STRIKE_GRAIN_HEAT_COEFF).toBe(0.41);
  });
});

describe('AC-65: Strike temperature is pinned numerically at mashTunHeatCapacityL > 0', () => {
  it('exact values, grain-weight independence, and negative controls', () => {
    // (a) Exact values
    const base = { targetMashTempC: 67, grainTemperatureC: 20, waterVolumeL: 15, grainWeightKg: 5 };
    const at5 = strikeTemperatureC({ ...base, mashTunHeatCapacityL: 5 });
    const at1_5 = strikeTemperatureC({ ...base, mashTunHeatCapacityL: 1.5 });
    const at0 = strikeTemperatureC({ ...base, mashTunHeatCapacityL: 0 });

    expect(Math.abs(at5 - 89.09)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(at1_5 - 78.12333333333333)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(at0 - 73.42333333333333)).toBeLessThanOrEqual(1e-9);

    // (b) The tun term does not scale with grain weight
    const diff5Kg = at5 - at0;
    const base10 = { ...base, grainWeightKg: 10 };
    const diff10Kg = strikeTemperatureC({ ...base10, mashTunHeatCapacityL: 5 }) - strikeTemperatureC({ ...base10, mashTunHeatCapacityL: 0 });

    expect(Math.abs(diff5Kg - diff10Kg)).toBeLessThanOrEqual(1e-9);
    
    const expectedDiff = (5 * (67 - 20)) / 15; // mashTunHeatCapacityL * (targetMashTempC - grainTemperatureC) / waterVolumeL
    expect(Math.abs(diff5Kg - expectedDiff)).toBeLessThanOrEqual(1e-9);

    // (c) Negative controls
    expect(Math.abs(at5 - 71.8175)).toBeGreaterThan(1e-9);
    expect(Math.abs(at5 - 75.56444444444445)).toBeGreaterThan(1e-9);
  });
});

// ---------------------------------------------------------------------------
// M11_P1 AC-5..AC-9: Altitude Boiling Point & Thermal Mass Strike (FEAT-006, BUG-012)
// ---------------------------------------------------------------------------
describe('M11_P1 Physics: Altitude & Thermal Mass Strike (AC-5..AC-9)', () => {
  it('AC-5: Altitude boiling point calculation (0m -> 100°C, 1500m -> 94.975°C)', () => {
    expect(calculateBoilingPoint(0)).toBe(100.0);
    expect(calculateBoilingPoint(1500)).toBeCloseTo(94.975, 3);
  });

  it('AC-6: Altitude hop utilization factor (30 IBU at 1500m scales down to ~28.79 IBU)', () => {
    const adjustedIbu = calculateAltitudeHopUtilization(30, 1500);
    // Factor: 1.0 - 0.008 * 5.025 = 0.9598. 30 * 0.9598 = 28.794
    expect(adjustedIbu).toBeCloseTo(28.794, 2);
  });

  it('AC-7: Thermal mass strike temperature toggle OFF produces standard strike temp (~73.4°C)', () => {
    const input = {
      targetMashTempC: 67,
      grainTemperatureC: 20,
      waterVolumeL: 15,
      grainWeightKg: 5,
      calcStrikeWithThermalMass: false,
      mashTunWeightKg: 5,
      mashTunHeatCapacity: 0.12,
    };
    const result = strikeTemperatureC(input);
    expect(result).toBeCloseTo(73.423, 2);
  });

  it('AC-8: Thermal mass strike temperature toggle ON with 5 kg steel tun increases strike temp accordingly', () => {
    const input = {
      targetMashTempC: 67,
      grainTemperatureC: 20,
      waterVolumeL: 15,
      grainWeightKg: 5,
      calcStrikeWithThermalMass: true,
      mashTunWeightKg: 5,
      mashTunHeatCapacity: 0.12,
    };
    const result = strikeTemperatureC(input);
    expect(result).toBeCloseTo(75.303, 2);
    expect(result).toBeGreaterThan(73.423);
  });

  it('AC-9: Strike temperature enzyme limit guardrail returns strikeTempExceedsEnzymeLimit: true when strike temp > 78.0°C', () => {
    const safeInput = {
      targetMashTempC: 67,
      grainTemperatureC: 20,
      waterVolumeL: 15,
      grainWeightKg: 5,
      calcStrikeWithThermalMass: false,
    };
    const safeRes = calculateStrikeTemperature(safeInput);
    expect(safeRes.strikeTempExceedsEnzymeLimit).toBe(false);
    expect(strikeTempExceedsEnzymeLimit(safeRes.strikeTemperatureC)).toBe(false);

    const extremeInput = {
      targetMashTempC: 72,
      grainTemperatureC: 10,
      waterVolumeL: 12,
      grainWeightKg: 6,
      calcStrikeWithThermalMass: true,
      mashTunWeightKg: 15,
      mashTunHeatCapacity: 0.12,
    };
    const extremeRes = calculateStrikeTemperature(extremeInput);
    expect(extremeRes.strikeTemperatureC).toBeGreaterThan(78.0);
    expect(extremeRes.strikeTempExceedsEnzymeLimit).toBe(true);
    expect(strikeTempExceedsEnzymeLimit(extremeRes.strikeTemperatureC)).toBe(true);
  });
});

