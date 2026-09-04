// M41_P1 spec — "Hands-free at the kettle". Covers AC-1 through AC-38
// (AC-39/AC-40 are [MANUAL] real-hardware criteria and are NOT applicable to
// an automated test file — noted, not implemented, at the bottom of this
// file).
//
// RA-6 (binding): jsdom implements neither the Screen Wake Lock API nor the
// Notification API. Both capabilities are accessed EXCLUSIVELY through
// wakeLock.ts / brewDayNotifications.ts, which read `navigator`/`window` at
// call time only. Tests install fake globals via `Object.defineProperty`
// (the same pattern test/setup.ts already uses for `localStorage`) rather
// than mocking our own utility modules — this exercises the real permission
// gating logic inside those modules, not just "was this function called".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState, useEffect } from 'react';
import type { BatchWithReadings, CalculatedStats, EquipmentProfile, Recipe } from '@truchabrew/shared-types';
import { calculateRecipeStats } from '@truchabrew/calculations';
import { BrewDayTracker } from '../src/components/BrewDayTracker';
import { createWakeLockController, isWakeLockSupported } from '../src/utils/wakeLock';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestBrewDayNotificationPermission,
  notifyBrewDayEvent,
  type BrewDayNotificationPermission,
} from '../src/utils/brewDayNotifications';

vi.mock('../src/utils/audioAlerts', () => ({
  playStepAlert: vi.fn(),
}));
import { playStepAlert } from '../src/utils/audioAlerts';
const mockedPlayStepAlert = vi.mocked(playStepAlert);

// ---------------------------------------------------------------------------
// Fixtures — same shape as apps/web/test/BrewDayTracker.test.tsx (unmodified
// by this phase), tuned so boil-alarm threshold crossing needs a real Play +
// time advance rather than firing merely from switching to the boil stage
// (boilMins=59 on a 60-min boil ⇒ atSec=60, not 0).
// ---------------------------------------------------------------------------

const equipment: EquipmentProfile = {
  id: 'eq-1',
  name: 'Test Rig',
  batchSizeL: 20,
  boilTimeMin: 60,
  brewhouseEfficiencyPct: 72,
  mashEfficiencyPct: 75,
  boilOffRateLPerHour: 3,
  trubChillerLossL: 1,
  hopUtilizationPct: 100,
  derivedFromEquipmentId: null,
  mashWaterRatioLPerKg: 3,
  grainAbsorptionLPerKg: 1,
  hopstandUtilizationFactor: 0.2,
  hopstandTemperatureC: 80,
  spargeTemperatureC: 76,
  mashTunHeatCapacityL: 0,
  grainTemperatureC: 20,
  notes: '',
};

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    name: 'Test IPA',
    author: 'Tester',
    styleName: 'IPA',
    equipment,
    fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 }],
    hops: [
      { id: 'h-boil-60', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 59, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { id: 'h-whirl', name: 'Citra', amountG: 40, alphaAcidPct: 12, use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 80, type: 'Pellet' },
    ],
    yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
    miscs: [],
    notes: '',
    mashProfile: {
      id: 'mash-1',
      name: 'Single Infusion',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [{ id: 'step-1', name: 'Sacarificación', type: 'Infusion', stepTempC: 67, stepTimeMin: 45, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
    },
    fermentationProfile: null,
    ...overrides,
  };
}

function baseBatch(recipe: Recipe = baseRecipe()): BatchWithReadings {
  return {
    id: 'batch-1',
    name: 'Batch #1 - Test IPA',
    batchNo: 1,
    status: 'Brewing',
    recipeId: recipe.id,
    recipeSnapshot: recipe,
    statsSnapshot: null,
    measuredPreBoilGravity: null,
    measuredMashPh: null,
    measuredBoilSizeL: null,
    measuredBoilTimeMin: null,
    measuredOg: null,
    fermentationStartDate: null,
    measuredFg: null,
    measuredBottlingSizeL: null,
    carbonationType: null,
    carbonationVolumesTarget: null,
    carbonationTempC: null,
    tasteNotes: '',
    tasteRating: null,
    bottlingDate: null,
    closingSnapshot: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    readings: [],
    notes: [],
  };
}

function renderTracker(recipe: Recipe = baseRecipe()) {
  const batch = baseBatch(recipe);
  const stats: CalculatedStats = calculateRecipeStats(recipe);
  return render(<BrewDayTracker batch={batch} stats={stats} />);
}

// ---------------------------------------------------------------------------
// Fake global installers (RA-6) — the single seam both new util modules read
// through. Deleted in afterEach so no state leaks across tests/files.
// ---------------------------------------------------------------------------

interface FakeSentinel {
  release: ReturnType<typeof vi.fn>;
}

function installFakeWakeLock(requestImpl?: () => Promise<FakeSentinel>) {
  const sentinel: FakeSentinel = { release: vi.fn().mockResolvedValue(undefined) };
  const request = vi.fn(requestImpl ?? (() => Promise.resolve(sentinel)));
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
    writable: true,
  });
  return { request, sentinel };
}

function uninstallFakeWakeLock() {
  if ('wakeLock' in navigator) {
    // @ts-expect-error test-only cleanup of a non-standard/faked global
    delete navigator.wakeLock;
  }
}

interface FakeNotificationInstance {
  title: string;
  options?: { body?: string; tag?: string; data?: { anchorAtMs?: number } };
}

interface FakeNotificationCtor {
  permission: BrewDayNotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
  instances: FakeNotificationInstance[];
  new (title: string, options?: FakeNotificationInstance['options']): unknown;
}

function installFakeNotification(
  initialPermission: 'default' | 'denied' | 'granted' = 'default',
  opts: { throwOnConstruct?: boolean; requestPermissionImpl?: () => Promise<BrewDayNotificationPermission> } = {},
): FakeNotificationCtor {
  const instances: FakeNotificationInstance[] = [];
  class FakeNotification {
    static permission: BrewDayNotificationPermission = initialPermission;
    static requestPermission = vi.fn(opts.requestPermissionImpl ?? (() => Promise.resolve(FakeNotification.permission)));
    static instances = instances;
    constructor(title: string, options?: FakeNotificationInstance['options']) {
      if (opts.throwOnConstruct) {
        throw new Error('FakeNotification: construction throws (AC-26 fixture)');
      }
      instances.push({ title, options });
    }
  }
  Object.defineProperty(window, 'Notification', {
    value: FakeNotification,
    configurable: true,
    writable: true,
  });
  return FakeNotification as unknown as FakeNotificationCtor;
}

function uninstallFakeNotification() {
  if ('Notification' in window) {
    // @ts-expect-error test-only cleanup of a non-standard/faked global
    delete window.Notification;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  mockedPlayStepAlert.mockReset();
});

afterEach(() => {
  uninstallFakeWakeLock();
  uninstallFakeNotification();
  vi.useRealTimers();
});

// ===========================================================================
// wakeLock.ts — unit contract (backs AC-1, AC-2, AC-6, AC-7, AC-11, AC-12)
// ===========================================================================

describe('wakeLock.ts unit contract', () => {
  it('isWakeLockSupported() reads navigator.wakeLock at call time, not module scope', () => {
    uninstallFakeWakeLock();
    expect(isWakeLockSupported()).toBe(false);
    installFakeWakeLock();
    expect(isWakeLockSupported()).toBe(true);
    uninstallFakeWakeLock();
    expect(isWakeLockSupported()).toBe(false);
  });

  it('AC-11: acquire() on an unsupported browser resolves false without throwing', async () => {
    uninstallFakeWakeLock();
    const controller = createWakeLockController();
    await expect(controller.acquire()).resolves.toBe(false);
    expect(controller.isHeld()).toBe(false);
  });

  it('AC-1: acquire() calls navigator.wakeLock.request("screen") exactly once and holds the sentinel', async () => {
    const { request } = installFakeWakeLock();
    const controller = createWakeLockController();
    const result = await controller.acquire();
    expect(result).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
    expect(controller.isHeld()).toBe(true);
  });

  it('AC-7: acquire() is idempotent — calling it twice without release calls request() once, not twice', async () => {
    const { request } = installFakeWakeLock();
    const controller = createWakeLockController();
    await controller.acquire();
    await controller.acquire();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('AC-2: release() calls the held sentinel\'s release() exactly once and isHeld() becomes false', async () => {
    const { sentinel } = installFakeWakeLock();
    const controller = createWakeLockController();
    await controller.acquire();
    await controller.release();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
    expect(controller.isHeld()).toBe(false);
  });

  it('release() is idempotent and safe when nothing is held — never throws', async () => {
    installFakeWakeLock();
    const controller = createWakeLockController();
    await expect(controller.release()).resolves.toBeUndefined();
    await controller.acquire();
    await controller.release();
    await expect(controller.release()).resolves.toBeUndefined(); // second release, nothing held
  });

  it('AC-12: a rejecting request() (NotAllowedError) is swallowed — acquire resolves false, never throws', async () => {
    const { request } = installFakeWakeLock(() => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')));
    const controller = createWakeLockController();
    await expect(controller.acquire()).resolves.toBe(false);
    expect(controller.isHeld()).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('a sentinel whose release() itself rejects is swallowed — release() never throws', async () => {
    const sentinel: FakeSentinel = { release: vi.fn().mockRejectedValue(new Error('boom')) };
    installFakeWakeLock(() => Promise.resolve(sentinel));
    const controller = createWakeLockController();
    await controller.acquire();
    await expect(controller.release()).resolves.toBeUndefined();
  });
});

// ===========================================================================
// brewDayNotifications.ts — unit contract (backs AC-19, AC-22, AC-23, AC-26)
// ===========================================================================

describe('brewDayNotifications.ts unit contract', () => {
  it('isNotificationSupported() / getNotificationPermission() read window.Notification at call time', () => {
    uninstallFakeNotification();
    expect(isNotificationSupported()).toBe(false);
    expect(getNotificationPermission()).toBe('unsupported');
    installFakeNotification('granted');
    expect(isNotificationSupported()).toBe(true);
    expect(getNotificationPermission()).toBe('granted');
  });

  it('AC-23: absent API — getNotificationPermission() returns "unsupported"; notifyBrewDayEvent returns false without throwing', () => {
    uninstallFakeNotification();
    expect(getNotificationPermission()).toBe('unsupported');
    expect(() =>
      expect(notifyBrewDayEvent({ tag: 't', title: 'T', body: 'B', anchorAtMs: 0 })).toBe(false),
    ).not.toThrow();
  });

  it('AC-19 support: requestBrewDayNotificationPermission() only calls requestPermission() when permission === "default"', async () => {
    const grantedCtor = installFakeNotification('granted');
    await requestBrewDayNotificationPermission();
    expect(grantedCtor.requestPermission).not.toHaveBeenCalled();
    uninstallFakeNotification();

    const defaultCtor = installFakeNotification('default');
    await requestBrewDayNotificationPermission();
    expect(defaultCtor.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('requestBrewDayNotificationPermission() on an unsupported browser resolves "unsupported" without throwing', async () => {
    uninstallFakeNotification();
    await expect(requestBrewDayNotificationPermission()).resolves.toBe('unsupported');
  });

  it('a rejecting requestPermission() is swallowed — resolves to the current permission, never throws', async () => {
    installFakeNotification('default', { requestPermissionImpl: () => Promise.reject(new Error('dismissed')) });
    await expect(requestBrewDayNotificationPermission()).resolves.toBe('default');
  });

  it('AC-22: permission "denied" — notifyBrewDayEvent returns false and the constructor is never called', () => {
    const ctor = installFakeNotification('denied');
    const fired = notifyBrewDayEvent({ tag: 'x', title: 'T', body: 'B', anchorAtMs: 123 });
    expect(fired).toBe(false);
    expect(ctor.instances).toHaveLength(0);
  });

  it('permission "default" (dismissed) — notifyBrewDayEvent returns false and the constructor is never called', () => {
    const ctor = installFakeNotification('default');
    const fired = notifyBrewDayEvent({ tag: 'x', title: 'T', body: 'B', anchorAtMs: 123 });
    expect(fired).toBe(false);
    expect(ctor.instances).toHaveLength(0);
  });

  it('permission "granted" — notifyBrewDayEvent constructs exactly one Notification with the given tag/title/body', () => {
    const ctor = installFakeNotification('granted');
    const fired = notifyBrewDayEvent({ tag: 'hop-1', title: 'Addition due', body: 'Hop addition: 20 g Magnum @ 59 min', anchorAtMs: 999 });
    expect(fired).toBe(true);
    expect(ctor.instances).toHaveLength(1);
    expect(ctor.instances[0]!.title).toBe('Addition due');
    expect(ctor.instances[0]!.options?.body).toBe('Hop addition: 20 g Magnum @ 59 min');
    expect(ctor.instances[0]!.options?.tag).toBe('hop-1');
  });

  it('notifyBrewDayEvent never accepts/uses a "muted" field (RA-7) — passing one is simply ignored', () => {
    const ctor = installFakeNotification('granted');
    const payloadWithMuted = { tag: 'x', title: 'T', body: 'B', anchorAtMs: 1, muted: true } as Parameters<typeof notifyBrewDayEvent>[0];
    const fired = notifyBrewDayEvent(payloadWithMuted);
    expect(fired).toBe(true);
    expect(ctor.instances).toHaveLength(1); // muted never suppresses a notification
  });

  it('AC-26: permission "granted" but a throwing Notification constructor — notifyBrewDayEvent returns false, does not propagate', () => {
    installFakeNotification('granted', { throwOnConstruct: true });
    expect(() => {
      const fired = notifyBrewDayEvent({ tag: 'x', title: 'T', body: 'B', anchorAtMs: 1 });
      expect(fired).toBe(false);
    }).not.toThrow();
  });
});

// ===========================================================================
// AC-27/AC-28/AC-29 — single-timing-source source sweep
// ===========================================================================

describe('Single-timing-source guarantee (source sweep)', () => {
  const SRC_ROOT = path.resolve(__dirname, '../src');
  const WAKE_LOCK_FILE = path.join(SRC_ROOT, 'utils/wakeLock.ts');
  const NOTIFICATIONS_FILE = path.join(SRC_ROOT, 'utils/brewDayNotifications.ts');
  const TRACKER_FILE = path.join(SRC_ROOT, 'components/BrewDayTracker.tsx');

  function countOccurrences(content: string, needle: string): number {
    return (content.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  it('AC-27: wakeLock.ts and brewDayNotifications.ts contain zero setInterval/setTimeout/Date.now/performance.now', () => {
    for (const file of [WAKE_LOCK_FILE, NOTIFICATIONS_FILE]) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const needle of ['setInterval', 'setTimeout', 'Date.now', 'performance.now']) {
        expect(countOccurrences(content, needle), `${path.basename(file)} must not contain "${needle}"`).toBe(0);
      }
    }
  });

  it('AC-28: BrewDayTracker.tsx contains exactly one setInterval, and its Date.now() count is unchanged from the pre-phase count', () => {
    const content = fs.readFileSync(TRACKER_FILE, 'utf-8');
    expect(countOccurrences(content, 'setInterval')).toBe(1);
    // Pre-phase count recorded via `grep -c "Date.now()"` against the tree
    // at HEAD (a9091a1) before this phase's first edit, per AC-28: 8
    // occurrences (comments + the 5 live call sites at lines 342/356/426/459
    // plus 2 more comment mentions — verified against the actual pre-edit
    // file content, not guessed).
    const PRE_PHASE_DATE_NOW_COUNT = 8;
    expect(countOccurrences(content, 'Date.now()')).toBe(PRE_PHASE_DATE_NOW_COUNT);
  });

  it('AC-29: no file under apps/web/src/ other than the two new utils and BrewDayTracker.tsx (their sole authorized consumer) references "wakeLock" or "Notification"', () => {
    function walk(dir: string, out: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
      }
      return out;
    }
    const allowed = new Set([WAKE_LOCK_FILE, NOTIFICATIONS_FILE, TRACKER_FILE]);
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      if (allowed.has(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (/wakeLock|Notification/.test(content)) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('AC-36: the two modified effects retain their load-bearing exhaustive-deps eslint-disable directives', () => {
    const content = fs.readFileSync(TRACKER_FILE, 'utf-8');
    expect(countOccurrences(content, 'eslint-disable-next-line react-hooks/exhaustive-deps')).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// Integration — Screen Wake Lock, normal operation (AC-1 to AC-7)
// ===========================================================================

describe('BrewDayTracker integration — Wake Lock normal operation', () => {
  it('AC-6: mounting the Brewing tab with running===false calls request() zero times', () => {
    const { request } = installFakeWakeLock();
    renderTracker();
    expect(request).not.toHaveBeenCalled();
  });

  it('AC-1: pressing Play calls navigator.wakeLock.request("screen") exactly once', () => {
    const { request } = installFakeWakeLock();
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('AC-2: pressing Pause calls the held sentinel\'s release() exactly once', async () => {
    const { sentinel } = installFakeWakeLock();
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByTestId('brew-day-pause-btn'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('AC-3: a timer reaching zero releases the lock via the same running-driven effect', async () => {
    const { sentinel } = installFakeWakeLock();
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-hopstand'));
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 20min -> 2min
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 2min -> 12s
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('00:00');
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('AC-4: Skip, Previous Step, Reset, and Global Reset each release the lock', async () => {
    async function flush() {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    const controls: Array<{ testId: string; setup?: () => void }> = [
      { testId: 'brew-day-skip-btn' },
      { testId: 'brew-day-previous-btn', setup: () => fireEvent.click(screen.getByTestId('brew-day-stage-mash')) },
      { testId: 'brew-day-reset-btn' },
      { testId: 'brew-day-global-reset-btn' },
    ];

    for (const control of controls) {
      const { sentinel } = installFakeWakeLock();
      const { unmount } = renderTracker();
      fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
      control.setup?.();
      fireEvent.click(screen.getByTestId('brew-day-play-btn'));
      await flush();
      fireEvent.click(screen.getByTestId(control.testId));
      await flush();
      expect(sentinel.release, `${control.testId} must release the wake lock`).toHaveBeenCalledTimes(1);
      unmount();
      uninstallFakeWakeLock();
    }
  });

  it('AC-5: unmounting the tracker while running calls release() exactly once', async () => {
    const { sentinel } = installFakeWakeLock();
    const { unmount } = renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    unmount();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('AC-7 (integration): the Play control cannot be clicked twice without an intervening Pause — the UI itself enforces the single request (unit-level idempotence proven in wakeLock.ts unit contract above)', () => {
    const { request } = installFakeWakeLock();
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    expect(screen.queryByTestId('brew-day-play-btn')).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Integration — Wake Lock visibility & degradation (AC-8 to AC-13)
// ===========================================================================

describe('BrewDayTracker integration — Wake Lock visibility & degradation', () => {
  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('AC-8: visibilitychange to "hidden" while running calls release()', async () => {
    const { sentinel } = installFakeWakeLock();
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => setVisibility('hidden'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('AC-9: returning to "visible" while running is still true calls request() again', async () => {
    const { request } = installFakeWakeLock();
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    expect(request).toHaveBeenCalledTimes(1);
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('AC-10: returning to "visible" while running is false calls request() zero additional times', async () => {
    const { request } = installFakeWakeLock();
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    fireEvent.click(screen.getByTestId('brew-day-pause-btn'));
    expect(request).toHaveBeenCalledTimes(1);
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(request).toHaveBeenCalledTimes(1); // no additional request while paused
  });

  it('AC-11: with navigator.wakeLock entirely absent, Play still starts the timer and countdown is unaffected', () => {
    uninstallFakeWakeLock();
    expect(() => {
      renderTracker();
      fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
      fireEvent.click(screen.getByTestId('brew-day-play-btn'));
      act(() => {
        vi.advanceTimersByTime(3000);
      });
    }).not.toThrow();
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('44:57');
  });

  it('AC-11 (comparison): the countdown value with wake lock absent matches the supported case for the same elapsed time', () => {
    uninstallFakeWakeLock();
    const runAbsent = renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const absentText = screen.getByTestId('brew-day-timer-display').textContent;
    runAbsent.unmount();

    installFakeWakeLock();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const supportedText = screen.getByTestId('brew-day-timer-display').textContent;

    expect(absentText).toBe(supportedText);
  });

  it('AC-12: wakeLock.request() rejecting (NotAllowedError) is swallowed — running stays true, countdown unaffected', () => {
    installFakeWakeLock(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    expect(() => fireEvent.click(screen.getByTestId('brew-day-play-btn'))).not.toThrow();
    expect(screen.getByTestId('brew-day-pause-btn')).toBeInTheDocument(); // still running
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('44:57');
  });

  it('AC-13: the visibilitychange listener is removed on unmount (dispatching post-unmount causes no additional release)', async () => {
    const { sentinel } = installFakeWakeLock();
    const { unmount } = renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    unmount();
    const callsAfterUnmount = sentinel.release.mock.calls.length;
    expect(() => setVisibility('hidden')).not.toThrow();
    expect(sentinel.release.mock.calls.length).toBe(callsAfterUnmount); // no additional call — listener is gone
  });
});

// ===========================================================================
// Integration — Notifications, anchored firing (AC-14 to AC-18)
// ===========================================================================

describe('BrewDayTracker integration — Notifications anchored firing', () => {
  it('AC-14/AC-15: a boil hop threshold crossing fires exactly one Notification with the alarm\'s verbatim label and tag, additive to the existing audio cue', () => {
    const ctor = installFakeNotification('granted');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(61_000); // atSec=60 for the Magnum hop (boilMins=59 of a 60-min boil)
    });

    const magnumNotifications = ctor.instances.filter((i) => i.options?.tag === 'hop-h-boil-60');
    expect(magnumNotifications).toHaveLength(1);
    expect(magnumNotifications[0]!.options?.body).toBe('Hop addition: 20 g Magnum @ 59 min');
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('warning', expect.anything());
  });

  it('AC-16: the mash timer reaching zero fires exactly one notification tagged with its timerKey, alongside playStepAlert(\'completion\')', () => {
    const ctor = installFakeNotification('granted');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 45min -> 4.5min
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // -> 27s
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(28_000);
    });

    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('00:00');
    const completionNotifications = ctor.instances.filter((i) => i.options?.tag === 'mash-step-1');
    expect(completionNotifications).toHaveLength(1);
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('completion', expect.anything());
  });

  it('AC-16: the boil timer reaching zero fires exactly one notification tagged "stage-boil"', () => {
    const ctor = installFakeNotification('granted');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 60min -> 6min
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // -> 36s
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(37_000);
    });

    const completionNotifications = ctor.instances.filter((i) => i.options?.tag === 'stage-boil');
    expect(completionNotifications).toHaveLength(1);
  });

  it('AC-16: the hopstand timer reaching zero fires exactly one notification tagged "stage-hopstand"', () => {
    const ctor = installFakeNotification('granted');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-hopstand'));
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 20min -> 2min
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // -> 12s
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(13_000);
    });

    const completionNotifications = ctor.instances.filter((i) => i.options?.tag === 'stage-hopstand');
    expect(completionNotifications).toHaveLength(1);
  });

  it('AC-17: advancing time past an already-fired boil alarm does not fire a second notification', () => {
    const ctor = installFakeNotification('granted');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(ctor.instances.filter((i) => i.options?.tag === 'hop-h-boil-60')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(30_000); // well past the threshold, re-renders repeatedly
    });
    expect(ctor.instances.filter((i) => i.options?.tag === 'hop-h-boil-60')).toHaveLength(1);
  });

  it('AC-18: the completion notification\'s anchorAtMs equals targetEndByKey[timerKey] (the same value remainingForKey reads)', () => {
    const ctor = installFakeNotification('granted');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 60min -> 6min
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // -> 36s
    const playedAtMs = Date.now();
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    // remainingByKey['stage-boil'] is 36s at the moment Play is pressed, so
    // the "ensure target end" effect anchors targetEndByKey['stage-boil']
    // at playedAtMs + 36*1000 (BrewDayTracker.tsx's own startFrom logic).
    const expectedAnchorAtMs = playedAtMs + 36 * 1000;

    act(() => {
      vi.advanceTimersByTime(37_000);
    });

    const completionNotifications = ctor.instances.filter((i) => i.options?.tag === 'stage-boil');
    expect(completionNotifications).toHaveLength(1);
    expect(completionNotifications[0]!.options?.data?.anchorAtMs).toBe(expectedAnchorAtMs);
  });
});

// ===========================================================================
// Integration — Notification permission paths (AC-19 to AC-23)
// ===========================================================================

describe('BrewDayTracker integration — Notification permission paths', () => {
  it('AC-19: with permission "default", the first Play calls requestPermission() exactly once; a Pause→Play cycle calls it zero further times', () => {
    const ctor = installFakeNotification('default');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    expect(ctor.requestPermission).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('brew-day-pause-btn'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    expect(ctor.requestPermission).toHaveBeenCalledTimes(1); // still 1 — guarded by the once-per-session ref
  });

  it('AC-20: rendering the tracker, switching stages, and any action short of Play call requestPermission() zero times', () => {
    const ctor = installFakeNotification('default');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    fireEvent.click(screen.getByTestId('brew-day-mute-toggle'));
    fireEvent.click(screen.getByTestId('brew-day-adjusttime-btn'));
    expect(ctor.requestPermission).not.toHaveBeenCalled();
  });

  it('AC-21: setRunning(true) is observable (timer starts) even when requestPermission() never settles', () => {
    installFakeNotification('default', { requestPermissionImpl: () => new Promise(() => {}) });
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    // Synchronous assertion, right after the click — no await, no advance.
    expect(screen.getByTestId('brew-day-pause-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('brew-day-play-btn')).not.toBeInTheDocument();
  });

  it('AC-22: with permission "denied", a would-notify event calls the constructor zero times while playStepAlert still fires with its existing arguments', () => {
    const ctor = installFakeNotification('denied');
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(ctor.instances).toHaveLength(0);
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('warning', expect.objectContaining({ muted: false }));
  });

  it('AC-23: with window.Notification deleted entirely, the same event fires audio and throws nothing', () => {
    uninstallFakeNotification();
    expect(() => {
      renderTracker();
      fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
      fireEvent.click(screen.getByTestId('brew-day-play-btn'));
      act(() => {
        vi.advanceTimersByTime(61_000);
      });
    }).not.toThrow();
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('warning', expect.anything());
    expect(getNotificationPermission()).toBe('unsupported');
  });
});

// ===========================================================================
// Degenerate & empty inputs (AC-24 to AC-25; AC-26 covered in the unit
// contract block above)
// ===========================================================================

describe('Degenerate & empty inputs', () => {
  it('AC-24: zero boil hops and zero timed miscs — boil timer to zero fires exactly one completion notification, zero addition notifications, throws nothing', () => {
    const ctor = installFakeNotification('granted');
    const recipeNoAlarms = baseRecipe({
      hops: [{ id: 'h-whirl', name: 'Citra', amountG: 40, alphaAcidPct: 12, use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 80, type: 'Pellet' }],
      miscs: [],
    });
    expect(() => {
      renderTracker(recipeNoAlarms);
      fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
      expect(screen.queryByTestId('brew-day-boil-alarms')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 60min -> 6min
      fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // -> 36s
      fireEvent.click(screen.getByTestId('brew-day-play-btn'));
      act(() => {
        vi.advanceTimersByTime(37_000);
      });
    }).not.toThrow();

    expect(ctor.instances.filter((i) => i.options?.tag === 'stage-boil')).toHaveLength(1);
    expect(ctor.instances.filter((i) => i.options?.tag?.startsWith('hop-') || i.options?.tag?.startsWith('misc-'))).toHaveLength(0);
  });

  it('AC-25: hopstandDurationMin === 0 (no whirlpool/aroma hops) — a never-played, zero-length stage fires no hopstand notification and never acquires the wake lock', () => {
    const ctor = installFakeNotification('granted');
    const { request } = installFakeWakeLock();
    const recipeNoHopstand = baseRecipe({
      hops: [{ id: 'h-boil-60', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 59, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
    });
    renderTracker(recipeNoHopstand);
    fireEvent.click(screen.getByTestId('brew-day-stage-hopstand'));
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('00:00');

    // The stage is never played (a 0-duration stage has nothing to run) —
    // no Play click here, per RA-2's "never runs" framing.
    expect(ctor.instances.filter((i) => i.options?.tag === 'stage-hopstand')).toHaveLength(0);
    expect(request).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Unsupported-capability disclosure (AC-37, AC-38)
// ===========================================================================

describe('Unsupported-capability disclosure', () => {
  it('AC-37: brew-day-hands-free-status renders, and its text differs between both-APIs-present-and-granted vs. both-absent', () => {
    installFakeWakeLock();
    installFakeNotification('granted');
    const { unmount } = renderTracker();
    const presentText = screen.getByTestId('brew-day-hands-free-status').textContent;
    unmount();

    uninstallFakeWakeLock();
    uninstallFakeNotification();
    renderTracker();
    const absentText = screen.getByTestId('brew-day-hands-free-status').textContent;

    expect(presentText).not.toBe(absentText);
  });

  it('AC-38: the hands-free status is never written to React state or forwarded into any of the controlled persistence callbacks', () => {
    installFakeWakeLock();
    installFakeNotification('granted');

    // Controlled harness mirroring BatchDetail.tsx's real wiring
    // (BatchDetail.tsx:238-382) — the persisted localStorage payload is
    // built EXCLUSIVELY from this fixed set of callback-captured fields.
    // BrewDayTracker.tsx has no prop through which a locally-derived render
    // value (like the hands-free status) could reach it.
    function Harness() {
      const batch = baseBatch();
      const stats = calculateRecipeStats(batch.recipeSnapshot);
      const [activeStageIndex, setActiveStageIndex] = useState(0);
      const [remainingByKey, setRemainingByKey] = useState<Record<string, number>>({});
      const [targetEndByKey, setTargetEndByKey] = useState<Record<string, number>>({});
      const [running, setRunning] = useState(false);
      const [firedBoilAlarms, setFiredBoilAlarms] = useState<Set<string>>(new Set());
      const [checkedItemIds] = useState<Set<string>>(new Set());
      const [userAddedIds] = useState<Set<string>>(new Set());
      const [persistedJson, setPersistedJson] = useState('');

      useEffect(() => {
        // Exactly BatchDetail.tsx:359-369's field set.
        setPersistedJson(
          JSON.stringify({
            activeStageIndex,
            remainingByKey,
            targetEndByKey,
            running,
            checkedItemIds: Array.from(checkedItemIds),
            userAddedIds: Array.from(userAddedIds),
            firedBoilAlarms: Array.from(firedBoilAlarms),
          }),
        );
      }, [activeStageIndex, remainingByKey, targetEndByKey, running, checkedItemIds, userAddedIds, firedBoilAlarms]);

      return (
        <>
          <BrewDayTracker
            batch={batch}
            stats={stats}
            activeStageIndex={activeStageIndex}
            onSelectStage={setActiveStageIndex}
            remainingByKey={remainingByKey}
            onUpdateRemainingByKey={(patch) => setRemainingByKey((prev) => (typeof patch === 'function' ? patch(prev) : patch))}
            targetEndByKey={targetEndByKey}
            onUpdateTargetEndByKey={(patch) => setTargetEndByKey((prev) => (typeof patch === 'function' ? patch(prev) : patch))}
            running={running}
            onToggleRunning={setRunning}
            firedBoilAlarms={firedBoilAlarms}
            onAddFiredBoilAlarm={(id) => setFiredBoilAlarms((prev) => new Set(prev).add(id))}
          />
          <div data-testid="persisted-json">{persistedJson}</div>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByTestId('brew-day-pause-btn'));

    const persistedJson = screen.getByTestId('persisted-json').textContent ?? '';
    expect(persistedJson.length).toBeGreaterThan(0);
    const parsed = JSON.parse(persistedJson);
    expect(Object.keys(parsed).sort()).toEqual(
      ['activeStageIndex', 'checkedItemIds', 'firedBoilAlarms', 'remainingByKey', 'running', 'targetEndByKey', 'userAddedIds'].sort(),
    );
    expect(persistedJson).not.toMatch(/wake/i);
    expect(persistedJson).not.toMatch(/notification/i);
  });
});

// ===========================================================================
// AC-39/AC-40 — [MANUAL] real-hardware verification. Not applicable to this
// automated test file; see .gsd/active/manual_verification/M41_P1/ (not yet
// populated — this is this phase's own outstanding manual backlog, per the
// spec's closing note under §3).
// ===========================================================================
