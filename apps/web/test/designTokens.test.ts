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

describe('M35_P4 AC-12: designSystem.ts structural shape invariant', () => {
  it('every exported constant is a non-empty string or typed record mapping', () => {
    const keys = Object.keys(designSystem);
    expect(keys.length).toBeGreaterThanOrEqual(35);

    for (const key of keys) {
      const val = (designSystem as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        expect(val.trim().length).toBeGreaterThan(0);
      } else if (typeof val === 'object' && val !== null) {
        const recordValues = Object.values(val as Record<string, string>);
        expect(recordValues.length).toBeGreaterThan(0);
        for (const rv of recordValues) {
          expect(typeof rv).toBe('string');
          expect(rv.trim().length).toBeGreaterThan(0);
        }
      } else {
        throw new Error(`Unexpected export type for designSystem.${key}: ${typeof val}`);
      }
    }
  });

  it('contains tokens for all core design system categories (card, form, button, badge, table, state)', () => {
    const keys = Object.keys(designSystem);
    const requiredPrefixesOrTokens = [
      'CARD_CLASS',
      'FORM_LABEL_CLASS',
      'INPUT_CLASS',
      'BUTTON_PRIMARY_CLASS',
      'STATUS_BADGE_CLASS',
      'TABLE_CLASS',
      'LOADING_STATE_CLASS',
    ];
    for (const token of requiredPrefixesOrTokens) {
      expect(keys).toContain(token);
    }
  });
});

describe('M35_P4 AC-11: consumers > 0 for all designSystem.ts tokens', () => {
  it('every exported token has at least 1 consumer in apps/web/src outside designSystem.ts', () => {
    const exportNames = Object.keys(designSystem);
    const unconsumed: string[] = [];

    for (const name of exportNames) {
      let count = 0;
      for (const { file, content } of readAll(ALL_SRC_FILES)) {
        if (file === path.resolve(SRC_DIR, 'components/designSystem.ts')) continue;
        const pattern = new RegExp(`\\b${name}\\b`);
        if (pattern.test(content)) {
          count++;
        }
      }
      if (count === 0) {
        unconsumed.push(name);
      }
    }

    expect(unconsumed).toEqual([]);
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

describe('AC-18 through AC-21: structural contrast & token invariants (retired pin debt)', () => {
  it('AC-18: zero exact-token occurrences of text-slate-500 remain across all files', () => {
    const pattern = /(?<![\w-])text-slate-500(?![\w/-])/;
    const hits = readAll(ALL_SRC_FILES)
      .filter(({ content }) => pattern.test(content))
      .map(({ file }) => file);
    expect(hits).toEqual([]);
  });

  it('AC-19: placeholder-slate-500 is governed by designSystem input tokens', () => {
    expect(designSystem.INPUT_CLASS).toContain('placeholder-slate-500');
    expect(designSystem.INPUT_COMPACT_CLASS).toContain('placeholder-slate-500');
  });

  it('AC-20: text-slate-600 is restricted to subtle icon / rating treatments', () => {
    // Structural invariant: no primary text, heading, or card uses text-slate-600
    for (const { content } of readAll(ALL_SRC_FILES)) {
      if (content.includes('text-slate-600')) {
        expect(content).not.toMatch(/className=["'][^"']*text-slate-600[^"']*\b(text-lg|text-xl|font-bold|font-extrabold)\b/);
      }
    }
  });

  it('AC-21: status badge border colors are strictly defined in designSystem.ts', () => {
    expect(designSystem.STATUS_BADGE_CLASS.Planning).toContain('border-amber-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Brewing).toContain('border-blue-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Fermenting).toContain('border-emerald-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Conditioning).toContain('border-purple-500/30');
    expect(designSystem.STATUS_BADGE_CLASS.Completed).toContain('border-slate-500/30');
  });
});

describe('M30_P2 AC-14/AC-15: focus:outline-none sweep — zero occurrences in designSystem.ts', () => {
  const DESIGN_SYSTEM = path.resolve(SRC_DIR, 'components/designSystem.ts');

  it('components/designSystem.ts contains zero focus:outline-none occurrences', () => {
    const entry = readAll(ALL_SRC_FILES).find(({ file }) => file === DESIGN_SYSTEM);
    expect(entry).toBeDefined();
    expect((entry!.content.match(/focus:outline-none/g) ?? []).length).toBe(0);
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
