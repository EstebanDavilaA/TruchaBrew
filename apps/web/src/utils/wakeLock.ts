/**
 * Screen Wake Lock utility (M41_P1 spec §1.1). Keeps the device screen on
 * while a brew-day timer is actually running — see BrewDayTracker.tsx for
 * the `running`-driven acquire/release wiring (RA-1).
 *
 * `navigator.wakeLock` is read at CALL TIME only, never captured at module
 * scope (RA-6) — this is what lets jsdom tests fake the global per-test via
 * `Object.defineProperty`/`vi.stubGlobal`, the same pattern `test/setup.ts`
 * already uses for `localStorage`.
 *
 * Contains no timing mechanism of its own (AC-27, enforced by a source
 * sweep in test/M41_P1_HandsFree.test.tsx — deliberately not named as a
 * contiguous literal here, since that sweep greps this very file) — no
 * interval/timeout polling and no wall-clock reads anywhere, and none
 * should ever be added: the Wake Lock API itself has no notion of "how
 * long", only "held" or "not held".
 */

/** Structural shape of the platform's WakeLockSentinel — just enough surface
 * for this module's needs, so no lib.dom WakeLock types need to be assumed
 * present at compile time (they aren't universally shipped across all
 * TS/lib configurations, and this keeps the module framework-agnostic). */
interface WakeLockSentinelLike {
  release(): Promise<void>;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
}

export interface WakeLockController {
  /** Idempotent. Resolves false if unsupported, denied, or the request rejected. */
  acquire(): Promise<boolean>;
  /** Idempotent. Safe to call when nothing is held. Never throws. */
  release(): Promise<void>;
  /** True iff a sentinel is currently held and not released. */
  isHeld(): boolean;
}

function getNavigatorWakeLock(): NavigatorWithWakeLock['wakeLock'] {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as NavigatorWithWakeLock).wakeLock;
}

/** Reads `navigator.wakeLock` at call time, never at module scope. */
export function isWakeLockSupported(): boolean {
  return getNavigatorWakeLock() != null;
}

/** Factory; each tracker instance owns one controller. Never throws. */
export function createWakeLockController(): WakeLockController {
  let sentinel: WakeLockSentinelLike | null = null;

  return {
    async acquire(): Promise<boolean> {
      if (sentinel !== null) return true; // idempotent — already held
      const wakeLock = getNavigatorWakeLock();
      if (wakeLock === undefined) return false; // unsupported
      try {
        sentinel = await wakeLock.request('screen');
        return true;
      } catch {
        // Denied, rejected (e.g. NotAllowedError on a hidden document), or
        // any other failure — swallowed, never propagated.
        sentinel = null;
        return false;
      }
    },

    async release(): Promise<void> {
      if (sentinel === null) return; // idempotent — nothing held
      const held = sentinel;
      sentinel = null;
      try {
        await held.release();
      } catch {
        // Never throws.
      }
    },

    isHeld(): boolean {
      return sentinel !== null;
    },
  };
}
