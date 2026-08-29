// M18_P1 spec §2.1 — unit tests for deriveMeasurementTargets (AC-18..AC-21).
import { describe, it, expect } from 'vitest';
import type { CalculatedStats, EquipmentProfile } from '@truchabrew/shared-types';
import { deriveMeasurementTargets } from '../src';

function baseEquipment(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
    id: 'eq-1',
    name: 'Test Rig',
    batchSizeL: 20,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 72,
    mashEfficiencyPct: 75,
    boilOffRateLPerHour: 3,
    trubChillerLossL: 1,
    hopUtilizationPct: 100,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3,
    grainAbsorptionLPerKg: 1,
    hopstandUtilizationFactor: 0.2,
    hopstandTemperatureC: 79,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 20,
    notes: '',
    ...overrides,
  };
}

function baseStats(overrides: Partial<CalculatedStats> = {}): CalculatedStats {
  return {
    og: 1.0472,
    fg: 1.012,
    abv: 4.6,
    ibu: 34,
    srm: 8,
    ebc: 16,
    buGu: 0.6,
    rbr: 0.5,
    totalGrainKg: 5,
    totalHopG: 70,
    mashWaterL: 15,
    spargeWaterL: 10,
    totalWaterL: 25,
    preBoilVolumeL: 34.65,
    preBoilGravity: 1.0398,
    attenuationPct: 75,
    postBoilVolumeL: 21,
    ...overrides,
  };
}

describe('AC-18: happy path', () => {
  it('all five targets non-null with the exact rounding shapes and correct source tags', () => {
    const targets = deriveMeasurementTargets({
      stats: baseStats(),
      equipment: baseEquipment(),
      predictedMashPh: 5.25,
      mashProfileTargetPh: 5.4,
    });

    expect(targets.preBoilGravity.value).toBeCloseTo(1.04, 2);
    expect(targets.preBoilGravity.placeholder).toBe('1.040');
    expect(targets.preBoilGravity.source).toBe('stats');

    expect(targets.og.placeholder).toBe('1.047');
    expect(targets.og.source).toBe('stats');

    expect(targets.mashPh.placeholder).toBe('5.25');
    expect(targets.mashPh.source).toBe('waterChemistry');

    expect(targets.boilSizeL.placeholder).toBe('34.6');
    expect(targets.boilSizeL.source).toBe('stats');

    expect(targets.boilTimeMin.placeholder).toBe('60');
    expect(targets.boilTimeMin.source).toBe('equipment');
  });
});

describe('AC-19: mash pH precedence, all three branches', () => {
  it('waterChemistry wins when predictedMashPh is non-null', () => {
    const targets = deriveMeasurementTargets({ stats: baseStats(), equipment: baseEquipment(), predictedMashPh: 5.31, mashProfileTargetPh: 5.4 });
    expect(targets.mashPh.value).toBeCloseTo(5.31, 9);
    expect(targets.mashPh.source).toBe('waterChemistry');
  });

  it('falls back to mashProfile when predictedMashPh is null', () => {
    const targets = deriveMeasurementTargets({ stats: baseStats(), equipment: baseEquipment(), predictedMashPh: null, mashProfileTargetPh: 5.4 });
    expect(targets.mashPh.value).toBeCloseTo(5.4, 9);
    expect(targets.mashPh.source).toBe('mashProfile');
  });

  it('returns the null triple when both are null', () => {
    const targets = deriveMeasurementTargets({ stats: baseStats(), equipment: baseEquipment(), predictedMashPh: null, mashProfileTargetPh: null });
    expect(targets.mashPh).toEqual({ field: 'mashPh', value: null, placeholder: null, source: null });
  });
});

describe('AC-20: stats === null degenerate input', () => {
  it('preBoilGravity/boilSizeL/og null; boilTimeMin still resolves; no throw', () => {
    expect(() =>
      deriveMeasurementTargets({ stats: null, equipment: baseEquipment(), predictedMashPh: null, mashProfileTargetPh: null }),
    ).not.toThrow();
    const targets = deriveMeasurementTargets({ stats: null, equipment: baseEquipment({ boilTimeMin: 75 }), predictedMashPh: null, mashProfileTargetPh: null });
    expect(targets.preBoilGravity).toEqual({ field: 'preBoilGravity', value: null, placeholder: null, source: null });
    expect(targets.boilSizeL).toEqual({ field: 'boilSizeL', value: null, placeholder: null, source: null });
    expect(targets.og).toEqual({ field: 'og', value: null, placeholder: null, source: null });
    expect(targets.boilTimeMin).toEqual({ field: 'boilTimeMin', value: 75, placeholder: '75', source: 'equipment' });
  });
});

describe('AC-21: null-triple invariant, both directions', () => {
  it('value === null iff placeholder === null iff source === null across a table of inputs', () => {
    const table = [
      { stats: baseStats(), equipment: baseEquipment(), predictedMashPh: 5.2, mashProfileTargetPh: null },
      { stats: null, equipment: baseEquipment(), predictedMashPh: null, mashProfileTargetPh: null },
      { stats: baseStats(), equipment: baseEquipment(), predictedMashPh: null, mashProfileTargetPh: null },
      { stats: baseStats(), equipment: baseEquipment(), predictedMashPh: null, mashProfileTargetPh: 5.6 },
    ];
    for (const input of table) {
      const targets = deriveMeasurementTargets(input);
      for (const t of Object.values(targets)) {
        const nulls = [t.value === null, t.placeholder === null, t.source === null];
        expect(nulls.every(Boolean) || nulls.every((n) => n === false)).toBe(true);
      }
    }
  });
});
