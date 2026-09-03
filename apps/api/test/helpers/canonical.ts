import type { StoredRecipe } from '@truchabrew/shared-types';

const OMITTED_KEYS = new Set(['createdAt', 'updatedAt']);

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>)
      .filter((k) => !OMITTED_KEYS.has(k))
      .sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

/**
 * Deterministic JSON: keys lexicographically sorted at every depth, arrays
 * in stored position order (line items already come position-sorted from
 * `toStoredRecipe`), `createdAt`/`updatedAt` omitted at every depth. This is
 * the sole definition of "byte-identical" for the restart-round-trip tests.
 */
export function canonicalRecipeJson(recipe: StoredRecipe): string {
  return JSON.stringify(sortValue(recipe));
}
