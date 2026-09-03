export * from './constants';
export * from './units';
export * from './brewingMath';
export * from './scaling';
export * from './mash';
export * from './batchPipeline';
export * from './fermentation';
export * from './chronology';
export * from './carbonation';
export * from './batchClosing';
export * from './equipmentDriven';
export * from './water';
export * from './waterOptimization';
export * from './hydrometry';
export * from './pressure';
export * from './yeast';
export * from './hops';
export * from './gravityCorrection';
export * from './inventory';
export * from './inventoryLedger';
export * from './nutrition';
export * from './brewfatherImport';
export * from './beerXmlImport';
// NOTE (M7_P1): `export *` deliberately NOT used for './config' — that
// module defines its own `kgToLb`, which collides with the pre-existing
// `kgToLb` re-exported above via `export * from './units'` (both compute
// the identical value; TS treats re-exporting the same name from two
// `export *` sources as an ambiguity error). Every other config.ts export
// is re-exported explicitly by name instead; config.ts's own kgToLb is not
// part of this package's public surface (this package.json has no
// `exports` map for subpath imports) — callers needing it should just use
// the identical `kgToLb` already re-exported from './units' above.
export {
  sgToPlato,
  platoToSg,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  lbToKg,
  lToUsGal,
  usGalToL,
  lToImpGal,
  impGalToL,
  calculateAbvWithStrategy,
  calculateRecipeIbuWithStrategy,
  DEFAULT_USER_CONFIG,
  formatGravity,
  formatTemperature,
  convertMass,
  massUnitLabel,
  formatMass,
  convertHopMass,
  hopMassUnitLabel,
  formatHopMass,
  convertVolume,
  volumeUnitLabel,
  formatVolume,
} from './config';
export * from './brewSheet';
export * from './brewDayTimeline';
export * from './measurementTargets';
export * from './waterSummary';
// M38_P2: BJCP 2021 style-guideline dataset + evaluator. Added by explicit
// name (NOT a bare `export * from './bjcp'`) to keep the BJCP-*sensory*
// surface (BJCPTier / SensoryScoreInput / BJCPScoreResult /
// calculateBJCPScore, re-exported from './equipmentDriven' above) from any
// collision — mirroring the config.ts treatment.
export { BJCP_STYLES, BJCP_STYLE_COUNT, isValueInRange, evaluateStyleMatch } from './bjcp';
export type {
  StyleVitalKey,
  RangeSpec,
  BJCPStyle,
  RecipeVitals,
  VitalMatchResult,
  StyleMatchVerdict,
  StyleMatchResult,
} from './bjcp';
