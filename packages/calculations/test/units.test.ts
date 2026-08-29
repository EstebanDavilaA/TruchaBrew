import { describe, it, expect } from 'vitest';
import {
  MOREY_COEFF,
  MOREY_EXPONENT,
  SRM_TO_EBC,
  LOVIBOND_SLOPE,
  AVERAGE_ATTENUATION_BASELINE,
  DEFAULT_ATTENUATION_PCT,
  STRIKE_GRAIN_HEAT_COEFF,
  INFUSION_GRAIN_HEAT_COEFF,
  sgToPoints,
  sgToPointsExact,
  pointsToSg,
  srmToEbc,
  ebcToSrm,
  srmToLovibond,
  lovibondToSrm,
} from '../src/index';
import * as constants from '../src/constants';

describe('AC-1: constant exports', () => {
  it('exposes the exact documented values from @truchabrew/calculations', () => {
    expect(MOREY_COEFF).toBe(1.4922);
    expect(MOREY_EXPONENT).toBe(0.6859);
    expect(SRM_TO_EBC).toBe(1.97);
    expect(LOVIBOND_SLOPE).toBe(1.3546);
    expect(AVERAGE_ATTENUATION_BASELINE).toBe(0.7655);
    expect(DEFAULT_ATTENUATION_PCT).toBe(75);
  });
});

describe('M3_P2 AC-4: constants.ts closed list is exactly 15 names', () => {
  it('exports exactly the 13 pre-existing names plus STRIKE_GRAIN_HEAT_COEFF and INFUSION_GRAIN_HEAT_COEFF', () => {
    const expectedNames = [
      'POUNDS_PER_KG',
      'GALLONS_PER_LITER',
      'TINSETH_BIGNESS_COEFF',
      'TINSETH_BIGNESS_BASE',
      'TINSETH_TIME_RATE',
      'TINSETH_TIME_DIVISOR',
      'MOREY_COEFF',
      'MOREY_EXPONENT',
      'SRM_TO_EBC',
      'LOVIBOND_SLOPE',
      'LOVIBOND_OFFSET',
      'AVERAGE_ATTENUATION_BASELINE',
      'DEFAULT_ATTENUATION_PCT',
      'STRIKE_GRAIN_HEAT_COEFF',
      'INFUSION_GRAIN_HEAT_COEFF',
    ].sort();
    expect(Object.keys(constants).sort()).toEqual(expectedNames);
    expect(Object.keys(constants).length).toBe(15);
  });

  it('the two new coefficients are exactly 0.41 and 0.4', () => {
    expect(STRIKE_GRAIN_HEAT_COEFF).toBe(0.41);
    expect(INFUSION_GRAIN_HEAT_COEFF).toBe(0.4);
  });
});

describe('AC-2: unit converters round-trip', () => {
  it('ebcToSrm(srmToEbc(x)) round-trips within 1e-9', () => {
    for (const x of [0, 1.5, 9.3, 71, 1300]) {
      expect(Math.abs(ebcToSrm(srmToEbc(x)) - x)).toBeLessThanOrEqual(1e-9);
    }
  });

  it('lovibondToSrm(srmToLovibond(x)) round-trips within 1e-9', () => {
    for (const x of [0, 1.5, 9.3, 71, 1300]) {
      expect(Math.abs(lovibondToSrm(srmToLovibond(x)) - x)).toBeLessThanOrEqual(1e-9);
    }
  });

  it('srmToLovibond(3.046) is approximately 2.809', () => {
    expect(Math.abs(srmToLovibond(3.046) - 2.809)).toBeLessThanOrEqual(0.001);
  });
});

describe('AC-3: sgToPointsExact does not round', () => {
  it('sgToPointsExact(1.0375) === 37.5 while sgToPoints(1.0375) === 38', () => {
    expect(Math.abs(sgToPointsExact(1.0375) - 37.5)).toBeLessThanOrEqual(1e-9);
    expect(sgToPoints(1.0375)).toBe(38);
  });

  it('pointsToSg is the inverse of the exact-points transform', () => {
    expect(pointsToSg(sgToPointsExact(1.052))).toBeCloseTo(1.052, 9);
  });
});
