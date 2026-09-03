import type { RecipeSummary } from '@truchabrew/shared-types';

/**
 * Pure derivation of the distinct, sorted folder names present across a set
 * of recipe summaries — the source for the Recipe Editor's folder datalist
 * suggestions (RA-9 / RA-P3-8).
 *
 * - Collects each non-null, non-empty `summary.folder`.
 * - Dedupes by **exact, case-sensitive** string equality (first occurrence's
 *   casing wins — matching RecipeLibrary.tsx's `folderTabs` semantics).
 * - Sorts ascending via `localeCompare`.
 *
 * Returns `[]` for empty/`null`/all-unfiled input. Never returns `null` or
 * `''` entries. Pure: never mutates its input.
 */
export function distinctFolderNames(summaries: RecipeSummary[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const summary of summaries) {
    const folder = summary.folder;
    if (folder === null || folder === undefined) continue;
    if (folder === '') continue;
    if (seen.has(folder)) continue;
    seen.add(folder);
    result.push(folder);
  }
  result.sort((a, b) => a.localeCompare(b));
  return result;
}
