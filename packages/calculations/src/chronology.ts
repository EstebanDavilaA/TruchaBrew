// M5_P2 spec §2.1. No function in this module performs I/O, reads the
// current wall-clock time, generates an id, or touches a random source.
// Date.parse on a caller-supplied string is not a clock read.

/**
 * The ONE 'instant ascending, then id ascending' ordering in this repo.
 * Returns a NEW array; never mutates the input. An instant that does not
 * parse sorts LAST (after every parseable one), ties among unparseable ones
 * broken by `id` — deterministic rather than NaN-dependent.
 */
export function sortByInstantThenId<T extends { id: string }>(
  items: readonly T[],
  instantOf: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(instantOf(a));
    const tb = Date.parse(instantOf(b));
    const aValid = !Number.isNaN(ta);
    const bValid = !Number.isNaN(tb);

    if (aValid && bValid) {
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;
    // Both unparseable — tie-break by id, same rule as the parseable case.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
