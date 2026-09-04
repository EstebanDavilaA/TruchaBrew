import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CONTROL_HEIGHT_CLASS,
  CONTROL_MIN_HEIGHT_CLASS,
  ICON_CONTROL_SIZE_CLASS,
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  BUTTON_DANGER_CLASS,
  BUTTON_ICON_CLASS,
} from '../src/components/designSystem';

// M40_P1 AC-16, AC-17 / M40_P3 — static 44px control-target-size floor sweep.
//
// RA-8 (M40_P1, still binding): the suite runs on jsdom, which performs NO
// layout — getBoundingClientRect() returns zeros here and cannot prove a
// pixel height. This file is therefore a static source assertion, not a
// rendered measurement: it reads files from disk with fs/path (same style
// as the existing M35_P4/M36_P2 sweeps in uiPrimitives.test.tsx) and renders
// nothing. Real-pixel confirmation is the manual on-device evidence (AC-19),
// not a test.

const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
const PAGES_DIR = path.resolve(__dirname, '../src/pages');
const UI_DIR = path.join(COMPONENTS_DIR, 'ui');
const SRC_ROOT = path.resolve(__dirname, '../src');

// RA-9 (M40_P1, extended M40_P2, UNCHANGED here per M40_P3 RA-1): these three
// tokens deliberately omit CONTROL_HEIGHT_CLASS and remain exempt from the
// >=44px floor — dense in-table row editing (fermentable/yeast rows) and
// borderless inline metadata fields, a knowing, documented WCAG 2.5.5
// deviation carried forward from M30/M40_P2, not silently introduced here.
// A match on an <input>/<select>/<button> opening tag that references one of
// these identifiers by name is not a defect and is excluded from AC-17
// below. M40_P3 RA-1 is explicit that this list is NOT extended to cover
// Button tokens: size="sm" action buttons (Deduct, delete, ...) get no
// exemption, unlike compact number/select fields — a mistap on a compact
// field is self-correcting, a mistap on a destructive action button is not.
const RA9_COMPACT_VARIANT_EXEMPTIONS = ['INPUT_COMPACT_CLASS', 'FORM_SELECT_COMPACT_CLASS', 'INPUT_UNDERLINE_CLASS'];

const SUB_44PX_HEIGHT_CLASSES = ['h-10', 'h-9', 'h-8', 'min-h-10'];

// M40_P3 RA-8: ui/StickyJumpNav.tsx has zero JSX consumers today (recorded
// in M40_P2's roadmap correction) — it renders nowhere, so it cannot be a
// real touch target. Excluded from every static scan below BY NAME, not
// deleted and not silently skipped.
const STICKY_JUMP_NAV_FILE = path.join(UI_DIR, 'StickyJumpNav.tsx');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// M40_P3 RA-6 — resolveControlHeightPx (binding algorithm)
// ---------------------------------------------------------------------------

type HeightBasis = 'height' | 'min-height' | 'padding';

/** Tailwind v4 default line-heights for the five documented text-size
 * utilities (RA-6 §2). Any other bare `text-<size-like-suffix>` utility
 * (e.g. text-2xl, text-9xl) is treated as an attempted text-size utility
 * this resolver does not know how to resolve, and THROWS rather than
 * guessing. Colour utilities (text-white, text-slate-400, ...), alignment
 * utilities (text-left, text-center, ...) and any other "text-*" utility
 * that isn't a size keyword are a different Tailwind category entirely and
 * are silently ignored — RA-6 only constrains resolution of text-SIZE
 * utilities, never colour/alignment/decoration ones. */
const TEXT_SIZE_LINE_HEIGHT_PX: Record<string, number> = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 28,
};

/** A bare `text-<suffix>` token is a *candidate* size utility only if its
 * suffix looks like one of Tailwind's size-scale names (xs/sm/base/lg/xl,
 * or the open-ended N-xl scale: 2xl, 3xl, ...). Anything else (a colour
 * name, "left"/"center"/"right", etc.) is not a sizing attempt at all. */
const TEXT_SIZE_SUFFIX_PATTERN = /^(xs|sm|base|lg|xl|\d+xl)$/;

/**
 * Total border contribution to *vertical* height, in px, from every
 * `border*` utility in `classes` (RA-6 §2):
 *   - a bare `border` token ⇒ 2 (both sides' 1px default).
 *   - `border-<N>` (a width utility, N numeric) ⇒ N * 2 (both sides).
 *   - a directional utility: `border-t` / `border-b` (optionally with a
 *     `-<width-or-colour>` suffix) ⇒ 1 each (one side only); `border-y`
 *     (both vertical sides) ⇒ 2; `border-l` / `border-r` / `border-x`
 *     (horizontal only) ⇒ 0, since they cannot affect height.
 *   - any other `border-<...>` token (a colour utility such as
 *     `border-slate-700`, `border-transparent`, `border-amber-500/30`) ⇒ 0.
 * Distinguishing a directional utility (`border-b`) from a colour utility
 * that happens to start with the same letter (`border-blue-500`,
 * `border-teal-700`) requires checking that the character *after* the
 * single direction letter is either end-of-string or a `-` — a colour name
 * never satisfies that.
 */
function computeBorderPx(classes: string[]): number {
  let total = 0;
  for (const cls of classes) {
    if (cls === 'border') {
      total += 2;
      continue;
    }
    const widthMatch = /^border-(\d+)$/.exec(cls);
    if (widthMatch) {
      total += Number(widthMatch[1]) * 2;
      continue;
    }
    const directionalMatch = /^border-([trblxy])(?:-.*)?$/.exec(cls);
    if (directionalMatch) {
      const dir = directionalMatch[1];
      if (dir === 't' || dir === 'b') total += 1;
      else if (dir === 'y') total += 2;
      // 'l', 'r', 'x' are horizontal-only — no vertical height contribution.
      continue;
    }
    // Anything else starting with "border-" (border-slate-700,
    // border-transparent, border-amber-500/30, ...) is a colour-only
    // utility — contributes 0.
  }
  return total;
}

/**
 * Resolves a Tailwind utility class string to a CSS pixel height, per
 * M40_P3 RA-6's binding resolution order:
 *   1. A bare `h-<N>` utility ⇒ px = N * 4, basis 'height'.
 *   2. Else a bare `min-h-<N>` utility ⇒ px = N * 4, basis 'min-height'
 *      (padding/border are NOT added on top — the height class
 *      short-circuits).
 *   3. Else padding-derived, basis 'padding':
 *        px = contentPx + padTop + padBottom + borderPx
 *      padTop/padBottom come from `py-<N>` if present, else from `p-<N>`
 *      (`py-*` wins when both appear), each N * 4 px per side. `px-<N>`
 *      (horizontal-only padding) never contributes — RA-6 names only
 *      py-/p- as height-affecting padding sources. contentPx is the
 *      caller-supplied override when given, else the Tailwind default
 *      line-height of the string's text-size utility (see
 *      TEXT_SIZE_LINE_HEIGHT_PX above), else 20 (inherited text-sm body
 *      default).
 *   4. Any h-/min-h-/p-/py-/text-size utility whose value cannot be parsed
 *      (arbitrary values like h-[42px], fractional/keyword forms like
 *      h-full, an unlisted text-size like text-2xl) THROWS, naming the
 *      offending class. No silent fallback.
 *
 * Pure function of a string (+ optional numeric override): same input ⇒
 * same output. No filesystem access, no React, no module-level mutable
 * state, no `process`/`fs` consulted here (those live only in the it()
 * bodies below, per M40_P1's original structure).
 *
 * Supersedes P1's `resolveTailwindHeightPx`, which deliberately refused
 * `min-h-*` — RA-3 now requires it (removed, no shim/re-export left behind).
 */
function resolveControlHeightPx(
  classString: string,
  contentPx?: number,
): { px: number; basis: HeightBasis } {
  const classes = classString.split(/\s+/).filter(Boolean);

  // Rule 1: bare h-<N>.
  for (const cls of classes) {
    if (/^h-/.test(cls)) {
      const match = /^h-(\d+(?:\.\d+)?)$/.exec(cls);
      if (match) {
        return { px: Number(match[1]) * 4, basis: 'height' };
      }
      throw new Error(
        `resolveControlHeightPx: cannot resolve Tailwind height utility "${cls}" — expected a bare h-<N> class`,
      );
    }
  }

  // Rule 2: bare min-h-<N>.
  for (const cls of classes) {
    if (/^min-h-/.test(cls)) {
      const match = /^min-h-(\d+(?:\.\d+)?)$/.exec(cls);
      if (match) {
        return { px: Number(match[1]) * 4, basis: 'min-height' };
      }
      throw new Error(
        `resolveControlHeightPx: cannot resolve Tailwind min-height utility "${cls}" — expected a bare min-h-<N> class`,
      );
    }
  }

  // Rule 3: padding-derived.
  let pValue: number | null = null;
  let pyValue: number | null = null;

  for (const cls of classes) {
    if (/^py-/.test(cls)) {
      const match = /^py-(\d+(?:\.\d+)?)$/.exec(cls);
      if (!match) {
        throw new Error(`resolveControlHeightPx: cannot resolve Tailwind padding utility "${cls}"`);
      }
      pyValue = Number(match[1]);
    } else if (/^p-/.test(cls)) {
      const match = /^p-(\d+(?:\.\d+)?)$/.exec(cls);
      if (!match) {
        throw new Error(`resolveControlHeightPx: cannot resolve Tailwind padding utility "${cls}"`);
      }
      pValue = Number(match[1]);
    }
  }

  const padUnit = pyValue !== null ? pyValue : pValue !== null ? pValue : 0;
  const padTop = padUnit * 4;
  const padBottom = padUnit * 4;

  const borderPx = computeBorderPx(classes);

  let resolvedContentPx = contentPx;
  if (resolvedContentPx === undefined) {
    resolvedContentPx = 20;
    for (const cls of classes) {
      const match = /^text-([a-z0-9]+)$/.exec(cls);
      if (!match) continue;
      const suffix = match[1];
      if (!TEXT_SIZE_SUFFIX_PATTERN.test(suffix)) continue; // not a size utility (colour/alignment/...) — ignore
      if (Object.prototype.hasOwnProperty.call(TEXT_SIZE_LINE_HEIGHT_PX, suffix)) {
        resolvedContentPx = TEXT_SIZE_LINE_HEIGHT_PX[suffix];
      } else {
        throw new Error(`resolveControlHeightPx: cannot resolve Tailwind text-size utility "${cls}"`);
      }
      break;
    }
  }

  return {
    px: resolvedContentPx + padTop + padBottom + borderPx,
    basis: 'padding',
  };
}

// ---------------------------------------------------------------------------
// M40_P3 RA-7 / AC-12 — frozen raw <button> sub-44px allowlist
// ---------------------------------------------------------------------------

// Files excluded from the raw-<button> scan below, by name:
//  - ui/Button.tsx: this IS the primitive. Its <button> composes
//    `mergedClass`, a runtime variable, not a literal class string, and its
//    resolved height is already covered by the AC-4/AC-5/AC-6 token-level
//    assertions above — it is not a "raw button" in RA-7's sense.
//  - ui/StickyJumpNav.tsx: RA-8, see above.
const RAW_BUTTON_SCAN_EXCLUDED_FILES = [path.join(UI_DIR, 'Button.tsx'), STICKY_JUMP_NAV_FILE];

/**
 * M40_P3 RA-7/AC-12: the frozen, enumerated set of known padding-derived
 * sub-44px raw <button> sites under src/components/ and src/pages/,
 * verified against the working tree at drafting time (file:line drifts —
 * re-verify rather than trust old citations). Discovery below must equal
 * this set exactly; a newly introduced sub-44px raw button fails the suite.
 *
 * Migrating any of these onto the Button primitive is explicitly out of
 * scope for this phase (RA-7/RA-10) — this is documented debt, not a gap.
 */
const RAW_BUTTON_SUB_44PX_ALLOWLIST: string[] = [
  'components/BrewDayTracker.tsx:541',
  'components/CellarActionFeed.tsx:183',
  'components/EquipmentForm.tsx:399',
  'components/FermentationProfileForm.tsx:174',
  'components/FermentationProfileForm.tsx:291',
  'components/FermentationProfileForm.tsx:300',
  'components/FermentationProfileForm.tsx:309',
  'components/MashProfileForm.tsx:185',
  'components/MashProfileForm.tsx:345',
  'components/MashProfileForm.tsx:354',
  'components/MashProfileForm.tsx:363',
  'components/MobileNav.tsx:64',
  'components/WaterProfileForm.tsx:155',
  'components/WaterSection.tsx:115',
  'pages/BatchList.tsx:50',
].sort();

/**
 * Scans from `startIdx` (the `<` of an opening tag) for that tag's closing
 * `>`, tracking `{...}` brace depth so a `>` inside a JS expression
 * attribute value (an arrow function `() =>`, a comparison, nested JSX
 * returned from a callback, ...) does not prematurely end the match. A
 * naive `[^>]*>` regex — as M40_P1's original AC-17 scan uses, safely,
 * because it only needs to detect *presence* of a substring anywhere in
 * whatever it happens to capture — is not reliable here because this scan
 * needs the *exact* className and an accurate line number.
 */
function extractOpeningTag(content: string, startIdx: number): string {
  let i = startIdx;
  let depth = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) {
      return content.slice(startIdx, i + 1);
    }
    i++;
  }
  throw new Error(`controlTargetSize sweep: unterminated tag starting at index ${startIdx}`);
}

/**
 * Discovers every raw `<button>` element (case-sensitive — this deliberately
 * excludes `<Button ...>` primitive usages) under src/components/ and
 * src/pages/ whose className is a plain quoted string literal (not a
 * template literal or other expression) and whose resolved height is
 * <44px.
 *
 * Scope limitation (flagged for critic attention, not covered by name in
 * any of the 11 RAs): a button whose className is a template literal with
 * embedded `${...}` branches, or a bare identifier reference to a
 * module-local constant, cannot be reduced to one static string without
 * evaluating render-time conditions — genuinely unresolvable by a static
 * sweep (consistent with RA-6's own closing note that this whole file is a
 * static string calculation, not a rendered measurement). Such buttons are
 * silently excluded from *this* scan rather than causing a throw; several
 * do exist in the same 15 files (see the execution report) and several
 * would themselves resolve under 44px if their static prefix were
 * evaluated, but resolving a ternary statically is out of scope here.
 * `data-ignore-raw-button` — the existing marker already used by
 * uiPrimitives.test.tsx's unrelated raw-button-migration sweep — is also
 * honored here: a handful of raw `<button>` elements are large clickable
 * regions (a card header, a title block) whose *rendered* height is
 * governed by big child content the static formula cannot see, so
 * including them would produce a well-known false positive.
 */
function discoverSub44RawButtons(): string[] {
  const violations: string[] = [];

  for (const root of [COMPONENTS_DIR, PAGES_DIR]) {
    for (const file of walk(root)) {
      if (RAW_BUTTON_SCAN_EXCLUDED_FILES.includes(file)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      let searchFrom = 0;

      for (;;) {
        const idx = content.indexOf('<button', searchFrom);
        if (idx === -1) break;

        const afterIdx = idx + '<button'.length;
        const nextChar = content[afterIdx];
        if (nextChar !== undefined && /[A-Za-z0-9_-]/.test(nextChar)) {
          // e.g. a hypothetical <buttonGroup> — not a real <button> tag.
          searchFrom = afterIdx;
          continue;
        }

        const tag = extractOpeningTag(content, idx);
        searchFrom = idx + tag.length;

        if (tag.includes('data-ignore-raw-button')) continue;

        const classMatch = /className\s*=\s*"([^"]*)"|className\s*=\s*'([^']*)'/.exec(tag);
        if (!classMatch) continue; // dynamic (template literal/expression) or absent className — not statically resolvable

        const classString = classMatch[1] ?? classMatch[2] ?? '';
        const { px } = resolveControlHeightPx(classString);
        if (px < 44) {
          const line = content.slice(0, idx).split('\n').length;
          violations.push(`${path.relative(SRC_ROOT, file)}:${line}`);
        }
      }
    }
  }

  return violations.sort();
}

describe('M40_P1/M40_P3: static 44px control-target-size sweep', () => {
  it('AC-1 (M40_P1): CONTROL_HEIGHT_CLASS is exactly h-11 (not min-h-11, not an arbitrary value)', () => {
    expect(CONTROL_HEIGHT_CLASS).toBe('h-11');
  });

  it('AC-3 (M40_P3): CONTROL_HEIGHT_CLASS still resolves to >= 44 CSS px, unchanged by this phase', () => {
    const { px, basis } = resolveControlHeightPx(CONTROL_HEIGHT_CLASS);
    expect(px).toBeGreaterThanOrEqual(44);
    expect(basis).toBe('height');
  });

  it('AC-4 (M40_P1): Input, NumberInput and Select compose CONTROL_HEIGHT_CLASS by import, not a literal height class', () => {
    for (const file of ['Input.tsx', 'NumberInput.tsx', 'Select.tsx']) {
      const content = fs.readFileSync(path.join(UI_DIR, file), 'utf-8');

      expect(content, `${file} must import CONTROL_HEIGHT_CLASS from ../designSystem`).toMatch(
        /import\s*\{[^}]*\bCONTROL_HEIGHT_CLASS\b[^}]*\}\s*from\s*['"]\.\.\/designSystem['"]/,
      );
      expect(content, `${file} must reference CONTROL_HEIGHT_CLASS somewhere in its markup composition`).toMatch(
        /\bCONTROL_HEIGHT_CLASS\b/,
      );

      for (const cls of [...SUB_44PX_HEIGHT_CLASSES, 'h-11']) {
        expect(content, `${file} must not inline the literal class "${cls}" (it must come from the token)`).not.toMatch(
          new RegExp(`['"\`]${cls.replace('.', '\\.')}[\\s'"\`]`),
        );
      }
    }
  });

  it('AC-17 (M40_P1, unmodified): no <input>, <select> or <button> element under components/ carries a sub-44px height class outside the RA-9 exemptions', () => {
    const files = walk(COMPONENTS_DIR).filter((f) => f !== STICKY_JUMP_NAV_FILE);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const clean = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const tags = clean.match(/<(?:input|select|button)\b[^>]*>/gi) || [];

      for (const tag of tags) {
        const isExempt = RA9_COMPACT_VARIANT_EXEMPTIONS.some((token) => tag.includes(token));
        if (isExempt) continue;

        for (const cls of SUB_44PX_HEIGHT_CLASSES) {
          const pattern = new RegExp(`(^|[\\s'"\`])${cls.replace('-', '\\-')}(?=[\\s'"\`]|$)`);
          if (pattern.test(tag)) {
            violations.push(`${path.relative(COMPONENTS_DIR, file)}: ${tag.replace(/\s+/g, ' ').slice(0, 160)}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  describe('M40_P3 AC-8, AC-9, AC-10, AC-11: resolveControlHeightPx (RA-6 binding algorithm)', () => {
    it('AC-8: resolution order — h-N (height) beats min-h-N (min-height) beats padding-derived', () => {
      expect(resolveControlHeightPx('h-11')).toEqual({ px: 44, basis: 'height' });
      expect(resolveControlHeightPx('min-h-11')).toEqual({ px: 44, basis: 'min-height' });
      expect(resolveControlHeightPx('px-4 py-2')).toEqual({ px: 36, basis: 'padding' }); // 20 + 8 + 8 (px-4 doesn't count; py-2 = 8/side)
    });

    it('AC-8: the 5 binding table rows from spec §2 resolve exactly as documented', () => {
      expect(resolveControlHeightPx('')).toEqual({ px: 20, basis: 'padding' });
      expect(resolveControlHeightPx('p-2', 16)).toEqual({ px: 32, basis: 'padding' });
      expect(resolveControlHeightPx('text-xs px-3 py-1.5')).toEqual({ px: 28, basis: 'padding' });
      expect(resolveControlHeightPx('min-h-11 px-4 py-2 border')).toEqual({ px: 44, basis: 'min-height' });
      expect(() => resolveControlHeightPx('h-[42px]')).toThrow(/h-\[42px\]/);
    });

    it('AC-9: resolveControlHeightPx(\'\') does not throw and returns the padding-basis degenerate default', () => {
      expect(() => resolveControlHeightPx('')).not.toThrow();
      expect(resolveControlHeightPx('')).toEqual({ px: 20, basis: 'padding' });
    });

    it('AC-10: throws naming the offending class for an arbitrary-value height', () => {
      expect(() => resolveControlHeightPx('h-[42px]')).toThrow(/h-\[42px\]/);
      expect(() => resolveControlHeightPx('min-h-[40px]')).toThrow(/min-h-\[40px\]/);
      expect(() => resolveControlHeightPx('h-full')).toThrow(/h-full/);
    });

    it('AC-10: throws naming the offending class for an unknown text-size utility, and never returns a fallback number', () => {
      expect(() => resolveControlHeightPx('text-2xl')).toThrow(/text-2xl/);
    });

    it('AC-10: does NOT throw on non-size text- utilities (colour, alignment) — RA-6 only constrains text-SIZE resolution', () => {
      // Every BUTTON_*_CLASS token below carries a text-<colour> utility
      // (text-white, text-slate-200, ...). If this resolver mistook those
      // for unresolvable text-size utilities, every token assertion in this
      // file would throw instead of asserting >=44px.
      expect(() => resolveControlHeightPx('text-white px-4 py-2')).not.toThrow();
      expect(() => resolveControlHeightPx('text-left px-4 py-2')).not.toThrow();
    });

    it('AC-11: py-1.5 contributes exactly 6px per side (not 4, not 8)', () => {
      expect(resolveControlHeightPx('py-1.5', 0)).toEqual({ px: 12, basis: 'padding' });
    });

    it('AC-11: a bare border contributes 2px total', () => {
      expect(resolveControlHeightPx('border', 0)).toEqual({ px: 2, basis: 'padding' });
    });

    it('AC-11: border-slate-700 alone (colour-only) contributes 0px', () => {
      expect(resolveControlHeightPx('border-slate-700', 0)).toEqual({ px: 0, basis: 'padding' });
    });

    it('AC-11: py-* overrides p-* when both are present', () => {
      // py-1 => 4px/side = 8 total. If p-10 (40px/side) were also counted,
      // this would be 80 or 88 instead.
      expect(resolveControlHeightPx('p-10 py-1', 0)).toEqual({ px: 8, basis: 'padding' });
    });

    it('directional border utilities: border-t/border-b contribute 1px each (RA-6); border-x contributes 0 (horizontal only)', () => {
      expect(resolveControlHeightPx('border-t', 0)).toEqual({ px: 1, basis: 'padding' });
      expect(resolveControlHeightPx('border-b', 0)).toEqual({ px: 1, basis: 'padding' });
      expect(resolveControlHeightPx('border-x', 0)).toEqual({ px: 0, basis: 'padding' });
    });

    it('border-<N> width utility scales with N (border-2 => 4px)', () => {
      expect(resolveControlHeightPx('border-2', 0)).toEqual({ px: 4, basis: 'padding' });
      expect(resolveControlHeightPx('border-0', 0)).toEqual({ px: 0, basis: 'padding' });
    });

    it('px-<N> (horizontal-only padding) never contributes to height', () => {
      expect(resolveControlHeightPx('px-10', 0)).toEqual({ px: 0, basis: 'padding' });
    });

    it('h-<N> and min-h-<N> both accept one decimal place', () => {
      expect(resolveControlHeightPx('h-3.5')).toEqual({ px: 14, basis: 'height' });
      expect(resolveControlHeightPx('min-h-3.5')).toEqual({ px: 14, basis: 'min-height' });
    });

    it('default text-size line-heights: xs=16, sm=20, base=24, lg=28, xl=28 (no contentPx override, so the class string\'s own text-size utility is used)', () => {
      expect(resolveControlHeightPx('text-xs')).toEqual({ px: 16, basis: 'padding' });
      expect(resolveControlHeightPx('text-sm')).toEqual({ px: 20, basis: 'padding' });
      expect(resolveControlHeightPx('text-base')).toEqual({ px: 24, basis: 'padding' });
      expect(resolveControlHeightPx('text-lg')).toEqual({ px: 28, basis: 'padding' });
      expect(resolveControlHeightPx('text-xl')).toEqual({ px: 28, basis: 'padding' });
    });
  });

  describe('M40_P3 AC-4, AC-5, AC-6, AC-7: BUTTON_*_CLASS tokens clear 44px (computed, not string-matched)', () => {
    it('AC-4: BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS and BUTTON_DANGER_CLASS each contain min-h-11 and resolve to >=44px via min-height', () => {
      for (const token of [BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, BUTTON_DANGER_CLASS]) {
        expect(token).toContain(CONTROL_MIN_HEIGHT_CLASS);
        const { px, basis } = resolveControlHeightPx(token);
        expect(px).toBeGreaterThanOrEqual(44);
        expect(basis).toBe('min-height');
      }
    });

    it('AC-5: BUTTON_ICON_CLASS contains h-11 w-11 and resolves to >=44px height (basis "height"); width is separately >=44px', () => {
      expect(BUTTON_ICON_CLASS).toContain(ICON_CONTROL_SIZE_CLASS);
      const { px, basis } = resolveControlHeightPx(BUTTON_ICON_CLASS, 16);
      expect(px).toBeGreaterThanOrEqual(44);
      expect(basis).toBe('height');

      // resolveControlHeightPx only resolves the HEIGHT axis; parse the
      // w-<N> utility directly for the separate width assertion (RA-2 — a
      // 44-tall/32-wide target still fails WCAG 2.5.5).
      const widthMatch = /\bw-(\d+(?:\.\d+)?)\b/.exec(BUTTON_ICON_CLASS);
      expect(widthMatch).not.toBeNull();
      expect(Number(widthMatch![1]) * 4).toBeGreaterThanOrEqual(44);
    });

    it('AC-6: the composed size="sm" string for primary/secondary/danger (base token + Button.tsx\'s literal sizeClass) still resolves to >=44px', () => {
      // Composed exactly the way ui/Button.tsx composes it:
      // [layoutClass, baseVariantClass, sizeClass, className].join(' ')
      // — the height token survives at the front regardless of the
      // size="sm" text-xs/px-3/py-1.5 override appended after it. This is
      // the assertion that proves one token edit reached all 101
      // <Button size="sm"> call sites (RA-5).
      const SIZE_SM_CLASS = 'text-xs px-3 py-1.5';
      for (const token of [BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, BUTTON_DANGER_CLASS]) {
        const composed = `${token} ${SIZE_SM_CLASS}`;
        const { px, basis } = resolveControlHeightPx(composed);
        expect(px).toBeGreaterThanOrEqual(44);
        expect(basis).toBe('min-height');
      }
    });

    it('AC-7: every non-height utility of all four BUTTON_*_CLASS tokens survives byte-identically (only the height utility is prepended)', () => {
      expect(BUTTON_PRIMARY_CLASS).toBe(
        `${CONTROL_MIN_HEIGHT_CLASS} bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50`,
      );
      expect(BUTTON_SECONDARY_CLASS).toBe(
        `${CONTROL_MIN_HEIGHT_CLASS} bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50`,
      );
      expect(BUTTON_DANGER_CLASS).toBe(
        `${CONTROL_MIN_HEIGHT_CLASS} bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-semibold px-3 py-2 rounded-lg border border-rose-800 transition-colors cursor-pointer disabled:opacity-40`,
      );
      expect(BUTTON_ICON_CLASS).toBe(
        `${ICON_CONTROL_SIZE_CLASS} p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40`,
      );
    });
  });

  describe('M40_P3 AC-12, AC-13: raw <button> sub-44px allowlist (RA-7) and StickyJumpNav exclusion (RA-8)', () => {
    it('AC-13: ui/StickyJumpNav.tsx is excluded from the sweep by name (RA-8: zero JSX consumers today, cannot be a real touch target)', () => {
      expect(fs.existsSync(STICKY_JUMP_NAV_FILE)).toBe(true); // not deleted
      expect(RAW_BUTTON_SCAN_EXCLUDED_FILES).toContain(STICKY_JUMP_NAV_FILE);
    });

    it('AC-12: the discovered set of padding-derived sub-44px raw <button> sites equals RAW_BUTTON_SUB_44PX_ALLOWLIST exactly (not a subset)', () => {
      const discovered = discoverSub44RawButtons();
      expect(discovered).toEqual(RAW_BUTTON_SUB_44PX_ALLOWLIST);
    });
  });
});
