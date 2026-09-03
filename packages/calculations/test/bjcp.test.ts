import { describe, it, expect } from 'vitest';
// Import from the top-level barrel to exercise AC-31 (package surface).
import {
  BJCP_STYLES,
  BJCP_STYLE_COUNT,
  isValueInRange,
  evaluateStyleMatch,
  calculateBJCPScore,
} from '../src/index';
import type {
  BJCPStyle,
  RecipeVitals,
  RangeSpec,
  StyleMatchResult,
  StyleMatchVerdict,
  StyleVitalKey,
  VitalMatchResult,
  // Existing BJCP-*sensory* surface must still resolve (not shadowed) — AC-31.
  BJCPTier,
  SensoryScoreInput,
  BJCPScoreResult,
} from '../src/index';

const ALL_KEYS: StyleVitalKey[] = ['og', 'fg', 'abv', 'ibu', 'srm'];
const ALL_VERDICTS: StyleMatchVerdict[] = ['full', 'partial', 'none'];

function byId(id: string): BJCPStyle {
  const style = BJCP_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`expected style ${id} present in BJCP_STYLES`);
  return style;
}

function categoryOf(id: string): number {
  const m = /^(\d+)/.exec(id);
  if (!m) throw new Error(`unparseable style id: ${id}`);
  return Number.parseInt(m[1], 10);
}

describe('AC-1: BJCP_STYLES is the complete official range-carrying set', () => {
  it('contains exactly 86 styles (categories 1-26, 1A-26D)', () => {
    expect(BJCP_STYLES).toBeDefined();
    expect(Array.isArray(BJCP_STYLES)).toBe(true);
    expect(BJCP_STYLES.length).toBe(86);
  });

  it('every element is a valid BJCPStyle-shaped object', () => {
    for (const style of BJCP_STYLES) {
      expect(typeof style.id).toBe('string');
      expect(typeof style.name).toBe('string');
      for (const key of ALL_KEYS) {
        const range = style[key];
        expect(range).toBeDefined();
        expect(typeof range.low).toBe('number');
        expect(typeof range.high).toBe('number');
      }
    }
  });
});

describe('AC-2: full category coverage 1..26', () => {
  it('every integer category code 1..26 has at least one style', () => {
    const covered = new Set(BJCP_STYLES.map((s) => categoryOf(s.id)));
    for (let category = 1; category <= 26; category += 1) {
      expect(covered.has(category)).toBe(true);
    }
  });

  it('RA-13: no style from categories 27-34 is present (no fabricated entries)', () => {
    for (const style of BJCP_STYLES) {
      expect(categoryOf(style.id)).toBeLessThanOrEqual(26);
      expect(categoryOf(style.id)).toBeGreaterThanOrEqual(1);
    }
    // None of the well-known category-27+ ids leak in.
    for (const id of ['27A', '28A', '28D', '29A', '29C', '30A', '31A', '32A', '33A', '34A', '34C', 'X1']) {
      expect(BJCP_STYLES.some((s) => s.id === id)).toBe(false);
    }
  });
});

describe('AC-3: unique style ids', () => {
  it('no two styles share an id', () => {
    const ids = BJCP_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(86);
  });
});

describe('AC-4: style id format', () => {
  it('every id matches /^\\d{1,2}[A-Z]$/', () => {
    for (const style of BJCP_STYLES) {
      expect(style.id).toMatch(/^\d{1,2}[A-Z]$/);
    }
  });
});

describe('AC-5: every style has all five vitals, finite and low <= high', () => {
  it('all five RangeSpecs present, finite, ordered low <= high', () => {
    for (const style of BJCP_STYLES) {
      for (const key of ALL_KEYS) {
        const { low, high } = style[key];
        expect(Number.isFinite(low)).toBe(true);
        expect(Number.isFinite(high)).toBe(true);
        expect(low).toBeLessThanOrEqual(high);
      }
    }
  });
});

describe('AC-6: physical-domain sanity bounds', () => {
  it('og >= 1.000, fg >= 0.990, abv/ibu/srm >= 0, all highs finite', () => {
    for (const style of BJCP_STYLES) {
      expect(style.og.low).toBeGreaterThanOrEqual(1.0);
      expect(style.fg.low).toBeGreaterThanOrEqual(0.99);
      expect(style.abv.low).toBeGreaterThanOrEqual(0);
      expect(style.ibu.low).toBeGreaterThanOrEqual(0);
      expect(style.srm.low).toBeGreaterThanOrEqual(0);
      for (const key of ALL_KEYS) {
        expect(Number.isFinite(style[key].high)).toBe(true);
        expect(style[key].low).toBeLessThanOrEqual(style[key].high);
      }
    }
  });
});

describe('AC-7..AC-13: spot checks against official ranges', () => {
  const cases: Array<{ id: string; name: string; og: [number, number]; fg: [number, number]; abv: [number, number]; ibu: [number, number]; srm: [number, number] }> = [
    // AC-7  American IPA
    { id: '21A', name: 'American IPA', og: [1.056, 1.07], fg: [1.008, 1.014], abv: [5.5, 7.5], ibu: [40, 70], srm: [6, 14] },
    // AC-8  American Pale Ale
    { id: '18B', name: 'American Pale Ale', og: [1.045, 1.06], fg: [1.01, 1.015], abv: [4.5, 6.2], ibu: [30, 50], srm: [5, 10] },
    // AC-9  Weissbier
    { id: '10A', name: 'Weissbier', og: [1.044, 1.053], fg: [1.008, 1.014], abv: [4.3, 5.6], ibu: [8, 15], srm: [2, 6] },
    // AC-10 Czech Premium Pale Lager
    { id: '3B', name: 'Czech Premium Pale Lager', og: [1.044, 1.06], fg: [1.013, 1.017], abv: [4.2, 5.8], ibu: [30, 45], srm: [3.5, 6] },
    // AC-11 Vienna Lager
    { id: '7A', name: 'Vienna Lager', og: [1.048, 1.055], fg: [1.01, 1.014], abv: [4.7, 5.5], ibu: [18, 30], srm: [9, 15] },
    // AC-12 American Porter
    { id: '20A', name: 'American Porter', og: [1.05, 1.07], fg: [1.012, 1.018], abv: [4.8, 6.5], ibu: [25, 50], srm: [22, 40] },
    // AC-13 American Light Lager
    { id: '1A', name: 'American Light Lager', og: [1.028, 1.04], fg: [0.998, 1.008], abv: [2.8, 4.2], ibu: [8, 12], srm: [2, 3] },
  ];

  for (const { id, name, og, fg, abv, ibu, srm } of cases) {
    it(`${id} ${name} matches the official ranges exactly`, () => {
      const style = byId(id);
      expect(style.name).toBe(name);
      expect(style.og).toEqual({ low: og[0], high: og[1] });
      expect(style.fg).toEqual({ low: fg[0], high: fg[1] });
      expect(style.abv).toEqual({ low: abv[0], high: abv[1] });
      expect(style.ibu).toEqual({ low: ibu[0], high: ibu[1] });
      expect(style.srm).toEqual({ low: srm[0], high: srm[1] });
    });
  }
});

describe('AC-14: BJCP_STYLE_COUNT guard', () => {
  it('BJCP_STYLE_COUNT equals BJCP_STYLES.length (86)', () => {
    expect(BJCP_STYLE_COUNT).toBe(BJCP_STYLES.length);
    expect(BJCP_STYLE_COUNT).toBe(86);
  });
});

describe('AC-15: full-match verdict (mid-range)', () => {
  it('all five mid-range vitals for 21A => full', () => {
    const result: StyleMatchResult = evaluateStyleMatch('21A', {
      og: 1.06,
      fg: 1.011,
      abv: 6.5,
      ibu: 55,
      srm: 10,
    });
    expect(result.found).toBe(true);
    expect(result.styleId).toBe('21A');
    expect(result.style?.id).toBe('21A');
    expect(result.presentedCount).toBe(5);
    expect(result.inRangeCount).toBe(5);
    expect(result.outOfRangeCount).toBe(0);
    expect(result.allInRange).toBe(true);
    expect(result.verdict).toBe('full');
    for (const key of ALL_KEYS) {
      expect(result.vitals[key].present).toBe(true);
      expect(result.vitals[key].inRange).toBe(true);
    }
  });
});

describe('AC-16: inclusive lower bound', () => {
  it('21A og == low (1.056) and srm == low (6) are in range', () => {
    const result = evaluateStyleMatch('21A', { og: 1.056, srm: 6 });
    expect(result.vitals.og.inRange).toBe(true);
    expect(result.vitals.srm.inRange).toBe(true);
    expect(result.vitals.og.value).toBe(1.056);
    expect(result.vitals.srm.value).toBe(6);
  });
});

describe('AC-17: inclusive upper bound', () => {
  it('21A og == high (1.07) and ibu == high (70) are in range', () => {
    const result = evaluateStyleMatch('21A', { og: 1.07, ibu: 70 });
    expect(result.vitals.og.inRange).toBe(true);
    expect(result.vitals.ibu.inRange).toBe(true);
  });
});

describe('AC-18: exclusive just-outside bounds', () => {
  it('og high+0.001 (1.071) and low-0.001 (1.055) are out of range', () => {
    const result = evaluateStyleMatch('21A', { og: 1.071, srm: 5.999 });
    expect(result.vitals.og.inRange).toBe(false);
    expect(result.vitals.srm.inRange).toBe(false);
    const below = evaluateStyleMatch('21A', { og: 1.055 });
    expect(below.vitals.og.inRange).toBe(false);
  });

  it('same boundary convention for abv (5.5-7.5) and srm (6-14) on 21A', () => {
    // in-range at both exact endpoints
    const endpoints = evaluateStyleMatch('21A', { abv: 5.5, srm: 6 });
    expect(endpoints.vitals.abv.inRange).toBe(true);
    expect(endpoints.vitals.srm.inRange).toBe(true);
    const endpointsHigh = evaluateStyleMatch('21A', { abv: 7.5, srm: 14 });
    expect(endpointsHigh.vitals.abv.inRange).toBe(true);
    expect(endpointsHigh.vitals.srm.inRange).toBe(true);
    // just outside
    const outside = evaluateStyleMatch('21A', { abv: 5.499, srm: 5.999 });
    expect(outside.vitals.abv.inRange).toBe(false);
    expect(outside.vitals.srm.inRange).toBe(false);
    const outsideHigh = evaluateStyleMatch('21A', { abv: 7.501, srm: 14.001 });
    expect(outsideHigh.vitals.abv.inRange).toBe(false);
    expect(outsideHigh.vitals.srm.inRange).toBe(false);
  });
});

describe('AC-19: partial verdict', () => {
  it('21A { og in range, abv out of range } => partial', () => {
    const result = evaluateStyleMatch('21A', { og: 1.06, abv: 12 });
    expect(result.found).toBe(true);
    expect(result.presentedCount).toBe(2);
    expect(result.inRangeCount).toBe(1);
    expect(result.outOfRangeCount).toBe(1);
    expect(result.allInRange).toBe(false);
    expect(result.verdict).toBe('partial');
    expect(result.vitals.og.inRange).toBe(true);
    expect(result.vitals.abv.inRange).toBe(false);
  });
});

describe('AC-20: none verdict', () => {
  it('21A { og 1.1 out, abv 12 out } => none', () => {
    const result = evaluateStyleMatch('21A', { og: 1.1, abv: 12 });
    expect(result.presentedCount).toBe(2);
    expect(result.inRangeCount).toBe(0);
    expect(result.outOfRangeCount).toBe(2);
    expect(result.allInRange).toBe(false);
    expect(result.verdict).toBe('none');
  });
});

describe('AC-21: unknown style id (no-match contract)', () => {
  it('999Z => found:false, no throw, every per-vital inRange null', () => {
    expect(() => evaluateStyleMatch('999Z', { og: 1.06 })).not.toThrow();
    const result = evaluateStyleMatch('999Z', { og: 1.06 });
    expect(result.found).toBe(false);
    expect(result.style).toBeNull();
    expect(result.verdict).toBeNull();
    expect(result.allInRange).toBeNull();
    expect(result.presentedCount).toBe(1); // og is still a finite input
    expect(result.inRangeCount).toBe(0);
    for (const key of ALL_KEYS) {
      expect(result.vitals[key].inRange).toBeNull();
    }
    // present input keeps its value but gets no guideline bounds
    expect(result.vitals.og.present).toBe(true);
    expect(result.vitals.og.value).toBe(1.06);
    expect(result.vitals.og.low).toBe(0);
    expect(result.vitals.og.high).toBe(0);
  });

  it('a real category-27+ id (29A Fruit Beer) also returns found:false (RA-13)', () => {
    const result = evaluateStyleMatch('29A', { og: 1.06 });
    expect(result.found).toBe(false);
    expect(result.verdict).toBeNull();
    expect(result.allInRange).toBeNull();
  });
});

describe('AC-22: empty vitals (no-match contract despite found style)', () => {
  it('21A with {} => found:true, presentedCount 0, verdict null, no fabricated ranges', () => {
    const result = evaluateStyleMatch('21A', {});
    expect(result.found).toBe(true);
    expect(result.style?.id).toBe('21A');
    expect(result.presentedCount).toBe(0);
    expect(result.inRangeCount).toBe(0);
    expect(result.outOfRangeCount).toBe(0);
    expect(result.allInRange).toBeNull();
    expect(result.verdict).toBeNull();
    for (const key of ALL_KEYS) {
      expect(result.vitals[key].present).toBe(false);
      expect(result.vitals[key].value).toBeNull();
      expect(result.vitals[key].inRange).toBeNull();
      // found style: bounds still populated
      expect(result.vitals[key].low).toBe(byId('21A')[key].low);
      expect(result.vitals[key].high).toBe(byId('21A')[key].high);
    }
  });
});

describe('AC-23: null / non-finite vitals excluded', () => {
  it('all-non-finite inputs => presentedCount 0, verdict null, no throw', () => {
    expect(() =>
      evaluateStyleMatch('21A', { og: null, fg: undefined, abv: NaN, ibu: Infinity }),
    ).not.toThrow();
    const result = evaluateStyleMatch('21A', { og: null, fg: undefined, abv: NaN, ibu: Infinity });
    expect(result.presentedCount).toBe(0);
    expect(result.inRangeCount).toBe(0);
    expect(result.allInRange).toBeNull();
    expect(result.verdict).toBeNull();
    for (const key of ALL_KEYS) {
      expect(result.vitals[key].present).toBe(false);
      expect(result.vitals[key].value).toBeNull();
      expect(result.vitals[key].inRange).toBeNull();
    }
  });

  it('mixed present + non-finite => only finite og is evaluated', () => {
    const result = evaluateStyleMatch('21A', { og: 1.06, abv: NaN });
    expect(result.presentedCount).toBe(1);
    expect(result.vitals.og.present).toBe(true);
    expect(result.vitals.og.inRange).toBe(true);
    expect(result.vitals.abv.present).toBe(false);
    expect(result.vitals.abv.inRange).toBeNull();
    expect(result.inRangeCount).toBe(1);
    expect(result.verdict).toBe('full');
  });

  it('partial-present case: null fg excluded but does not disturb verdict math', () => {
    const result = evaluateStyleMatch('21A', { og: 1.06, fg: null, abv: 12 });
    expect(result.presentedCount).toBe(2);
    expect(result.vitals.fg.present).toBe(false);
    expect(result.vitals.og.present).toBe(true);
    expect(result.vitals.abv.present).toBe(true);
    expect(result.inRangeCount).toBe(1);
    expect(result.verdict).toBe('partial');
  });
});

describe('AC-24: single present vital', () => {
  it('18B { og: 1.05 } => full (only vital in range)', () => {
    const result = evaluateStyleMatch('18B', { og: 1.05 });
    expect(result.found).toBe(true);
    expect(result.presentedCount).toBe(1);
    expect(result.inRangeCount).toBe(1);
    expect(result.outOfRangeCount).toBe(0);
    expect(result.allInRange).toBe(true);
    expect(result.verdict).toBe('full');
    expect(result.vitals.og.inRange).toBe(true);
  });

  it('18B { og: 1.08 } => none', () => {
    const result = evaluateStyleMatch('18B', { og: 1.08 });
    expect(result.presentedCount).toBe(1);
    expect(result.inRangeCount).toBe(0);
    expect(result.allInRange).toBe(false);
    expect(result.verdict).toBe('none');
    expect(result.vitals.og.inRange).toBe(false);
  });
});

describe('AC-25: empty injected dataset (degenerate)', () => {
  it('evaluateStyleMatch("21A", { og: 1.06 }, []) => found:false, verdict null', () => {
    const result = evaluateStyleMatch('21A', { og: 1.06 }, []);
    expect(result.found).toBe(false);
    expect(result.style).toBeNull();
    expect(result.verdict).toBeNull();
    expect(result.allInRange).toBeNull();
    expect(result.vitals.og.inRange).toBeNull();
  });
});

describe('AC-26: default dataset param', () => {
  it('2-arg call resolves against BJCP_STYLES', () => {
    const result = evaluateStyleMatch('21A', { og: 1.06 });
    expect(result.found).toBe(true);
    expect(result.vitals.og.inRange).toBe(true);
  });

  it('explicitly passing BJCP_STYLES as third arg behaves identically', () => {
    const a = evaluateStyleMatch('21A', { og: 1.06 });
    const b = evaluateStyleMatch('21A', { og: 1.06 }, BJCP_STYLES);
    expect(b.found).toBe(true);
    expect(b).toEqual(a);
  });
});

describe('AC-27: determinism & no mutation', () => {
  it('identical calls yield deep-equal results and fresh objects', () => {
    const vitals: RecipeVitals = { og: 1.06, fg: 1.011, abv: 6.5, ibu: 55, srm: 10 };
    const first = evaluateStyleMatch('21A', vitals);
    const second = evaluateStyleMatch('21A', vitals);
    expect(second).toEqual(first);
    // fresh output objects, not reused across calls
    expect(first).not.toBe(second);
    expect(first.vitals).not.toBe(second.vitals);
    expect(first.vitals.og).not.toBe(second.vitals.og);
  });

  it('mutating a returned result does not corrupt later calls or the dataset', () => {
    const before = byId('21A').og;
    const first = evaluateStyleMatch('21A', { og: 1.06, abv: 6.5 });
    // caller-owned mutation of the returned per-vital objects
    first.vitals.og.value = 999;
    first.vitals.og.inRange = false;
    first.verdict = 'none';
    const again = evaluateStyleMatch('21A', { og: 1.06, abv: 6.5 });
    expect(again.vitals.og.value).toBe(1.06);
    expect(again.vitals.og.inRange).toBe(true);
    expect(again.verdict).toBe('full');
    // dataset untouched
    expect(byId('21A').og).toEqual(before);
    expect(byId('21A').og).toEqual({ low: 1.056, high: 1.07 });
    // input vitals untouched
    const input: RecipeVitals = { og: 1.06 };
    evaluateStyleMatch('21A', input);
    expect(input.og).toBe(1.06);
  });
});

describe('AC-28: gravity is SG (no Plato confusion)', () => {
  it('21A og 1.060 (SG) is in range; og 15 (would-be Plato) is out of range', () => {
    const sg = evaluateStyleMatch('21A', { og: 1.06 });
    expect(sg.vitals.og.inRange).toBe(true);
    const plato = evaluateStyleMatch('21A', { og: 15 });
    expect(plato.vitals.og.present).toBe(true);
    expect(plato.vitals.og.inRange).toBe(false);
  });
});

describe('AC-29: color is SRM only', () => {
  it('21A { srm: 10 } => srm in range', () => {
    const result = evaluateStyleMatch('21A', { srm: 10 });
    expect(result.presentedCount).toBe(1);
    expect(result.vitals.srm.present).toBe(true);
    expect(result.vitals.srm.inRange).toBe(true);
  });

  it('an ebc field is ignored and does not affect presentedCount', () => {
    const withEbc = { srm: 10, ebc: 30 } as RecipeVitals;
    const result = evaluateStyleMatch('21A', withEbc);
    expect(result.presentedCount).toBe(1);
    expect(result.inRangeCount).toBe(1);
    expect(result.vitals.srm.inRange).toBe(true);
    expect(result.verdict).toBe('full');
  });
});

describe('AC-31: barrel export integrity (no collision)', () => {
  it('all new symbols resolve from the top-level barrel', () => {
    expect(BJCP_STYLES).toBeDefined();
    expect(BJCP_STYLES.length).toBe(86);
    expect(BJCP_STYLE_COUNT).toBe(86);
    expect(typeof isValueInRange).toBe('function');
    expect(typeof evaluateStyleMatch).toBe('function');
  });

  it('existing BJCP-sensory surface still resolves and is not shadowed', () => {
    expect(typeof calculateBJCPScore).toBe('function');
    const input: SensoryScoreInput = { aroma: 10, appearance: 3, flavor: 18, mouthfeel: 5, overall: 9 };
    const score: BJCPScoreResult = calculateBJCPScore(input);
    const tier: BJCPTier = score.tier;
    expect(score.totalScore).toBe(45);
    expect(tier).toBe('Outstanding');
    expect(score.suggestedStarRating).toBe(5);
    expect(ALL_VERDICTS).not.toContain(tier);
  });

  it('the new evaluator and the sensory scorer are distinct functions', () => {
    expect(evaluateStyleMatch).not.toBe(calculateBJCPScore);
    const sensory = calculateBJCPScore({ aroma: 1, appearance: 1, flavor: 1, mouthfeel: 1, overall: 1 });
    const styleMatch = evaluateStyleMatch('21A', { og: 1.06 });
    // sensory tiers are strings but distinct domain from style-match verdicts
    expect(typeof sensory.tier).toBe('string');
    expect(styleMatch.verdict).not.toBeNull();
  });

  it('the new types resolve (compile-time) and shape runtime values', () => {
    const style: BJCPStyle = byId('21A');
    const range: RangeSpec = style.og;
    const result: StyleMatchResult = evaluateStyleMatch('21A', { og: range.low });
    const ogResult: VitalMatchResult = result.vitals.og;
    const verdict: StyleMatchVerdict | null = result.verdict;
    const keyList: StyleVitalKey[] = Object.keys(result.vitals) as StyleVitalKey[];
    expect(ogResult.inRange).toBe(true);
    expect(verdict).toBe('full');
    expect(keyList).toEqual(ALL_KEYS);
  });

  it('isValueInRange is independently exported and inclusive', () => {
    const r: RangeSpec = { low: 1.0, high: 2.0 };
    expect(isValueInRange(1.0, r)).toBe(true);
    expect(isValueInRange(2.0, r)).toBe(true);
    expect(isValueInRange(0.999, r)).toBe(false);
    expect(isValueInRange(2.001, r)).toBe(false);
  });
});
