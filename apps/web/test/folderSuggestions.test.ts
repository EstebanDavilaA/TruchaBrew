import { describe, it, expect } from 'vitest';
import type { RecipeSummary } from '@truchabrew/shared-types';
import { distinctFolderNames } from '../src/utils/folderSuggestions';

function summary(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 'r-1',
    name: 'Recipe',
    author: 'Tester',
    styleName: '',
    equipmentId: 'eq-1',
    equipmentName: 'Default',
    batchSizeL: 20,
    fermentableCount: 1,
    hopCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('distinctFolderNames (AC-16 / RA-P3-8)', () => {
  it('collects distinct folders, deduped case-sensitively with first-occurrence casing winning', () => {
    const input = [
      summary({ folder: 'IPAs' }),
      summary({ folder: 'Lagers' }),
      summary({ folder: 'IPAs' }),
      summary({ folder: 'ipas' }), // different case -> distinct entry
      summary({ folder: null }),
      summary({ folder: '' }),
    ];
    // 'IPAs' (first) and 'ipas' (a separate case-sensitive value) both present;
    // null and '' are excluded.
    expect(distinctFolderNames(input).sort()).toEqual(['IPAs', 'ipas', 'Lagers'].sort());
  });

  it('returns distinct folders sorted ascending via localeCompare', () => {
    const input = [
      summary({ folder: 'Stouts' }),
      summary({ folder: 'IPAs' }),
      summary({ folder: 'Lagers' }),
      summary({ folder: 'IPAs' }),
    ];
    const out = distinctFolderNames(input);
    expect(out).toEqual(['IPAs', 'Lagers', 'Stouts']);
    const sorted = [...out].sort((a, b) => a.localeCompare(b));
    expect(out).toEqual(sorted);
  });

  it('excludes unfiled (null) and empty-string folders, never returning null or ""', () => {
    const input = [
      summary({ folder: null }),
      summary({ folder: undefined }),
      summary({ folder: '' }),
      summary({ folder: 'IPAs' }),
    ];
    const out = distinctFolderNames(input);
    expect(out).toEqual(['IPAs']);
    expect(out.every((f) => f !== null && f !== undefined && f !== '')).toBe(true);
  });

  it('returns [] for empty input', () => {
    expect(distinctFolderNames([])).toEqual([]);
  });

  it('returns [] when every summary is unfiled', () => {
    expect(distinctFolderNames([summary({ folder: null }), summary()])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [summary({ folder: 'IPAs' }), summary({ folder: 'Lagers' })];
    const snapshot = JSON.stringify(input);
    distinctFolderNames(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
