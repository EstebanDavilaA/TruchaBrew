import { describe, it, expect } from 'vitest';
import { psiToKpa, kpaToPsi, psiToBar, barToPsi } from '../src/index';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

describe('AC-1: pressure exports are root-exported', () => {
  it('all new pressure exports are importable and defined', () => {
    expect(psiToKpa).toBeDefined();
    expect(kpaToPsi).toBeDefined();
    expect(psiToBar).toBeDefined();
    expect(barToPsi).toBeDefined();
  });
});

describe('AC-10: pressure converters pinned, single constant', () => {
  it('matches the pinned full-precision values', () => {
    expect(psiToKpa(14.5)).toBe(99.97398075094124);
    expect(psiToKpa(12)).toBe(82.73708751802033);
    expect(psiToBar(14.5)).toBe(0.9997398075094124);
    expect(kpaToPsi(100)).toBe(14.503773773020923);
  });

  it('round-trips within 1e-9', () => {
    expect(Math.abs(kpaToPsi(psiToKpa(14.5)) - 14.5)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(barToPsi(psiToBar(14.5)) - 14.5)).toBeLessThanOrEqual(1e-9);
  });

  it('psiToKpa(0) === 0 exactly', () => {
    expect(psiToKpa(0)).toBe(0);
  });

  it('the 6.894757 literal appears in pressure.ts only, exactly once, across packages/calculations/src', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
    let totalMatches = 0;
    const filesWithMatch: string[] = [];
    for (const file of files) {
      const content = readFileSync(path.join(srcDir, file), 'utf8');
      const matches = content.match(/6\.894757/g);
      if (matches) {
        totalMatches += matches.length;
        filesWithMatch.push(file);
      }
    }
    expect(filesWithMatch).toEqual(['pressure.ts']);
    expect(totalMatches).toBe(1);
  });

  it('the literals 14.5037, 0.0689, and 6894 appear nowhere in packages/calculations/src', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
    const banned = ['14.5037', '0.0689', '6894'];
    for (const file of files) {
      const content = readFileSync(path.join(srcDir, file), 'utf8');
      for (const literal of banned) {
        expect(content.includes(literal)).toBe(false);
      }
    }
  });
});

describe('AC-11: non-finite passthrough across every new pure function', () => {
  const cases: Array<[string, () => number]> = [
    ['psiToKpa', () => psiToKpa(NaN)],
    ['kpaToPsi', () => kpaToPsi(NaN)],
    ['psiToBar', () => psiToBar(NaN)],
    ['barToPsi', () => barToPsi(NaN)],
  ];

  it.each(cases)('%s returns NaN, does not throw, and is not 0 or undefined', (_name, fn) => {
    let result: number | undefined;
    expect(() => {
      result = fn();
    }).not.toThrow();
    expect(Number.isNaN(result)).toBe(true);
    expect(result).not.toBe(0);
    expect(result).not.toBeUndefined();
  });
});
