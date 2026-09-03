import { describe, it, expect } from 'vitest';
import { CARBONATION_TYPES, residualCO2Volumes, primingSugarG, forceCarbonationPsi } from '../src';

describe('AC-6: CARBONATION_TYPES is a closed list', () => {
  it('exactly [Sugar, KegForce, KegForceQuick, KegSugar] in that order', () => {
    expect(CARBONATION_TYPES).toEqual(['Sugar', 'KegForce', 'KegForceQuick', 'KegSugar']);
  });
});

describe('AC-7: residualCO2Volumes is pinned numerically', () => {
  it('residualCO2Volumes(0) === 3.0378 exactly', () => {
    expect(residualCO2Volumes(0)).toBe(3.0378);
  });

  it('residualCO2Volumes(20) equals 2.14278 within 1e-9', () => {
    expect(Math.abs(residualCO2Volumes(20) - 2.14278)).toBeLessThan(1e-9);
  });

  it('residualCO2Volumes(4) equals 2.8418008 within 1e-9', () => {
    expect(Math.abs(residualCO2Volumes(4) - 2.8418008)).toBeLessThan(1e-9);
  });

  it('is monotonically decreasing across 0 -> 10 -> 20 -> 30', () => {
    const v0 = residualCO2Volumes(0);
    const v10 = residualCO2Volumes(10);
    const v20 = residualCO2Volumes(20);
    const v30 = residualCO2Volumes(30);
    expect(v0).toBeGreaterThan(v10);
    expect(v10).toBeGreaterThan(v20);
    expect(v20).toBeGreaterThan(v30);
  });
});

describe('AC-8: primingSugarG is pinned, and clamps at exactly 0', () => {
  it('primingSugarG({volumesCO2Target:2.4, peakFermentationTempC:20, beerVolumeL:19}) equals 19.54872 within 1e-9', () => {
    const result = primingSugarG({ volumesCO2Target: 2.4, peakFermentationTempC: 20, beerVolumeL: 19 });
    expect(Math.abs(result - 19.54872)).toBeLessThan(1e-9);
  });

  it('a target below residual CO2 returns exactly 0 (strict === 0)', () => {
    const result = primingSugarG({ volumesCO2Target: 1.5, peakFermentationTempC: 20, beerVolumeL: 19 });
    expect(result).toBe(0);
  });

  it('beerVolumeL: 0 returns exactly 0, never NaN', () => {
    const result = primingSugarG({ volumesCO2Target: 2.4, peakFermentationTempC: 20, beerVolumeL: 0 });
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('scales linearly in beerVolumeL — doubling the volume doubles the grams, within 1e-9', () => {
    const base = primingSugarG({ volumesCO2Target: 2.4, peakFermentationTempC: 20, beerVolumeL: 19 });
    const doubled = primingSugarG({ volumesCO2Target: 2.4, peakFermentationTempC: 20, beerVolumeL: 38 });
    expect(Math.abs(doubled - base * 2)).toBeLessThan(1e-9);
  });
});

describe('AC-9: forceCarbonationPsi is pinned, and is unclamped', () => {
  it('forceCarbonationPsi({volumesCO2:2.4, tempC:4}) equals 10.7917568608 within 1e-6', () => {
    const result = forceCarbonationPsi({ volumesCO2: 2.4, tempC: 4 });
    expect(Math.abs(result - 10.7917568608)).toBeLessThan(1e-6);
  });

  it('forceCarbonationPsi({volumesCO2:0, tempC:20}) equals -11.99958632 within 1e-6 and is strictly negative', () => {
    const result = forceCarbonationPsi({ volumesCO2: 0, tempC: 20 });
    expect(Math.abs(result - -11.99958632)).toBeLessThan(1e-6);
    expect(result).toBeLessThan(0);
  });

  it('rising volumesCO2 at fixed tempC raises the PSI', () => {
    const low = forceCarbonationPsi({ volumesCO2: 2.0, tempC: 4 });
    const high = forceCarbonationPsi({ volumesCO2: 2.5, tempC: 4 });
    expect(high).toBeGreaterThan(low);
  });

  it('rising tempC at fixed volumesCO2 raises the PSI', () => {
    const low = forceCarbonationPsi({ volumesCO2: 2.4, tempC: 2 });
    const high = forceCarbonationPsi({ volumesCO2: 2.4, tempC: 10 });
    expect(high).toBeGreaterThan(low);
  });
});

describe('M17_P1 AC-1: Custom Priming Sugar Multipliers', () => {
  const baseInput = { volumesCO2Target: 2.4, peakFermentationTempC: 20, beerVolumeL: 19 };

  it('calculates sucrose accurately for table_sugar (1.0x)', async () => {
    const { calculatePrimingSugarCustom } = await import('../src');
    const base = calculatePrimingSugarCustom({ ...baseInput, sugarType: 'table_sugar' });
    expect(base).toBeCloseTo(19.54872, 4);
  });

  it('calculates 1.09x for corn_sugar / dextrose', async () => {
    const { calculatePrimingSugarCustom } = await import('../src');
    const dextrose = calculatePrimingSugarCustom({ ...baseInput, sugarType: 'corn_sugar' });
    expect(dextrose).toBeCloseTo(19.54872 * 1.09, 4);
  });

  it('calculates 1.40x for dme', async () => {
    const { calculatePrimingSugarCustom } = await import('../src');
    const dme = calculatePrimingSugarCustom({ ...baseInput, sugarType: 'dme' });
    expect(dme).toBeCloseTo(19.54872 * 1.4, 4);
  });

  it('calculates 1.33x for honey', async () => {
    const { calculatePrimingSugarCustom } = await import('../src');
    const honey = calculatePrimingSugarCustom({ ...baseInput, sugarType: 'honey' });
    expect(honey).toBeCloseTo(19.54872 * 1.33, 4);
  });
});

describe('M17_P1 AC-2..AC-4: Split Packaging Calculations', () => {
  it('computes mixed keg and bottle split runs accurately with volume balance', async () => {
    const { calculateSplitPackaging } = await import('../src');
    const packages = [
      {
        id: 'pkg-1',
        type: 'keg' as const,
        volumeL: 10,
        targetVolumesCO2: 2.4,
        tempC: 4,
      },
      {
        id: 'pkg-2',
        type: 'bottles' as const,
        volumeL: 9,
        targetVolumesCO2: 2.4,
        sugarType: 'table_sugar' as const,
        bottleSizeMl: 330,
      },
    ];

    const result = calculateSplitPackaging(19.0, 20.0, packages);

    expect(result.totalPackagedVolumeL).toBe(19.0);
    expect(result.unassignedVolumeL).toBe(0.0);
    expect(result.results.length).toBe(2);

    // Keg result (AC-2)
    const kegRes = result.results[0];
    expect(kegRes.type).toBe('keg');
    expect(kegRes.forceCarbonationPsi).toBeCloseTo(10.79, 1);
    expect(kegRes.primingSugarG).toBeNull();

    // Bottle result (AC-3)
    const bottleRes = result.results[1];
    expect(bottleRes.type).toBe('bottles');
    expect(bottleRes.forceCarbonationPsi).toBeNull();
    expect(bottleRes.primingSugarG).toBeCloseTo(9.26, 1);
    expect(bottleRes.bottleCount).toBe(28); // 9000 / 330 = 27.27 -> 28
    expect(bottleRes.sugarGramsPerBottle).toBeCloseTo(9.26 / 28, 2);
  });

  it('calculates unassigned volume when total volume exceeds packages (AC-4)', async () => {
    const { calculateSplitPackaging } = await import('../src');
    const packages = [
      {
        id: 'pkg-1',
        type: 'keg' as const,
        volumeL: 10,
        targetVolumesCO2: 2.4,
      },
    ];

    const result = calculateSplitPackaging(20.0, 20.0, packages);
    expect(result.totalPackagedVolumeL).toBe(10.0);
    expect(result.unassignedVolumeL).toBe(10.0);
  });
});

describe('M17_P1 AC-17: calculatePrimingSolution (Syringe Dosing & Dilution)', () => {
  it('calculates total solution volume and syringe injection dose from water volume (Mode A)', async () => {
    const { calculatePrimingSolution, SUGAR_DISPLACEMENT_ML_PER_G } = await import('../src');
    expect(SUGAR_DISPLACEMENT_ML_PER_G).toBe(0.625);

    // 28.8g sugar in 200 mL water for 85 bottles
    // Sugar displacement = 28.8 * 0.625 = 18 mL
    // Total solution = 200 + 18 = 218 mL
    // Syringe dose per bottle = 218 / 85 = 2.56 mL/bottle
    const res = calculatePrimingSolution({
      sugarG: 28.8,
      bottleCount: 85,
      waterVolumeMl: 200,
    });

    expect(res.sugarDisplacementMl).toBe(18.0);
    expect(res.waterVolumeMl).toBe(200);
    expect(res.totalSolutionMl).toBe(218.0);
    expect(res.syringeDosePerBottleMl).toBeCloseTo(2.56, 2);
    expect(res.sugarConcentrationGPerMl).toBeCloseTo(28.8 / 218.0, 3);
    expect(res.instructionText).toContain('Inject 2.56 mL into each bottle');
  });

  it('calculates required water volume from target syringe dose per bottle (Mode B)', async () => {
    const { calculatePrimingSolution } = await import('../src');

    // 28.8g sugar for 85 bottles, target dose = 5.0 mL / bottle
    // Total solution needed = 85 * 5.0 = 425 mL
    // Sugar displacement = 28.8 * 0.625 = 18 mL
    // Water needed = 425 - 18 = 407 mL
    const res = calculatePrimingSolution({
      sugarG: 28.8,
      bottleCount: 85,
      targetDosePerBottleMl: 5.0,
    });

    expect(res.totalSolutionMl).toBe(425.0);
    expect(res.waterVolumeMl).toBe(407.0);
    expect(res.syringeDosePerBottleMl).toBe(5.0);
    expect(res.instructionText).toContain('407 mL boiling water');
  });

  it('calculates solution scaling with extra buffer percentage (FEAT-042)', async () => {
    const { calculatePrimingSolution } = await import('../src');

    // 28.8g sugar for 85 bottles, 200 mL water, +10% buffer
    const res = calculatePrimingSolution({
      sugarG: 28.8,
      bottleCount: 85,
      waterVolumeMl: 200,
      solutionBufferPct: 10,
    });

    expect(res.totalSugarToDissolveG).toBe(31.7); // 28.8 * 1.1 = 31.68 -> 31.7
    expect(res.waterVolumeMl).toBe(220); // 200 * 1.1 = 220
    expect(res.solutionBufferPct).toBe(10);
    expect(res.instructionText).toContain('31.7g priming sugar');
    expect(res.instructionText).toContain('220 mL boiling water');
    expect(res.instructionText).toContain('+10% buffer');
  });
});
