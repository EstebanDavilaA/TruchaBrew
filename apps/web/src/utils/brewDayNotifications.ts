/**
 * System notifications for brew-day timed events (M41_P1 spec §1.2). Fired
 * from BrewDayTracker's EXISTING alert-firing effect sites — see
 * BrewDayTracker.tsx's completion effect and boil-alarm effect — never from
 * any new timing mechanism of its own.
 *
 * `window.Notification` is read at CALL TIME only, never captured at module
 * scope (RA-6), so jsdom tests can fake the constructor per-test.
 *
 * Contains no timing mechanism of its own (AC-27, enforced by a source
 * sweep in test/M41_P1_HandsFree.test.tsx — deliberately not named as a
 * contiguous literal here, since that sweep greps this very file) — no
 * interval/timeout polling and no wall-clock reads anywhere in this file.
 * `notifyBrewDayEvent` computes no time delta — `anchorAtMs` is carried
 * through display-only, never subtracted from anything here.
 *
 * `notifyBrewDayEvent` deliberately does NOT accept a `muted` parameter
 * (RA-7) — muting silences the audio cue only; notifications are the one
 * channel that must survive a mute toggle.
 */

export type BrewDayNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface BrewDayNotificationPayload {
  /** Dedupe tag — an EXISTING id (alarm.id or timerKey). Never newly invented. */
  tag: string;
  title: string;
  /** Reuses boilAlarms[].label verbatim, or the stage-completion sentence. */
  body: string;
  /** The targetEndByKey anchor (epoch ms) this event derives from. Display only. */
  anchorAtMs: number;
}

interface WindowWithNotification {
  Notification?: typeof Notification;
}

function getNotificationCtor(): typeof Notification | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as WindowWithNotification).Notification;
}

export function isNotificationSupported(): boolean {
  return getNotificationCtor() !== undefined;
}

/** Maps an absent API to 'unsupported'; otherwise returns Notification.permission verbatim. */
export function getNotificationPermission(): BrewDayNotificationPermission {
  const ctor = getNotificationCtor();
  if (ctor === undefined) return 'unsupported';
  return ctor.permission;
}

/**
 * Requests only when permission === 'default'. Never throws; never awaits a
 * UI gesture itself (the caller is responsible for firing this from inside
 * an existing user-gesture handler and not awaiting the returned promise).
 */
export async function requestBrewDayNotificationPermission(): Promise<BrewDayNotificationPermission> {
  const ctor = getNotificationCtor();
  if (ctor === undefined) return 'unsupported';
  if (ctor.permission !== 'default') return ctor.permission;
  try {
    const result = await Promise.resolve(ctor.requestPermission());
    return result;
  } catch {
    return ctor.permission;
  }
}

/**
 * Fires one notification if and only if permission === 'granted'.
 * Returns false (no throw, no side effect) when unsupported, denied, or
 * default, or when construction itself throws.
 */
export function notifyBrewDayEvent(payload: BrewDayNotificationPayload): boolean {
  const ctor = getNotificationCtor();
  if (ctor === undefined) return false;
  if (ctor.permission !== 'granted') return false;
  try {
    // eslint-disable-next-line no-new -- side effect (showing the OS
    // notification) IS the point; there's nothing to keep a reference to.
    new ctor(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { anchorAtMs: payload.anchorAtMs },
    });
    return true;
  } catch {
    return false;
  }
}
