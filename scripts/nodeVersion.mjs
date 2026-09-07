// Pure, import-free by design (RA-5): scripts/brew.mjs must be able to check
// the Node version BEFORE `npm install` has ever run, so this module cannot
// depend on anything from node_modules — and it cannot depend on any `node:`
// builtin either, since that is what makes it trivially unit-testable with
// zero observable effects (AC-6). No logging, no early termination, no child
// processes, no filesystem access — total functions only.

/** Lowest Node major the app supports (RA-4: verified against source — the
 * SQLite driver imports `node:sqlite` unflagged, which is unavailable on
 * Node < 24). */
export const MINIMUM_NODE_MAJOR = 24;

/** Printed in the brewer-facing failure message and asserted present in
 * README.md (AC-1). */
export const NODE_DOWNLOAD_URL = 'https://nodejs.org/';

// Optional leading "v", one or more digits (leading zeros accepted), then
// optionally ".minor" and ".patch" (each one or more digits), then
// optionally a "-" or "+" pre-release/build suffix consuming the rest of the
// string. Anything that doesn't fit this shape end-to-end is unresolvable.
const VERSION_PATTERN = /^v?(\d+)(?:\.\d+(?:\.\d+)?)?(?:[-+].*)?$/;

/**
 * Pure. Extracts the major version from a Node version string.
 * Accepts an optional leading "v"; ignores minor, patch and any
 * pre-release/build suffix. Returns null for anything it cannot
 * resolve to a positive integer — never NaN, never 0.
 * @param {unknown} versionString
 * @returns {number | null}
 */
export function parseNodeMajor(versionString) {
  if (typeof versionString !== 'string') return null;

  const trimmed = versionString.trim();
  if (trimmed === '') return null;

  const match = VERSION_PATTERN.exec(trimmed);
  if (!match) return null;

  const major = Number.parseInt(match[1], 10);
  if (!Number.isInteger(major) || major <= 0) return null;

  return major;
}

/**
 * Pure. True iff parseNodeMajor(versionString) >= MINIMUM_NODE_MAJOR.
 * Fails closed: any input parseNodeMajor cannot resolve returns false.
 * Compares MAJOR ONLY, with an inclusive >=; minor/patch are never
 * consulted.
 * @param {unknown} versionString
 * @returns {boolean}
 */
export function isSupportedNodeVersion(versionString) {
  const major = parseNodeMajor(versionString);
  return major !== null && major >= MINIMUM_NODE_MAJOR;
}
