// M38_P2: pure BJCP 2021 style-match evaluator. No side effects; never mutates
// inputs or the dataset.
import type {
  BJCPStyle,
  RangeSpec,
  RecipeVitals,
  StyleMatchResult,
  StyleVitalKey,
  VitalMatchResult,
} from './types';
import { BJCP_STYLES } from './data';

// The five vitals, in a stable canonical order.
const VITAL_KEYS: readonly StyleVitalKey[] = ['og', 'fg', 'abv', 'ibu', 'srm'];

// Read-only id -> style lookup over the default dataset, built once at module
// load. Only consulted when the caller uses the default dataset (BJCP_STYLES);
// an injected `styles` array is searched directly so degenerate/empty datasets
// behave exactly as passed in.
const styleIndex: ReadonlyMap<string, BJCPStyle> = new Map(
  BJCP_STYLES.map((style) => [style.id, style] as const),
);

/**
 * Pure inclusive range check: range.low <= value <= range.high.
 * Inclusive on both ends; no rounding, no epsilon.
 */
export function isValueInRange(value: number, range: RangeSpec): boolean {
  return range.low <= value && value <= range.high;
}

/**
 * Pure evaluator. Given a style id and a recipe's vitals, reports per-vital
 * presence + in/out-of-range and a composite verdict over only the present
 * vitals. An unknown style id (or empty injected dataset) yields the no-match
 * contract: found:false, style:null, verdict:null, allInRange:null, every
 * per-vital inRange null. Never throws, never fabricates a range or a verdict.
 *
 * @param styleId official BJCP style code, e.g. '21A'
 * @param vitals  recipe vitals; undefined/null/non-finite values count as not present
 * @param styles  injectable dataset (defaults to BJCP_STYLES)
 */
export function evaluateStyleMatch(
  styleId: string,
  vitals: RecipeVitals,
  styles: ReadonlyArray<BJCPStyle> = BJCP_STYLES,
): StyleMatchResult {
  const list = styles ?? BJCP_STYLES;
  const style: BJCPStyle | null =
    list === BJCP_STYLES ? (styleIndex.get(styleId) ?? null) : (list.find((s) => s.id === styleId) ?? null);
  const found = style !== null;

  const vitalResults: Record<StyleVitalKey, VitalMatchResult> = {} as Record<StyleVitalKey, VitalMatchResult>;

  let presentedCount = 0;
  let inRangeCount = 0;

  for (const key of VITAL_KEYS) {
    const input = vitals[key];
    const present = Number.isFinite(input);
    let inRange: boolean | null = null;

    if (present && found && style) {
      inRange = isValueInRange(input as number, style[key]);
      if (inRange) inRangeCount += 1;
    }
    if (present) presentedCount += 1;

    vitalResults[key] = {
      key,
      present,
      value: present ? (input as number) : null,
      low: found && style ? style[key].low : 0,
      high: found && style ? style[key].high : 0,
      inRange,
    };
  }

  const allInRange =
    found && presentedCount > 0 ? inRangeCount === presentedCount : null;

  let verdict: StyleMatchResult['verdict'] = null;
  if (found && presentedCount > 0) {
    if (inRangeCount === presentedCount) {
      verdict = 'full';
    } else if (inRangeCount === 0) {
      verdict = 'none';
    } else {
      verdict = 'partial';
    }
  }

  return {
    styleId,
    found,
    style,
    vitals: vitalResults,
    presentedCount,
    inRangeCount,
    outOfRangeCount: presentedCount - inRangeCount,
    allInRange,
    verdict,
  };
}
