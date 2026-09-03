import { POUNDS_PER_KG, GALLONS_PER_LITER, SRM_TO_EBC, LOVIBOND_SLOPE, LOVIBOND_OFFSET } from './constants';

/** Rounds to whole gravity points. Display-only — internal extract math uses sgToPointsExact. */
export function sgToPoints(sg: number): number {
  return Math.round((sg - 1) * 1000);
}

/** Exact (non-rounded) gravity points. Used for every internal extract calculation. */
export function sgToPointsExact(sg: number): number {
  return (sg - 1) * 1000;
}

export function pointsToSg(points: number): number {
  return 1 + points / 1000;
}

export function kgToLb(kg: number): number {
  return kg * POUNDS_PER_KG;
}

export function litersToGallons(liters: number): number {
  return liters * GALLONS_PER_LITER;
}

export function srmToEbc(srm: number): number {
  return srm * SRM_TO_EBC;
}

export function ebcToSrm(ebc: number): number {
  return ebc / SRM_TO_EBC;
}

export function srmToLovibond(srm: number): number {
  return (srm + LOVIBOND_OFFSET) / LOVIBOND_SLOPE;
}

export function lovibondToSrm(lovibond: number): number {
  return LOVIBOND_SLOPE * lovibond - LOVIBOND_OFFSET;
}
