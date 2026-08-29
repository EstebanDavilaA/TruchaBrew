import { describe, it, expect } from 'vitest';
import {
  calculateCellarSchedule,
  detectFgStability,
  buildFermentationChartModel,
  refractometerFinalGravity,
  type FermentationReadingPoint,
} from '../src';
import type { Recipe, HopItem, FermentationProfile, MiscItem } from '@truchabrew/shared-types';

function createMockRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-test-1',
    name: 'Test IPA',
    author: 'Brewer',
    styleName: 'American IPA',
    equipment: {
      id: 'eq-1',
      name: 'Default Pot',
      batchSizeL: 20,
      boilTimeMin: 60,
      brewhouseEfficiencyPct: 75,
      mashEfficiencyPct: 80,
      boilOffRateLPerHour: 3,
      trubChillerLossL: 1.5,
      hopUtilizationPct: 100,
      derivedFromEquipmentId: null,
      mashWaterRatioLPerKg: 3.0,
      grainAbsorptionLPerKg: 0.96,
      hopstandUtilizationFactor: 0.26,
      hopstandTemperatureC: 79,
      spargeTemperatureC: 76,
      mashTunHeatCapacityL: 0,
      grainTemperatureC: 20,
      notes: '',
    },
    fermentables: [],
    hops: [],
    yeasts: [],
    miscs: [],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
    ...overrides,
  };
}

describe('AC-1: Cellar Schedule Dry Hop Events', () => {
  it('derives dry hop addition and removal events with accurate day offsets and timestamps', () => {
    const hops: HopItem[] = [
      {
        id: 'h-1',
        name: 'Citra',
        amountG: 50,
        alphaAcidPct: 12.5,
        use: 'DryHop',
        boilMins: null,
        whirlpoolMins: null,
        whirlpoolTempC: null,
        dryHopDayOffset: 3,
        dryHopDurationDays: 4,
        type: 'Pellet',
      },
      {
        id: 'h-2',
        name: 'Cascade',
        amountG: 30,
        alphaAcidPct: 6.0,
        use: 'Boil',
        boilMins: 60,
        whirlpoolMins: null,
        whirlpoolTempC: null,
        type: 'Pellet',
      },
    ];

    const recipe = createMockRecipe({ hops });
    const startDate = '2026-08-01T12:00:00.000Z';
    const schedule = calculateCellarSchedule({
      fermentationStartDate: startDate,
      recipe,
      readings: [],
      notes: [],
    });

    // Cascade is Boil -> only Citra generates cellar events (1 add, 1 remove)
    expect(schedule.length).toBe(2);

    const addEvent = schedule.find((e) => e.type === 'dry_hop_add');
    expect(addEvent).toBeDefined();
    expect(addEvent?.title).toBe('Add 50g Citra (Dry Hop)');
    expect(addEvent?.dayOffset).toBe(3);
    expect(addEvent?.targetTimestamp).toBe('2026-08-04T12:00:00.000Z');
    expect(addEvent?.isCompleted).toBe(false);

    const removeEvent = schedule.find((e) => e.type === 'dry_hop_remove');
    expect(removeEvent).toBeDefined();
    expect(removeEvent?.title).toBe('Remove / rack Citra dry hops');
    expect(removeEvent?.dayOffset).toBe(7); // 3 + 4
    expect(removeEvent?.targetTimestamp).toBe('2026-08-08T12:00:00.000Z');
    expect(removeEvent?.isCompleted).toBe(false);
  });
});

describe('AC-2 & AC-3: Fermentation Steps, Pressure & Misc Events', () => {
  it('derives sequential temperature steps, pressure targets, and cellar miscs', () => {
    const fermentationProfile: FermentationProfile = {
      id: 'fp-1',
      name: 'Ale with Diacetyl Rest & Cold Crash',
      steps: [
        {
          id: 'step-1',
          name: 'Primary',
          type: 'Primary',
          stepTempC: 19.0,
          stepTimeDays: 4,
          rampDays: 0,
          pressurePsi: 0,
        },
        {
          id: 'step-2',
          name: 'Diacetyl Rest',
          type: 'Secondary',
          stepTempC: 22.0,
          stepTimeDays: 3,
          rampDays: 1,
          pressurePsi: 12.0,
        },
        {
          id: 'step-3',
          name: 'Cold Crash',
          type: 'ColdCrash',
          stepTempC: 2.0,
          stepTimeDays: 2,
          rampDays: 1,
          pressurePsi: null,
        },
      ],
    };

    const miscs: MiscItem[] = [
      {
        id: 'm-1',
        name: 'Biofine Clear',
        type: 'Fining',
        use: 'Secondary',
        timeMinutes: 0,
        amount: 10,
        unit: 'ml',
      },
      {
        id: 'm-2',
        name: 'Whirlfloc',
        type: 'Fining',
        use: 'Boil',
        timeMinutes: 10,
        amount: 1,
        unit: 'each',
      },
    ];

    const recipe = createMockRecipe({ fermentationProfile, miscs });
    const startDate = '2026-08-01T00:00:00.000Z';
    const schedule = calculateCellarSchedule({
      fermentationStartDate: startDate,
      recipe,
      readings: [],
      notes: [],
    });

    // 3 temp steps + 2 pressure targets (step 1 & 2) + 1 secondary misc = 6 events
    expect(schedule.length).toBe(6);

    const step1 = schedule.find((e) => e.id === 'ferm-step-step-1');
    expect(step1?.dayOffset).toBe(0);
    expect(step1?.targetTempC).toBe(19.0);

    const step2 = schedule.find((e) => e.id === 'ferm-step-step-2');
    expect(step2?.dayOffset).toBe(4); // After step 1's 4 days
    expect(step2?.targetTempC).toBe(22.0);

    const step3 = schedule.find((e) => e.id === 'ferm-step-step-3');
    expect(step3?.dayOffset).toBe(7); // 4 + 3
    expect(step3?.targetTempC).toBe(2.0);

    const pressureStep2 = schedule.find((e) => e.id === 'pressure-target-step-2');
    expect(pressureStep2?.dayOffset).toBe(4);
    expect(pressureStep2?.targetPressurePsi).toBe(12.0);

    const miscEvent = schedule.find((e) => e.id === 'cellar-misc-m-1');
    expect(miscEvent?.type).toBe('misc_addition');
    expect(miscEvent?.title).toBe('Add 10 ml Biofine Clear (Secondary)');
  });
});

describe('AC-4: Cellar Action Note Completion Matching', () => {
  it('matches notes with [Cellar: <id>] tag or title and marks completion', () => {
    const hops: HopItem[] = [
      {
        id: 'h-10',
        name: 'Mosaic',
        amountG: 100,
        alphaAcidPct: 11.5,
        use: 'DryHop',
        boilMins: null,
        whirlpoolMins: null,
        whirlpoolTempC: null,
        dryHopDayOffset: 2,
        dryHopDurationDays: 3,
        type: 'Pellet',
      },
    ];

    const recipe = createMockRecipe({ hops });
    const schedule = calculateCellarSchedule({
      fermentationStartDate: '2026-08-01T00:00:00.000Z',
      recipe,
      readings: [],
      notes: [
        {
          id: 'note-1',
          timestamp: '2026-08-03T14:30:00.000Z',
          note: '[Cellar: dry-hop-add-h-10] Add 100g Mosaic (Dry Hop)',
        },
      ],
    });

    const addEvent = schedule.find((e) => e.id === 'dry-hop-add-h-10');
    expect(addEvent?.isCompleted).toBe(true);
    expect(addEvent?.completedAt).toBe('2026-08-03T14:30:00.000Z');

    const removeEvent = schedule.find((e) => e.id === 'dry-hop-remove-h-10');
    expect(removeEvent?.isCompleted).toBe(false);
    expect(removeEvent?.completedAt).toBeNull();
  });
});

describe('AC-5 & AC-6: FG Stability Detection', () => {
  it('returns isStable: true when readings separated by >= 48h have |deltaSG| <= 0.001', () => {
    const readings: FermentationReadingPoint[] = [
      { id: 'r-1', readingTime: '2026-08-01T10:00:00.000Z', sg: 1.050, tempC: 19 },
      { id: 'r-2', readingTime: '2026-08-05T10:00:00.000Z', sg: 1.012, tempC: 19 },
      { id: 'r-3', readingTime: '2026-08-07T10:00:00.000Z', sg: 1.011, tempC: 19 }, // 48h from r-2, delta = 0.001
    ];

    const result = detectFgStability(readings);
    expect(result.isStable).toBe(true);
    expect(result.latestSg).toBe(1.011);
    expect(result.priorSg).toBe(1.012);
    expect(result.deltaSg).toBe(0.001);
    expect(result.elapsedHours).toBe(48.0);
  });

  it('returns isStable: false when readings span < 48h', () => {
    const readings: FermentationReadingPoint[] = [
      { id: 'r-1', readingTime: '2026-08-01T10:00:00.000Z', sg: 1.012, tempC: 19 },
      { id: 'r-2', readingTime: '2026-08-02T10:00:00.000Z', sg: 1.012, tempC: 19 }, // only 24h
    ];

    const result = detectFgStability(readings);
    expect(result.isStable).toBe(false);
    expect(result.elapsedHours).toBe(24.0);
  });

  it('returns isStable: false when delta SG > 0.001', () => {
    const readings: FermentationReadingPoint[] = [
      { id: 'r-1', readingTime: '2026-08-01T10:00:00.000Z', sg: 1.020, tempC: 19 },
      { id: 'r-2', readingTime: '2026-08-04T10:00:00.000Z', sg: 1.014, tempC: 19 }, // 72h, delta = 0.006
    ];

    const result = detectFgStability(readings);
    expect(result.isStable).toBe(false);
    expect(result.deltaSg).toBe(0.006);
  });

  it('returns isStable: false on empty or single reading', () => {
    expect(detectFgStability([]).isStable).toBe(false);
    expect(
      detectFgStability([{ id: 'r-1', readingTime: '2026-08-01T10:00:00.000Z', sg: 1.010, tempC: 19 }]).isStable
    ).toBe(false);
  });
});

describe('AC-7: Refractometer Fermentation Alcohol Correction Math', () => {
  it('calculates alcohol-corrected SG with Sean Terrill cubic formula', () => {
    // Standard test case: OG = 13 °Bx (~1.053), FG = 6.5 °Bx, WCF = 1.04
    const correctedSg = refractometerFinalGravity({
      initialBrix: 13.0,
      finalBrix: 6.5,
      wortCorrectionFactor: 1.04,
    });

    // Uncorrected brixToSg(6.5) gives ~1.026 (false high due to ethanol).
    // Terrill's cubic corrects for ethanol optical deflection down to ~1.011 - 1.012.
    expect(correctedSg).toBeLessThan(1.015);
    expect(correctedSg).toBeGreaterThan(1.005);
    expect(Number(correctedSg.toFixed(3))).toBe(1.012);
  });
});

describe('AC-11 (Model): FermentationChartModel includes Target Temp Points', () => {
  it('builds target temperature points and extends temperature axis', () => {
    const profile: FermentationProfile = {
      id: 'fp-1',
      name: 'Ale Profile',
      steps: [
        { id: 's-1', name: 'Primary', type: 'Primary', stepTempC: 18.0, stepTimeDays: 5, rampDays: 0, pressurePsi: null },
        { id: 's-2', name: 'Crash', type: 'ColdCrash', stepTempC: 2.0, stepTimeDays: 2, rampDays: 0, pressurePsi: null },
      ],
    };

    const model = buildFermentationChartModel({
      readings: [
        { id: 'r-1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.050, tempC: 18.5 },
        { id: 'r-2', readingTime: '2026-08-06T00:00:00.000Z', sg: 1.010, tempC: 18.0 },
      ],
      fermentationStartDate: '2026-08-01T00:00:00.000Z',
      fermentationProfile: profile,
    });

    expect(model.hasPoints).toBe(true);
    if (model.hasPoints) {
      expect(model.targetTemperaturePoints.length).toBe(4);
      expect(model.targetTemperaturePoints[0]).toEqual({ elapsedHours: 0, targetTempC: 18.0 });
      expect(model.targetTemperaturePoints[1]).toEqual({ elapsedHours: 120, targetTempC: 18.0 }); // 5 * 24h
      expect(model.targetTemperaturePoints[2]).toEqual({ elapsedHours: 120, targetTempC: 2.0 });
      expect(model.targetTemperaturePoints[3]).toEqual({ elapsedHours: 168, targetTempC: 2.0 }); // (5 + 2) * 24h

      // Temperature axis min must accommodate the 2.0°C cold crash
      expect(model.temperatureAxis?.min).toBeLessThanOrEqual(2.0);
    }
  });
});
