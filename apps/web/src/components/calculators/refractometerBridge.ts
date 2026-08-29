// M15_P1 / M16_P1 — Refractometer calculation bridge.
//
// Re-exported under bridged names from inside components/calculators/, rather
// than non-calculator UI components importing standalone-classified functions
// directly from `@truchabrew/calculations`:
// test/calculatorImportGraph.test.ts asserts standalone calculation functions
// have NO direct call sites in apps/web/src outside components/calculators/ —
// a deliberate architectural invariant keeping every "standalone calculator"
// formula's call sites confined to this directory. This bridge keeps that
// invariant true while letting BrewDayTracker and RefractometerFermentationModal
// consume the exact same canonical implementation from `hydrometry.ts`.

export {
  brixToSg as convertBrixReadingToSg,
  sgToBrix as convertSgToBrixReading,
  refractometerFinalGravity as convertFermentationRefractometerFg,
} from '@truchabrew/calculations';
