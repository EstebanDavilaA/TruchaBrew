// M38_P2: BJCP 2021 style-guideline types. Types only — no runtime code.

// The five recipe vitals the app computes and BJCP publishes guideline ranges for.
export type StyleVitalKey = 'og' | 'fg' | 'abv' | 'ibu' | 'srm';

// Inclusive closed interval [low, high]. low <= high always.
export interface RangeSpec {
  low: number; // inclusive lower bound
  high: number; // inclusive upper bound
}

// One official BJCP 2021 style's guideline ranges.
export interface BJCPStyle {
  id: string; // official style code, e.g. '21A' (category digits + letter)
  name: string; // official style name, e.g. 'American IPA'
  og: RangeSpec; // original gravity, SPECIFIC GRAVITY (SG), e.g. { low: 1.056, high: 1.070 }
  fg: RangeSpec; // final gravity, SPECIFIC GRAVITY (SG)
  abv: RangeSpec; // alcohol by volume, percent
  ibu: RangeSpec; // International Bitterness Units
  srm: RangeSpec; // Standard Reference Method color
}

// The recipe vitals fed to the evaluator. Field names match CalculatedStats;
// each field optional/nullable so a partial or not-yet-measured recipe works.
export interface RecipeVitals {
  og?: number | null; // SG
  fg?: number | null; // SG
  abv?: number | null; // percent
  ibu?: number | null;
  srm?: number | null; // SRM
}

export interface VitalMatchResult {
  key: StyleVitalKey;
  present: boolean; // false when input was undefined/null/non-finite
  value: number | null; // the input value when present, else null
  low: number; // style lower bound (0 when !found)
  high: number; // style upper bound (0 when !found)
  inRange: boolean | null; // low<=value<=high when present AND found; null otherwise
}

export type StyleMatchVerdict = 'full' | 'partial' | 'none';

export interface StyleMatchResult {
  styleId: string;
  found: boolean; // false when styleId has no dataset entry
  style: BJCPStyle | null; // the matched style, else null
  vitals: Record<StyleVitalKey, VitalMatchResult>;
  presentedCount: number; // count of present (finite) vital inputs
  inRangeCount: number; // count of present vitals that are in range
  outOfRangeCount: number; // presentedCount - inRangeCount
  allInRange: boolean | null; // null when !found OR presentedCount===0
  verdict: StyleMatchVerdict | null; // null when !found OR presentedCount===0
}
