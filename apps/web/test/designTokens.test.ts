import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as designSystem from '../src/components/designSystem';

// M24_P1 §3 sweep suite — follows the walk() recursive-source-read pattern
// already proven at designSystem.test.ts:76-83.

const SRC_DIR = path.resolve(__dirname, '../src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) return [full];
    return [];
  });
}

const ALL_SRC_FILES = walk(SRC_DIR);

function readAll(files: string[]): Array<{ file: string; content: string }> {
  return files.map((file) => ({ file, content: fs.readFileSync(file, 'utf-8') }));
}

describe('AC-23: walk() covers a real file set (degenerate/empty-input guard)', () => {
  it('returns at least 60 .ts/.tsx paths under apps/web/src', () => {
    expect(ALL_SRC_FILES.length).toBeGreaterThanOrEqual(60);
  });
});

describe('AC-7: designSystem.ts exports all constants, by exact name (updated for M35_P2)', () => {
  it('Object.keys(designSystem) has length 34 and matches the exact name list', () => {
    const EXPECTED = [
      'BODY_TEXT_CLASS',
      'BUTTON_DANGER_CLASS',
      'BUTTON_ICON_CLASS',
      'BUTTON_PRIMARY_CLASS',
      'BUTTON_SECONDARY_CLASS',
      'CARD_CLASS',
      'CARD_STACK_GAP_CLASS',
      'CONTROL_HEIGHT_CLASS',
      'EMPTY_STATE_CLASS',
      'ERROR_STATE_CLASS',
      'FORM_LABEL_CLASS',
      'FORM_SELECT_CLASS',
      'FORM_SELECT_COMPACT_CLASS',
      'INPUT_CLASS',
      'INPUT_COMPACT_CLASS',
      'LOADING_STATE_CLASS',
      'METADATA_TEXT_CLASS',
      'METRIC_LABEL_CLASS',
      'METRIC_TILE_CLASS',
      'METRIC_VALUE_CLASS',
      'MONO_VALUE_CLASS',
      'PAGE_TITLE_CLASS',
      'SECTION_HEADING_CLASS',
      'SETTINGS_ROW_CLASS',
      'STATUS_BADGE_CLASS',
      'STATUS_BADGE_WRAPPER_CLASS',
      'SUBPANEL_CLASS',
      'SUBSECTION_HEADING_CLASS',
      'TABLE_CELL_CLASS',
      'TABLE_CELL_TEXT_CLASS',
      'TABLE_CELL_SM_CLASS',
      'TABLE_CELL_SM_TEXT_CLASS',
      'TABLE_CLASS',
      'TABLE_HEADER_CELL_CLASS',
    ].sort();

    const actual = Object.keys(designSystem).sort();
    expect(actual).toHaveLength(34);
    expect(actual).toEqual(EXPECTED);
  });
});

describe('AC-12: no local button/input/select class-string constant survives outside designSystem.ts', () => {
  it('recursive walk of apps/web/src matches the drift-constant regex in zero files other than components/designSystem.ts', () => {
    const pattern = /^\s*(export\s+)?const\s+[A-Z_]*(BUTTON|INPUT|SELECT)[A-Z_]*_CLASS\s*=/m;
    const hits = readAll(ALL_SRC_FILES)
      .filter(({ content }) => pattern.test(content))
      .map(({ file }) => file);
    expect(hits).toEqual([path.resolve(SRC_DIR, 'components/designSystem.ts')]);
  });
});

describe('AC-13: all drift files have retired onto UI primitives (0 remaining rows in designTokens.test.ts; full adoption asserted in uiPrimitives.test.tsx)', () => {
  const CASES: Array<{ file: string; specifier: string; tokens: string[] }> = [];

  it('all former drift files have been fully migrated to UI primitives (0 legacy rows remain)', () => {
    expect(CASES).toHaveLength(0);
  });
});

describe('AC-14 through AC-17: the four deleted local-constant literals appear zero times in apps/web/src', () => {
  const DELETED_LITERALS: Array<{ id: string; literal: string }> = [
    {
      id: 'AC-14: old rounded-xl primary button (RecipeImportModal)',
      literal:
        'bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl shadow transition-colors cursor-pointer',
    },
    {
      id: 'AC-15: old rounded-xl secondary button (RecipeImportModal)',
      literal:
        'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl transition-colors cursor-pointer',
    },
    {
      id: 'AC-16: old px-3.5 secondary button (BatchDetail)',
      literal:
        'bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3.5 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50',
    },
    {
      id: 'AC-17: old WaterCalculatorModal input shape',
      literal:
        'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full',
    },
  ];

  it.each(DELETED_LITERALS)('$id is absent from every .ts/.tsx file', ({ literal }) => {
    const hits = readAll(ALL_SRC_FILES)
      .filter(({ content }) => content.includes(literal))
      .map(({ file }) => file);
    expect(hits).toEqual([]);
  });
});

describe('AC-18 through AC-21: contrast sweep is complete and did not over-reach', () => {
  it('AC-18: zero exact-token occurrences of text-slate-500 remain', () => {
    const pattern = /(?<![\w-])text-slate-500(?![\w/-])/;
    const hits = readAll(ALL_SRC_FILES)
      .filter(({ content }) => pattern.test(content))
      .map(({ file }) => file);
    expect(hits).toEqual([]);
  });

  it('AC-19: placeholder-slate-500 appears in designSystem tokens (reconciled 4 -> 2 as form migration removes inline duplicates)', () => {
    let total = 0;
    for (const { content } of readAll(ALL_SRC_FILES)) {
      total += (content.match(/placeholder-slate-500/g) ?? []).length;
    }
    expect(total).toBe(2);
  });

  it('AC-20: text-slate-600 still appears exactly 13 times (RA-7, deliberately not swept)', () => {
    let total = 0;
    for (const { content } of readAll(ALL_SRC_FILES)) {
      total += (content.match(/text-slate-600/g) ?? []).length;
    }
    expect(total).toBe(13);
  });


  it('AC-21: border-slate-500/30 still appears exactly 1 time, and sibling -500/30 badge colors are unchanged', () => {
    let borderSlate500Total = 0;
    for (const { content } of readAll(ALL_SRC_FILES)) {
      borderSlate500Total += (content.match(/border-slate-500\/30/g) ?? []).length;
    }
    expect(borderSlate500Total).toBe(1);

    expect(designSystem.STATUS_BADGE_CLASS.Planning).toContain('border-amber-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Brewing).toContain('border-blue-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Fermenting).toContain('border-emerald-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Conditioning).toContain('border-purple-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Completed).toContain('border-slate-500/30');
  });
});

describe('M30_P2 AC-14/AC-15: focus:outline-none sweep — CalculatorCard retired onto UI primitives', () => {
  const DESIGN_SYSTEM = path.resolve(SRC_DIR, 'components/designSystem.ts');

  function countIn(content: string): number {
    return (content.match(/focus:outline-none/g) ?? []).length;
  }

  it('(a) components/designSystem.ts contains zero occurrences', () => {
    const entry = readAll(ALL_SRC_FILES).find(({ file }) => file === DESIGN_SYSTEM);
    expect(entry).toBeDefined();
    expect(countIn(entry!.content)).toBe(0);
  });

  it('(b) exactly 4 occurrences remain across apps/web/src (HopSection retired onto primitives in M34_P5)', () => {
    let total = 0;
    for (const { content } of readAll(ALL_SRC_FILES)) {
      total += countIn(content);
    }
    expect(total).toBe(4);
  });

  it('(c) the set of files still containing it is exactly the one deferred component file', () => {
    const hits = readAll(ALL_SRC_FILES)
      .filter(({ content }) => countIn(content) > 0)
      .map(({ file }) => path.relative(SRC_DIR, file).split(path.sep).join('/'))
      .sort();

    expect(hits).toEqual([
      'App.tsx',
    ]);
  });
});

describe('AC-22: no file re-declares an identifier that designSystem.ts also exports', () => {
  it('zero files other than designSystem.ts declare a matching const for any exported name', () => {
    const exportNames = Object.keys(designSystem);
    const offenders: string[] = [];

    for (const { file, content } of readAll(ALL_SRC_FILES)) {
      if (file === path.resolve(SRC_DIR, 'components/designSystem.ts')) continue;
      for (const name of exportNames) {
        const pattern = new RegExp(`^\\s*const ${name}\\s*[=:]`, 'm');
        if (pattern.test(content)) {
          offenders.push(`${file}: ${name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
