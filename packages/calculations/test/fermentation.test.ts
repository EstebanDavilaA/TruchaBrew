import { describe, it, expect } from 'vitest';
import {
  sortReadings,
  latestGravityReading,
  resolveOriginalGravity,
  calculateFermentationProgress,
  buildFermentationChartModel,
  type FermentationReadingPoint,
} from '../src';

function reading(overrides: Partial<FermentationReadingPoint> = {}): FermentationReadingPoint {
  return {
    id: 'r-1',
    readingTime: '2026-08-01T00:00:00.000Z',
    sg: null,
    tempC: null,
    ...overrides,
  };
}

describe('AC-4: resolveOriginalGravity precedence is !== null, not falsy', () => {
  it('measuredOg present -> measured', () => {
    expect(resolveOriginalGravity(1.056, 1.052)).toEqual({ og: 1.056, source: 'measured' });
  });
  it('measuredOg null -> estimated', () => {
    expect(resolveOriginalGravity(null, 1.052)).toEqual({ og: 1.052, source: 'estimated' });
  });
  it('measuredOg === 0 -> measured (a stored 0 is a present value, not absence)', () => {
    expect(resolveOriginalGravity(0, 1.052)).toEqual({ og: 0, source: 'measured' });
  });
});

describe('AC-5: sortReadings order, tie-break and purity', () => {
  it('sorts ascending by readingTime', () => {
    const input = [
      reading({ id: 'c', readingTime: '2026-08-03T00:00:00.000Z' }),
      reading({ id: 'a', readingTime: '2026-08-01T00:00:00.000Z' }),
      reading({ id: 'b', readingTime: '2026-08-02T00:00:00.000Z' }),
    ];
    const result = sortReadings(input);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('two readings sharing a readingTime come back ordered by id ascending', () => {
    const input = [
      reading({ id: 'zeta', readingTime: '2026-08-01T00:00:00.000Z' }),
      reading({ id: 'alpha', readingTime: '2026-08-01T00:00:00.000Z' }),
    ];
    const result = sortReadings(input);
    expect(result.map((r) => r.id)).toEqual(['alpha', 'zeta']);
  });

  it('returns a NEW array and does not mutate the input order', () => {
    const input = [
      reading({ id: 'b', readingTime: '2026-08-02T00:00:00.000Z' }),
      reading({ id: 'a', readingTime: '2026-08-01T00:00:00.000Z' }),
    ];
    const originalOrder = input.map((r) => r.id);
    const result = sortReadings(input);
    expect(result).not.toBe(input);
    expect(input.map((r) => r.id)).toEqual(originalOrder);
  });

  it('an unparseable readingTime sorts last', () => {
    const input = [
      reading({ id: 'garbage', readingTime: 'not-a-date' }),
      reading({ id: 'a', readingTime: '2026-08-01T00:00:00.000Z' }),
    ];
    const result = sortReadings(input);
    expect(result.map((r) => r.id)).toEqual(['a', 'garbage']);
  });
});

describe('AC-6: latestGravityReading skips gravity-less readings', () => {
  it('returns the last gravity-bearing reading, not the last reading overall', () => {
    const t1 = reading({ id: 't1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.048 });
    const t2 = reading({ id: 't2', readingTime: '2026-08-02T00:00:00.000Z', tempC: 19, sg: null });
    const t3 = reading({ id: 't3', readingTime: '2026-08-03T00:00:00.000Z', tempC: 18, sg: null });
    expect(latestGravityReading([t1, t2, t3])?.id).toBe('t1');
  });

  it('returns null for an empty array', () => {
    expect(latestGravityReading([])).toBeNull();
  });

  it('returns null when every reading has sg === null', () => {
    const readings = [reading({ id: 'a', tempC: 19 }), reading({ id: 'b', tempC: 20 })];
    expect(latestGravityReading(readings)).toBeNull();
  });

  it('two same-time gravity readings: the id-ascending-last one wins', () => {
    const a = reading({ id: 'a', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.04 });
    const z = reading({ id: 'z', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.05 });
    expect(latestGravityReading([z, a])?.id).toBe('z');
  });
});

describe('AC-7: no-gravity progress contract', () => {
  it('readings: [] -> hasGravityReading false, keys exactly [hasGravityReading]', () => {
    const result = calculateFermentationProgress({ readings: [], measuredOg: null, estimatedOg: 1.05, fermentationStartDate: null });
    expect(result.hasGravityReading).toBe(false);
    expect(Object.keys(result)).toEqual(['hasGravityReading']);
  });

  it('readings all sg === null -> same contract', () => {
    const readings = [reading({ id: 'a', tempC: 19 }), reading({ id: 'b', tempC: 20 })];
    const result = calculateFermentationProgress({ readings, measuredOg: null, estimatedOg: 1.05, fermentationStartDate: null });
    expect(result.hasGravityReading).toBe(false);
    expect(Object.keys(result)).toEqual(['hasGravityReading']);
  });
});

describe('AC-8: progress happy path is pinned numerically', () => {
  const readings = [reading({ id: 'r1', readingTime: '2026-08-03T18:00:00.000Z', sg: 1.012 })];
  const fermentationStartDate = '2026-08-01T12:00:00.000Z';

  it('measuredOg present: og=1.056, source=measured, attenuation=78.57142857142857, elapsed=54', () => {
    const result = calculateFermentationProgress({ readings, measuredOg: 1.056, estimatedOg: 1.052, fermentationStartDate });
    if (!result.hasGravityReading) throw new Error('expected hasGravityReading true');
    expect(result.originalGravity).toBe(1.056);
    expect(result.originalGravitySource).toBe('measured');
    expect(result.latestSg).toBe(1.012);
    expect(Math.abs(result.apparentAttenuationPct - 78.57142857142857)).toBeLessThanOrEqual(1e-9);
    expect(result.elapsedHours).toBe(54);
  });

  it('measuredOg null: og=1.052, source=estimated, attenuation=76.92307692307692', () => {
    const result = calculateFermentationProgress({ readings, measuredOg: null, estimatedOg: 1.052, fermentationStartDate });
    if (!result.hasGravityReading) throw new Error('expected hasGravityReading true');
    expect(result.originalGravity).toBe(1.052);
    expect(result.originalGravitySource).toBe('estimated');
    expect(Math.abs(result.apparentAttenuationPct - 76.92307692307692)).toBeLessThanOrEqual(1e-9);
  });
});

describe('AC-9: attenuation is reused and unclamped', () => {
  it('a reading above OG yields a negative apparentAttenuationPct, not 0', () => {
    const readings = [reading({ id: 'r1', sg: 1.06 })];
    const result = calculateFermentationProgress({ readings, measuredOg: null, estimatedOg: 1.052, fermentationStartDate: null });
    if (!result.hasGravityReading) throw new Error('expected hasGravityReading true');
    expect(result.apparentAttenuationPct).toBeLessThan(0);
    expect(Math.abs(result.apparentAttenuationPct - -15.384615384615385)).toBeLessThanOrEqual(1e-9);
  });

  it('sg === og yields exactly 0', () => {
    const readings = [reading({ id: 'r1', sg: 1.052 })];
    const result = calculateFermentationProgress({ readings, measuredOg: null, estimatedOg: 1.052, fermentationStartDate: null });
    if (!result.hasGravityReading) throw new Error('expected hasGravityReading true');
    expect(result.apparentAttenuationPct).toBe(0);
  });

  it('fermentation.ts contains no second attenuation implementation and imports apparentAttenuationPct from ./brewingMath', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/fermentation.ts'), 'utf-8');
    expect(source).not.toMatch(/og - fg|\(og - 1\)|131\.25|76\.08/);
    expect(source).toMatch(/import \{ apparentAttenuationPct \} from '\.\/brewingMath';/);
  });
});

describe('AC-10: t0 precedence and negative elapsed time', () => {
  it('fermentationStartDate non-null, earlier than first reading -> negative elapsedHours, t0 is the start date', () => {
    const readings = [reading({ id: 'r1', readingTime: '2026-08-01T06:00:00.000Z', sg: 1.05 })];
    const fermentationStartDate = '2026-08-01T12:00:00.000Z'; // AFTER the reading
    const result = calculateFermentationProgress({ readings, measuredOg: null, estimatedOg: 1.05, fermentationStartDate });
    if (!result.hasGravityReading) throw new Error('expected hasGravityReading true');
    expect(result.elapsedHours).toBeLessThan(0);
    expect(result.elapsedHours).toBe(-6);

    const model = buildFermentationChartModel({ readings, fermentationStartDate });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    expect(model.t0).toBe(fermentationStartDate);
    expect(model.points[0].elapsedHours).toBeLessThan(0);
    expect(model.points[0].elapsedHours).toBe(-6);
  });

  it('fermentationStartDate null -> t0 is the earliest reading, that point elapsedHours is exactly 0', () => {
    const readings = [
      reading({ id: 'r1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.05 }),
      reading({ id: 'r2', readingTime: '2026-08-02T00:00:00.000Z', sg: 1.04 }),
    ];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    expect(model.t0).toBe('2026-08-01T00:00:00.000Z');
    expect(model.points[0].elapsedHours).toBe(0);
  });
});

describe('AC-11: empty chart contract', () => {
  it('readings: [] -> hasPoints false, keys exactly [hasPoints]', () => {
    const result = buildFermentationChartModel({ readings: [], fermentationStartDate: null });
    expect(result.hasPoints).toBe(false);
    expect(Object.keys(result)).toEqual(['hasPoints']);
  });

  it('readings: [], fermentationStartDate non-null -> still hasPoints false (a start date alone is not a point)', () => {
    const result = buildFermentationChartModel({ readings: [], fermentationStartDate: '2026-08-01T00:00:00.000Z' });
    expect(result.hasPoints).toBe(false);
    expect(Object.keys(result)).toEqual(['hasPoints']);
  });
});

describe('AC-12: single-reading degenerate axes, exact pads', () => {
  it('one reading with sg only: timeAxis [-1,1], gravityAxis [1.043,1.053], temperatureAxis null', () => {
    const readings = [reading({ id: 'r1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.048, tempC: null })];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    expect(model.timeAxis).toEqual({ min: -1, max: 1, ticks: [-1, -0.5, 0, 0.5, 1] });
    expect(model.gravityAxis).not.toBeNull();
    expect(Math.abs(model.gravityAxis!.min - 1.043)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(model.gravityAxis!.max - 1.053)).toBeLessThanOrEqual(1e-9);
    expect(model.temperatureAxis).toBeNull();

    // Sweep every numeric field for NaN/Infinity.
    const numbers = [
      model.timeAxis.min, model.timeAxis.max, ...model.timeAxis.ticks,
      model.gravityAxis!.min, model.gravityAxis!.max, ...model.gravityAxis!.ticks,
      ...model.points.map((p) => p.elapsedHours),
    ];
    for (const n of numbers) {
      expect(Number.isNaN(n)).toBe(false);
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('one reading with tempC only: temperatureAxis [18,20], gravityAxis null', () => {
    const readings = [reading({ id: 'r1', readingTime: '2026-08-01T00:00:00.000Z', sg: null, tempC: 19 })];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    expect(model.temperatureAxis).toEqual({ min: 18, max: 20, ticks: [18, 18.5, 19, 19.5, 20] });
    expect(model.gravityAxis).toBeNull();
  });
});

describe('AC-13: ticks are exactly five, evenly spaced, endpoints exact', () => {
  function assertTicks(axis: { min: number; max: number; ticks: number[] } | null) {
    if (!axis) return;
    expect(axis.ticks.length).toBe(5);
    expect(axis.ticks[0]).toBe(axis.min);
    expect(axis.ticks[4]).toBe(axis.max);
    for (let i = 1; i < axis.ticks.length; i++) {
      expect(axis.ticks[i]).toBeGreaterThan(axis.ticks[i - 1]);
    }
    const gap0 = axis.ticks[1] - axis.ticks[0];
    for (let i = 2; i < axis.ticks.length; i++) {
      expect(Math.abs(axis.ticks[i] - axis.ticks[i - 1] - gap0)).toBeLessThanOrEqual(1e-9);
    }
  }

  it('single-reading gravity axis matches the exact expected tick set', () => {
    const readings = [reading({ id: 'r1', sg: 1.048 })];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    assertTicks(model.gravityAxis);
    const expected = [1.043, 1.0455, 1.048, 1.0505, 1.053];
    model.gravityAxis!.ticks.forEach((t, i) => expect(Math.abs(t - expected[i])).toBeLessThanOrEqual(1e-9));
  });

  it('a multi-reading axis also produces exactly 5 evenly-spaced ticks with exact endpoints', () => {
    const readings = [
      reading({ id: 'a', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.06 }),
      reading({ id: 'b', readingTime: '2026-08-02T00:00:00.000Z', sg: 1.02 }),
      reading({ id: 'c', readingTime: '2026-08-03T00:00:00.000Z', sg: 1.01, tempC: 19 }),
    ];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    assertTicks(model.timeAxis);
    assertTicks(model.gravityAxis);
    assertTicks(model.temperatureAxis);
  });
});

describe('AC-14: a series with no data has no axis — both directions', () => {
  it('gravityAxis is null iff no reading has sg !== null', () => {
    const allTempOnly = [reading({ id: 'a', tempC: 19 }), reading({ id: 'b', tempC: 20 })];
    const modelNoGravity = buildFermentationChartModel({ readings: allTempOnly, fermentationStartDate: null });
    if (!modelNoGravity.hasPoints) throw new Error('expected hasPoints true');
    expect(modelNoGravity.gravityAxis).toBeNull();

    const mixed = [reading({ id: 'a', tempC: 19 }), reading({ id: 'b', sg: 1.05 })];
    const modelWithGravity = buildFermentationChartModel({ readings: mixed, fermentationStartDate: null });
    if (!modelWithGravity.hasPoints) throw new Error('expected hasPoints true');
    expect(modelWithGravity.gravityAxis).not.toBeNull();
  });

  it('temperatureAxis is null iff no reading has tempC !== null', () => {
    const allGravityOnly = [reading({ id: 'a', sg: 1.05 }), reading({ id: 'b', sg: 1.04 })];
    const modelNoTemp = buildFermentationChartModel({ readings: allGravityOnly, fermentationStartDate: null });
    if (!modelNoTemp.hasPoints) throw new Error('expected hasPoints true');
    expect(modelNoTemp.temperatureAxis).toBeNull();

    const mixed = [reading({ id: 'a', sg: 1.05 }), reading({ id: 'b', tempC: 19 })];
    const modelWithTemp = buildFermentationChartModel({ readings: mixed, fermentationStartDate: null });
    if (!modelWithTemp.hasPoints) throw new Error('expected hasPoints true');
    expect(modelWithTemp.temperatureAxis).not.toBeNull();
  });

  it('no axis is ever fabricated at [0,1] or [0,0]', () => {
    const readings = [reading({ id: 'a', tempC: 19 })];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    expect(model.gravityAxis).toBeNull();
  });
});

describe('AC-15: chart points are canonical, aligned and complete', () => {
  it('a 5-reading set supplied out of order produces canonical, aligned, complete points', () => {
    const readings = [
      reading({ id: 'r5', readingTime: '2026-08-05T00:00:00.000Z', sg: 1.01 }),
      reading({ id: 'r1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.06 }),
      reading({ id: 'r3', readingTime: '2026-08-03T00:00:00.000Z', sg: null, tempC: 19 }), // no gravity, must still be a point
      reading({ id: 'r2', readingTime: '2026-08-02T00:00:00.000Z', sg: 1.03 }),
      reading({ id: 'r4', readingTime: '2026-08-04T00:00:00.000Z', sg: 1.02 }),
    ];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');

    expect(model.points.length).toBe(readings.length);
    expect(model.points.map((p) => p.readingId)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    for (let i = 1; i < model.points.length; i++) {
      expect(model.points[i].elapsedHours).toBeGreaterThanOrEqual(model.points[i - 1].elapsedHours);
    }
    // r3 has sg === null and must still appear as a point, carrying sg: null.
    const r3Point = model.points.find((p) => p.readingId === 'r3')!;
    expect(r3Point.sg).toBeNull();
    expect(r3Point.tempC).toBe(19);
  });
});

describe('AC-16: fermentation.ts is a pure module', () => {
  it('reads no clock/random/network and imports nothing from apps/, drizzle-orm, fastify or react', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/fermentation.ts'), 'utf-8');
    expect(source).not.toMatch(/Date\.now\(\)|new Date\(\)|Math\.random|randomUUID|fetch\(/);
    expect(source).not.toMatch(/from ['"]apps\//);
    expect(source).not.toMatch(/from ['"]drizzle-orm/);
    expect(source).not.toMatch(/from ['"]fastify/);
    expect(source).not.toMatch(/from ['"]react/);
  });
});
