import type { CalculatedStats } from '@truchabrew/shared-types';
import type { RecipeVitals } from '@truchabrew/calculations';

/**
 * Pure adapter from the live-computed editor stats (`CalculatedStats`) to the
 * `RecipeVitals` shape the M38_P2 BJCP evaluator consumes.
 *
 * RA-P3-2 (binding): a **field pass-through** — `og`/`fg`/`abv`/`ibu`/`srm`
 * are copied verbatim. `CalculatedStats.og`/`.fg` are canonical specific
 * gravity, `.abv` is percent, `.ibu` is IBU, `.srm` is SRM — every one already
 * matches the BJCP dataset's published units, so there is deliberately NO unit
 * conversion here (no gravity/color conversion helpers are imported or used).
 * Deterministic; never throws; never mutates its input.
 */
export function statsToStyleVitals(stats: CalculatedStats): RecipeVitals {
  return {
    og: stats.og,
    fg: stats.fg,
    abv: stats.abv,
    ibu: stats.ibu,
    srm: stats.srm,
  };
}
