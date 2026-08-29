// User configuration — application-wide unit and formula-strategy
// preferences. Storage in SQLite is strictly canonical (metric kg/g/L, °C,
// SG) — see M7_P1 spec §"Key Behaviors" 1. Display/calculation layers adapt
// to these preferences without mutating any stored value.

/** 'metric' (kg, g, L, °C); 'us' (lb, oz, gal, °F); 'imperial' (lb, oz, Imp gal, °F). */
export type UnitSystem = 'metric' | 'us' | 'imperial';

/** 'sg' (e.g. 1.050); 'plato' (e.g. 12.4 °P). */
export type GravityUnit = 'sg' | 'plato';

/** 'celsius' (°C); 'fahrenheit' (°F). */
export type TemperatureUnit = 'celsius' | 'fahrenheit';

/**
 * 'tinseth' (default), 'rager', 'garetz'. NOTE (execution-time flag, not
 * spec text): the M7_P1 spec's Resolved Ambiguities §2 gives complete
 * closed-form formulas for 'tinseth' and 'rager' but NOT for 'garetz' — see
 * packages/calculations/src/config.ts's calculateGaretzIbuCandidate for the
 * full disclosure. 'garetz' is a fully valid, selectable enum member here;
 * only its calculated numeric output is an unapproved literature-derived
 * stand-in pending sign-off.
 */
export type IbuFormulaStrategy = 'tinseth' | 'rager' | 'garetz';

/** 'simple' (default): (OG-FG)*131.25. 'balling': 132.715*(OG-FG)/FG. */
export type AbvFormulaStrategy = 'simple' | 'balling';

export interface UserConfig {
  id: string;
  unitSystem: UnitSystem;
  gravityUnit: GravityUnit;
  temperatureUnit: TemperatureUnit;
  ibuFormula: IbuFormulaStrategy;
  abvFormula: AbvFormulaStrategy;
}

export interface UserConfigInput {
  unitSystem?: UnitSystem;
  gravityUnit?: GravityUnit;
  temperatureUnit?: TemperatureUnit;
  ibuFormula?: IbuFormulaStrategy;
  abvFormula?: AbvFormulaStrategy;
}
