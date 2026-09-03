// M8_P2 spec §2.1 / Resolved Ambiguities §4. Pure functions only — no I/O,
// no React. All numeric coefficients are module-private except
// HOP_STORAGE_FACTORS (§1.2).

export type HopStorageMethod = 'nitrogenFlushedOxygenBarrier' | 'sealedNotEvacuated' | 'looseInAir';

/** Garetz, Hop Storage: How to Get -- and Keep -- Your Hops' Optimum Value, Brewing Techniques, Jan/Feb 1994. */
export const HOP_STORAGE_FACTORS: Readonly<Record<HopStorageMethod, number>> = {
  nitrogenFlushedOxygenBarrier: 0.5,
  sealedNotEvacuated: 0.75,
  looseInAir: 1.0,
};

// Module-private (§1.2).
const HOP_DECAY_REFERENCE_DAYS = 180;
const HOP_DECAY_REFERENCE_TEMP_C = 20;
const HOP_DECAY_DOUBLING_INTERVAL_C = 15;

/**
 * k = -ln(1 - percentLostSixMonths) / 180. `percentLostSixMonths` is a
 * FRACTION in [0, 1), not a percentage. Reproduces Garetz's published
 * k = 0.00385 for a 50% six-month loss (Resolved Ambiguities §4, AC-8).
 */
export function hopDecayRateConstant(percentLostSixMonths: number): number {
  return -Math.log(1 - percentLostSixMonths) / HOP_DECAY_REFERENCE_DAYS;
}

/**
 * TF = 2 ** ((storageTempC - 20) / 15) — degradation rate doubles per 15°C,
 * normalised to TF = 1 at the 20°C reference the percentLost table is
 * defined at (Resolved Ambiguities §4).
 */
export function hopTemperatureFactor(storageTempC: number): number {
  return Math.pow(2, (storageTempC - HOP_DECAY_REFERENCE_TEMP_C) / HOP_DECAY_DOUBLING_INTERVAL_C);
}

export interface AlphaAcidStorageInput {
  initialAlphaAcidPct: number;
  percentLostSixMonths: number;
  storageTempC: number;
  storageFactor: number;
  days: number;
}

/**
 * AA(t) = AA0 * e^(-k * TF * SF * days). Both hopDecayRateConstant and
 * hopTemperatureFactor are DELEGATED to, not inlined (§2.1). No clamping —
 * `days: 0` returns initialAlphaAcidPct exactly.
 */
export function alphaAcidAfterStorage(input: AlphaAcidStorageInput): number {
  const { initialAlphaAcidPct, percentLostSixMonths, storageTempC, storageFactor, days } = input;
  const k = hopDecayRateConstant(percentLostSixMonths);
  const tf = hopTemperatureFactor(storageTempC);
  return initialAlphaAcidPct * Math.exp(-k * tf * storageFactor * days);
}
