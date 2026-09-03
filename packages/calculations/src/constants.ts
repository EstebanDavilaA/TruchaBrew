export const POUNDS_PER_KG = 2.20462;
export const GALLONS_PER_LITER = 0.264172;

export const TINSETH_BIGNESS_COEFF = 1.65;
export const TINSETH_BIGNESS_BASE = 0.000125;
export const TINSETH_TIME_RATE = 0.04;
export const TINSETH_TIME_DIVISOR = 4.15;

export const MOREY_COEFF = 1.4922;
export const MOREY_EXPONENT = 0.6859;

export const SRM_TO_EBC = 1.97;
export const LOVIBOND_SLOPE = 1.3546; // SRM = 1.3546*L - 0.76
export const LOVIBOND_OFFSET = 0.76;

export const AVERAGE_ATTENUATION_BASELINE = 0.7655; // RBR all-styles reference
export const DEFAULT_ATTENUATION_PCT = 75; // used when recipe.yeasts is empty

// Published formula coefficients for the grain/water specific-heat ratio in
// build-spec §3.5's strike-temperature and infusion-volume formulas — the
// same category as TINSETH_* and MOREY_*, not a kit setting (M3_P2 spec,
// Resolved Ambiguities).
export const STRIKE_GRAIN_HEAT_COEFF = 0.41;
export const INFUSION_GRAIN_HEAT_COEFF = 0.4;
