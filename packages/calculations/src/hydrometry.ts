// M8_P1 spec §2.1 / Resolved Ambiguities §2, §3, §4. Pure functions only —
// no I/O, no React. All coefficients here are module-private (Ambiguity 6);
// nothing is added to constants.ts, whose closed-15-name assertion
// (units.test.ts) is on the M8_P1 §1.4 Untouched list.
import { celsiusToFahrenheit } from './config';

// ---------------------------------------------------------------------------
// Brix <-> SG (Ambiguity 3a/3b, Ambiguity 4)
// ---------------------------------------------------------------------------

const BRIX_DENOM_A = 258.6;
const BRIX_DENOM_B = 258.2;
const BRIX_DENOM_C = 227.1;

/** SG = 1 + (B / (258.6 - (B / 258.2) * 227.1)) — Ambiguity 3(a), binding. */
export function brixToSg(brix: number): number {
  return 1 + brix / (BRIX_DENOM_A - (brix / BRIX_DENOM_B) * BRIX_DENOM_C);
}

const SG_TO_BRIX_C3 = 182.4601;
const SG_TO_BRIX_C2 = -775.6821;
const SG_TO_BRIX_C1 = 1262.7794;
const SG_TO_BRIX_C0 = -669.5622;

/** °Bx = ((182.4601*SG - 775.6821)*SG + 1262.7794)*SG - 669.5622 — Ambiguity 3(b), binding. */
export function sgToBrix(sg: number): number {
  return ((SG_TO_BRIX_C3 * sg + SG_TO_BRIX_C2) * sg + SG_TO_BRIX_C1) * sg + SG_TO_BRIX_C0;
}

// ---------------------------------------------------------------------------
// Hydrometer temperature correction — Resolved Ambiguity 2 (Fahrenheit-domain)
// ---------------------------------------------------------------------------

const HYDRO_C0 = 1.00130346;
const HYDRO_C1 = 0.000134722124;
const HYDRO_C2 = 0.00000204052596;
const HYDRO_C3 = 0.00000000232820948;

function hydrometerPolynomial(tempF: number): number {
  return HYDRO_C0 - HYDRO_C1 * tempF + HYDRO_C2 * tempF ** 2 - HYDRO_C3 * tempF ** 3;
}

export interface HydrometerCorrectionInput {
  readingSg: number;
  sampleTempC: number;
  calibrationTempC: number; // no default — the caller states it explicitly
}

/**
 * readingSg * c(F(sampleTempC)) / c(F(calibrationTempC)) — Resolved
 * Ambiguity 2, binding. Converts Celsius to Fahrenheit internally via the
 * imported celsiusToFahrenheit; no inline t*9/5+32.
 */
export function hydrometerCorrectedSg(input: HydrometerCorrectionInput): number {
  const { readingSg, sampleTempC, calibrationTempC } = input;
  const sampleTempF = celsiusToFahrenheit(sampleTempC);
  const calibrationTempF = celsiusToFahrenheit(calibrationTempC);
  return readingSg * (hydrometerPolynomial(sampleTempF) / hydrometerPolynomial(calibrationTempF));
}

// ---------------------------------------------------------------------------
// Refractometer — Resolved Ambiguity 3(c)/3(d)
// ---------------------------------------------------------------------------

/** Wort correction factor default — the UI's default field value must come from here, not a hardcoded 1.04 in a component (§1.2). */
export const DEFAULT_WORT_CORRECTION_FACTOR = 1.04;

// Sean Terrill's published cubic, verified against the coefficients given in
// M8_P1 spec Ambiguity 3(c) before implementation (executor's citation duty).
const TERRILL_CONST = 1.0;
const TERRILL_BI1 = -0.0044993;
const TERRILL_BF1 = 0.011774;
const TERRILL_BI2 = 0.00027581;
const TERRILL_BF2 = -0.0012717;
const TERRILL_BI3 = -0.00000728;
const TERRILL_BF3 = 0.000063293;

export interface RefractometerInput {
  initialBrix: number;
  finalBrix: number;
  wortCorrectionFactor: number; // no default — caller passes DEFAULT_WORT_CORRECTION_FACTOR
}

/** brixToSg(initialBrix / wortCorrectionFactor) — delegates, no second Brix->SG path (§2.1). */
export function refractometerOriginalGravity(input: RefractometerInput): number {
  return brixToSg(input.initialBrix / input.wortCorrectionFactor);
}

/** Terrill's cubic (Ambiguity 3c) over initialBrix/wcf and finalBrix/wcf. */
export function refractometerFinalGravity(input: RefractometerInput): number {
  const bi = input.initialBrix / input.wortCorrectionFactor;
  const bf = input.finalBrix / input.wortCorrectionFactor;
  return (
    TERRILL_CONST +
    TERRILL_BI1 * bi +
    TERRILL_BF1 * bf +
    TERRILL_BI2 * bi ** 2 +
    TERRILL_BF2 * bf ** 2 +
    TERRILL_BI3 * bi ** 3 +
    TERRILL_BF3 * bf ** 3
  );
}

// ---------------------------------------------------------------------------
// Hot wort thermal expansion — M15_P1 spec §3.1, verbatim function bodies.
// ---------------------------------------------------------------------------

/** 4% volumetric expansion at ~100°C — the UI's default coefficient must come from here. */
export const WORT_THERMAL_EXPANSION_COEFF = 0.04;

export function hotWortToColdVolumeL(hotVolumeL: number, expansionCoeff = WORT_THERMAL_EXPANSION_COEFF): number {
  if (hotVolumeL <= 0 || isNaN(hotVolumeL)) return 0;
  return Number((hotVolumeL / (1 + expansionCoeff)).toFixed(2));
}

export function coldToHotWortVolumeL(coldVolumeL: number, expansionCoeff = WORT_THERMAL_EXPANSION_COEFF): number {
  if (coldVolumeL <= 0 || isNaN(coldVolumeL)) return 0;
  return Number((coldVolumeL * (1 + expansionCoeff)).toFixed(2));
}
