import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as designSystem from '../src/components/designSystem';
import { BATCH_STATUSES } from '@truchabrew/calculations';

describe('AC-18: designSystem.ts exports every constant in §3.4.1 with the exact documented string values', () => {
  it('surface / container primitives', () => {
    expect(designSystem.CARD_CLASS).toBe('bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg');
    expect(designSystem.CARD_STACK_GAP_CLASS).toBe('space-y-6');
    expect(designSystem.SUBPANEL_CLASS).toBe('bg-slate-800/80 p-3 rounded-lg border border-slate-700/60');
  });

  it('typography scale (M29_P1)', () => {
    expect(designSystem.PAGE_TITLE_CLASS).toBe('text-xl md:text-2xl font-black text-white tracking-tight');
    expect(designSystem.SECTION_HEADING_CLASS).toBe('text-lg font-semibold text-slate-100 flex items-center gap-2');
    expect(designSystem.SUBSECTION_HEADING_CLASS).toBe('text-base font-bold text-white mb-2');
    expect(designSystem.BODY_TEXT_CLASS).toBe('text-sm text-slate-300');
    expect(designSystem.METADATA_TEXT_CLASS).toBe('text-xs text-slate-400');
    expect(designSystem.MONO_VALUE_CLASS).toBe('font-mono tabular-nums tracking-tight');
  });

  it('button primitives (M24_P1 / M29_P1)', () => {
    expect(designSystem.BUTTON_PRIMARY_CLASS).toBe(
      'bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50',
    );
    expect(designSystem.BUTTON_SECONDARY_CLASS).toBe(
      'bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50',
    );
    expect(designSystem.BUTTON_DANGER_CLASS).toBe(
      'bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-semibold px-3 py-2 rounded-lg border border-rose-800 transition-colors cursor-pointer disabled:opacity-40',
    );
    expect(designSystem.BUTTON_ICON_CLASS).toBe(
      'p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40',
    );
  });


  it('metric tile', () => {
    expect(designSystem.METRIC_TILE_CLASS).toBe(designSystem.SUBPANEL_CLASS);
    expect(designSystem.METRIC_LABEL_CLASS).toBe('text-xs text-slate-400 font-medium mb-1');
    expect(designSystem.METRIC_VALUE_CLASS).toBe('text-2xl font-extrabold tracking-tight');
  });

  it('state conventions', () => {
    expect(designSystem.EMPTY_STATE_CLASS).toBe('bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400');
    expect(designSystem.LOADING_STATE_CLASS).toBe(designSystem.EMPTY_STATE_CLASS);
    expect(designSystem.ERROR_STATE_CLASS).toBe('bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 text-sm text-rose-200');
  });

  it('status badge wrapper', () => {
    expect(designSystem.STATUS_BADGE_WRAPPER_CLASS).toBe('px-2.5 py-0.5 rounded-full text-xs font-medium border');
  });

  it('form controls & settings rows (M13_P2 §3.1; M30_P1 §1.2 Option A)', () => {
    // AC-5: all four control tokens pinned byte-for-byte to their post-M30_P1 strings.
    expect(designSystem.INPUT_CLASS).toBe(
      'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
    );
    expect(designSystem.INPUT_COMPACT_CLASS).toBe(
      'bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
    );
    expect(designSystem.FORM_SELECT_CLASS).toBe(
      'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
    );
    expect(designSystem.FORM_SELECT_COMPACT_CLASS).toBe(
      'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-amber-500 font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
    );
    expect(designSystem.SETTINGS_ROW_CLASS).toBe('py-3.5 px-4 flex items-center justify-between gap-4');
  });

  it('M30_P1 AC-1: FORM_LABEL_CLASS carries the plurality label string', () => {
    expect(designSystem.FORM_LABEL_CLASS).toBe('block text-xs font-semibold text-slate-400 mb-1');
  });

  it('M30_P1 AC-2: CONTROL_HEIGHT_CLASS is exactly h-10', () => {
    expect(designSystem.CONTROL_HEIGHT_CLASS).toBe('h-10');
  });

  describe('M30_P1: the four form-control tokens (AC-3, AC-4, AC-6, AC-7, AC-18)', () => {
    const CONTROL_TOKENS: Array<[string, string]> = [
      ['INPUT_CLASS', designSystem.INPUT_CLASS],
      ['INPUT_COMPACT_CLASS', designSystem.INPUT_COMPACT_CLASS],
      ['FORM_SELECT_CLASS', designSystem.FORM_SELECT_CLASS],
      ['FORM_SELECT_COMPACT_CLASS', designSystem.FORM_SELECT_COMPACT_CLASS],
    ];

    it.each(CONTROL_TOKENS)('AC-3: %s is free of outline-none', (_name, token) => {
      expect(token).not.toContain('outline-none');
    });

    it.each(CONTROL_TOKENS)('AC-4: %s retains focus:border-amber-500', (_name, token) => {
      expect(token).toContain('focus:border-amber-500');
    });

    it.each(CONTROL_TOKENS)('AC-6: %s carries the amber focus-visible ring trio', (_name, token) => {
      expect(token).toContain('focus-visible:outline-2');
      expect(token).toContain('focus-visible:outline-offset-2');
      expect(token).toContain('focus-visible:outline-amber-500');
    });

    it.each(CONTROL_TOKENS)('AC-7: %s uses no bare focus:outline-* variant (RA-2)', (_name, token) => {
      expect(token).not.toMatch(/(?<!-)\bfocus:outline/);
    });

    it.each(CONTROL_TOKENS)('AC-18: %s ring colour is amber, never sky', (_name, token) => {
      expect(token).not.toContain('sky');
    });
  });

  it('module exports no React component and no hook', () => {
    for (const [name, value] of Object.entries(designSystem)) {
      expect(typeof value).not.toBe('function');
      void name;
    }
  });
});

describe('AC-19: STATUS_BADGE_CLASS is exhaustive over BatchStatus and colour-only', () => {
  it('Object.keys equals all 5 BATCH_STATUSES', () => {
    expect(Object.keys(designSystem.STATUS_BADGE_CLASS).sort()).toEqual([...BATCH_STATUSES].sort());
    expect(Object.keys(designSystem.STATUS_BADGE_CLASS)).toHaveLength(5);
  });

  it('no value contains the standalone token "border " (the wrapper supplies border)', () => {
    for (const value of Object.values(designSystem.STATUS_BADGE_CLASS)) {
      expect(value.split(' ')).not.toContain('border');
    }
  });

  it('carries the exact documented colour-only value per status', () => {
    expect(designSystem.STATUS_BADGE_CLASS.Planning).toBe('bg-amber-900/40 text-amber-300 border-amber-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Brewing).toBe('bg-blue-900/40 text-blue-300 border-blue-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Fermenting).toBe('bg-emerald-900/40 text-emerald-300 border-emerald-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Conditioning).toBe('bg-purple-900/40 text-purple-300 border-purple-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Completed).toBe('bg-slate-700/40 text-slate-300 border-slate-500/30');
  });
});

describe('M35_P1 AC-13: table tokens exported with byte-identical values', () => {
  it('TABLE_CLASS, TABLE_HEADER_CELL_CLASS, TABLE_CELL_CLASS match the retired BrewSheet.tsx locals exactly', () => {
    expect(designSystem.TABLE_CLASS).toBe('w-full border-collapse');
    expect(designSystem.TABLE_HEADER_CELL_CLASS).toBe(
      'text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold py-1.5 px-2',
    );
    expect(designSystem.TABLE_CELL_CLASS).toBe(
      'text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums',
    );
  });
});

describe('M35_P2 AC-2: TABLE_CELL_BASE_CLASS is module-private, not exported', () => {
  it('Object.keys(designSystem) does not contain TABLE_CELL_BASE_CLASS; length is at least 35', () => {
    const keys = Object.keys(designSystem);
    expect(keys).not.toContain('TABLE_CELL_BASE_CLASS');
    expect(keys.length).toBeGreaterThanOrEqual(35);
  });
});

describe('M35_P3 AC-3 & AC-5: SEMANTIC_BADGE_CLASS is exported and typed', () => {
  it('exports SEMANTIC_BADGE_CLASS containing all standard semantic variants', () => {
    const expectedVariants = [
      'neutral',
      'success',
      'warning',
      'danger',
      'info',
      'amber',
      'emerald',
      'rose',
      'sky',
      'slate',
    ];
    for (const v of expectedVariants) {
      expect(designSystem.SEMANTIC_BADGE_CLASS[v as keyof typeof designSystem.SEMANTIC_BADGE_CLASS]).toBeDefined();
    }
    expect(designSystem.SEMANTIC_BADGE_CLASS.neutral).toBe('bg-slate-800 text-slate-300 border-slate-700');
    expect(designSystem.SEMANTIC_BADGE_CLASS.success).toBe('bg-emerald-950/60 text-emerald-300 border-emerald-800/60');
    expect(designSystem.SEMANTIC_BADGE_CLASS.warning).toBe('bg-amber-950/60 text-amber-300 border-amber-800/60');
    expect(designSystem.SEMANTIC_BADGE_CLASS.danger).toBe('bg-rose-950/60 text-rose-300 border-rose-800/60');
    expect(designSystem.SEMANTIC_BADGE_CLASS.info).toBe('bg-sky-950/60 text-sky-300 border-sky-800/60');
  });
});

describe('M35_P2 AC-1: the four TABLE_CELL_* tokens hold exactly the four documented strings', () => {
  it('TABLE_CELL_CLASS is unedited and byte-identical to the M35_P1 pin (proof the RA-4 refactor changed nothing)', () => {
    expect(designSystem.TABLE_CELL_CLASS).toBe(
      'text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums',
    );
  });

  it('TABLE_CELL_TEXT_CLASS is text-sm + base, no font-mono/tabular-nums', () => {
    expect(designSystem.TABLE_CELL_TEXT_CLASS).toBe(
      'text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800',
    );
  });

  it('TABLE_CELL_SM_CLASS is text-xs + base + font-mono tabular-nums', () => {
    expect(designSystem.TABLE_CELL_SM_CLASS).toBe(
      'text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums',
    );
  });

  it('TABLE_CELL_SM_TEXT_CLASS is text-xs + base, no font-mono/tabular-nums', () => {
    expect(designSystem.TABLE_CELL_SM_TEXT_CLASS).toBe(
      'text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800',
    );
  });
});

describe('AC-20: single source of truth — no duplicate STATUS_BADGE_CLASS map survives', () => {
  const SRC_DIR = path.resolve(__dirname, '../src');

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) return [full];
      return [];
    });
  }

  it('exactly one definition of STATUS_BADGE_CLASS exists in apps/web/src (designSystem.ts)', () => {
    const files = walk(SRC_DIR);
    const definitionSites = files.filter((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      return /const STATUS_BADGE_CLASS\s*:/.test(content) || /export const STATUS_BADGE_CLASS/.test(content);
    });
    expect(definitionSites).toEqual([path.resolve(SRC_DIR, 'components/designSystem.ts')]);
  });

  it('Badge.tsx imports STATUS_BADGE_CLASS from designSystem', () => {
    const badgeSrc = fs.readFileSync(path.resolve(SRC_DIR, 'components/ui/Badge.tsx'), 'utf-8');
    const importBlockPattern = /import\s*\{[^}]*STATUS_BADGE_CLASS[^}]*\}\s*from\s*['"]\.\.\/designSystem['"]/;
    expect(badgeSrc).toMatch(importBlockPattern);
  });
});
