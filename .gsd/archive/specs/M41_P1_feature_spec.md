# FEATURE SPECIFICATION: M41_P1 — Hands-free at the kettle

**Milestone:** 41 (Hands-free at the kettle) — initiative "Ready to Hand to a Brewer"
**Phase:** 1 of 1 (roadmap-estimated)
**Author:** planner (claude-code), 2026-09-04
**Depends on:** M15/M18 (`BrewDayTracker` wall-clock anchors + Web Audio cues), M40 (touch-target hardening)

> ### ⚠ AMENDMENT 1 — 2026-09-04 (post-Layer-1-FAIL corrective pass)
> This spec was approved, executed, and **FAILed Layer 1** (`test`): `apps/web/test/controlTargetSize.test.ts`'s
> M40_P3 `RAW_BUTTON_SUB_44PX_ALLOWLIST` pins the pre-existing checklist-item raw `<button>` in
> `BrewDayTracker.tsx` by exact line number (`:541`). This phase's spec-mandated additions (imports, two new
> refs, two new effects, `handlePlay` changes) all had to sit above the existing `renderChecklist` function per
> this spec's own contract, structurally pushing that byte-identical button down to line `:619`. Per hard rule 4
> this routed through `/diagnose`: **DIAGNOSIS: spec error** — the implementation is faithful; this spec simply
> never checked whether its required insertion point would collide with a line-pinned fixture elsewhere in the
> codebase. **This is a same-phase amendment, not a new phase.** All 40 original ACs are unchanged; **AC-41 is
> appended** and `apps/web/test/controlTargetSize.test.ts` is added to Authorized Files with a one-line,
> narrowly-scoped correction. `RAW_BUTTON_SUB_44PX_ALLOWLIST`'s line-pinning fragility itself (already visible as
> a design smell — M40_P1's own RA-5 explicitly warned against trusting line numbers for this exact reason) is
> **not** redesigned here; that is a separate, larger M40-territory concern out of proportion to this
> reconciliation, and is logged to `FEATURES.md` instead of being folded in.

---

## Phase Summary

Leave the phone on the bench through a five-hour brew day. Two capabilities, both strictly additive to the existing `BrewDayTracker`:

1. **Screen Wake Lock**, held *only* while a brew-day timer is actually running, and released on pause, stage completion, tab/route navigation away, visibility loss, and unmount.
2. **System notifications** for timed hop/misc additions, mash step ends, boil end and hopstand end — fired from the **same `targetEndByKey` wall-clock anchors** the tracker already computes, never from a second countdown.

Permission is requested **in context, at brew-day start** (the first user-gesture transition of `running` false→true), never on app load. A denial, a dismissal, or an entirely absent API degrades silently to today's `playStepAlert` Web Audio behaviour with **zero change** to any M15/M18 timer behaviour.

**Zero calculation, schema, or API change.** No file under `apps/api/`, `packages/`, `db/`, or any `calculations`/`schema` module is touched. If implementation appears to require one, that is a `/diagnose` route, not a silent edit.

### Verified current-source facts this spec is built on

These were checked against the tree on 2026-09-04, not taken from roadmap prose:

- `grep -rin "wakeLock"` over `apps/`, `packages/` (excluding `apps/web/dist/`): **zero hits.** Entirely net-new.
- `apps/web/src/components/BrewDayTracker.tsx:82,114,173-180` — `targetEndByKey: Record<string, number>` exists under exactly that name, controlled-or-uncontrolled, values are `Date.now()`-based epoch-ms end timestamps.
- `remainingForKey()` (`BrewDayTracker.tsx:340-345`) derives remaining seconds as `Math.max(0, Math.round((targetEndByKey[key] - Date.now()) / 1000))` while `running && key === timerKey`. **This is the single timing source in the app.**
- `setInterval(..., 1000)` at `BrewDayTracker.tsx:365-369` is a **repaint trigger only** — it carries no timing information (documented in-source at lines 361-364).
- The two existing alert firing sites, both keyed on `remainingSec`:
  - **Completion** — `BrewDayTracker.tsx:376-383`, fires `playStepAlert('completion')` once when `running && remainingSec === 0`, and freezes `remainingByKey[timerKey] = 0`.
  - **Boil additions** — `BrewDayTracker.tsx:387-397`, fires `playStepAlert('warning')` per `boilAlarms` entry when `elapsedSec >= alarm.atSec`, deduped by the `firedBoilAlarms` set.
- `boilAlarms` (`BrewDayTracker.tsx:266-282`) already carries `{ id, atSec, label }` with human-readable labels (`"Hop addition: 30 g Citra @ 15 min"`). **Notification bodies reuse these labels verbatim** — no new label computation.
- There is **no "Start Brew Day" button** anywhere in the tree. The tracker is mounted by `BatchDetail.tsx:1131-1183` when `activeTab === 'brewing'`. The only genuine user-gesture "the brew day is now underway" moment is `handlePlay` (`BrewDayTracker.tsx:399-401`). That is the permission-request point.
- `apps/web/test/setup.ts` already establishes the project's precedent for polyfilling missing jsdom globals (`localStorage`, `Request`) via `Object.defineProperty` on `globalThis`/`window`.
- **`git diff --name-only` is NOT viable as a scope guardrail in this repo right now** — see RA-9.

### Key Behaviors

1. While `running === true`, a screen wake lock is held. While `running === false`, it is not.
2. The wake lock is released — not merely dropped — on pause, timer completion, Skip, Previous Step, Reset, Global Reset, batch change, component unmount, and `document.visibilityState === 'hidden'`.
3. On return to `visibilityState === 'visible'`, the lock is **re-acquired if and only if `running` is still true** (browsers release wake locks automatically on visibility loss; re-acquisition is mandatory, not optional).
4. A notification fires at each boil addition threshold, and at each timer's zero, **from inside the existing effect sites** — the same `remainingSec` evaluation that already fires the audio cue.
5. Audio always fires. Notification is strictly *in addition to* audio, never *instead of* it.
6. Permission is requested exactly once per session, on the first `running` false→true transition, and only if `Notification.permission === 'default'`.
7. `denied`, `default` (dismissed), or absent API ⇒ notifications are never attempted; all M15/M18 behaviour is byte-for-byte unchanged.

### Resolved Ambiguities (Binding)

**RA-1 — Wake Lock is bound to `running`, not to mounting or to the Brewing tab.**
The acquire/release condition is exactly the boolean `running` (`BrewDayTracker.tsx:182`). Mounting the Brewing tab with a paused timer acquires **nothing**. This is deliberate: a phone that never sleeps because a batch page is open is a bug, not the feature.

**RA-2 — Notification firing hooks into the two EXISTING effect sites. No new effect with timing semantics may be added.**
Binding implementation contract:
- The completion effect at `BrewDayTracker.tsx:376-383` gains one call: `notifyBrewDayEvent(...)` placed immediately adjacent to its existing `playStepAlert('completion', { muted })`.
- The boil-alarm effect at `BrewDayTracker.tsx:387-397` gains one call inside its existing `if (elapsedSec >= alarm.atSec && !firedBoilAlarms.has(alarm.id))` block, adjacent to `playStepAlert('warning', { muted })`.
- **No new `setInterval`, no new `setTimeout` holding a countdown, no new `Date.now()` subtraction, and no accumulated-elapsed state may be introduced anywhere in this phase.** `remainingSec` remains the sole trigger quantity, and it remains derived from `targetEndByKey` alone.
- Consequence, accepted explicitly: while the tab is backgrounded, browsers throttle the 1s repaint interval, so a notification can arrive *late* relative to its wall-clock anchor. This is accepted rather than worked around, because every available workaround (a scheduled `setTimeout` per anchor, a Web Worker tick, a service-worker alarm) constitutes a second timing source, which the roadmap defines as a milestone failure. **The Wake Lock is the mitigation**: the primary scenario — phone on the bench, screen on, tab foreground — keeps the tab unthrottled, and there the notification and the audio cue fire in the same effect invocation, hence at the same instant by construction. The `notifyBrewDayEvent` payload therefore carries the anchor timestamp so a late-delivered notification still states the correct intended time.

**RA-3 — Dedupe piggybacks on existing state; no parallel "fired" bookkeeping.**
Boil-addition notifications reuse the existing `firedBoilAlarms` set (already gating the audio cue). The completion notification reuses the existing `running && remainingSec === 0` one-shot, which self-disarms by setting `running = false`. **No new fired-set state is introduced.** A notification and its audio cue are therefore deduped by the same guard — they cannot diverge.

**RA-4 — Permission requested at the first `running` false→true transition, in `handlePlay`.**
Requested only when `Notification.permission === 'default'`; never on module import, never in a mount effect, never on app load. The request is fired from inside the click handler (browsers require a user gesture) and its promise is **not awaited** — `setRunning(true)` happens unconditionally and first, so a slow or ignored permission prompt can never delay or block the timer starting. Guarded by a `useRef` so a pause/play cycle does not re-prompt within a session.

**RA-5 — Absent API vs. denied permission are handled by the same path, but are distinct states.**
- **Absent** (`typeof Notification === 'undefined'`, or `'wakeLock' in navigator === false`): treated as permanently unavailable. No prompt, no error, no console noise, no UI affordance implying otherwise.
- **Denied**: same runtime behaviour as absent.
- **iOS Safari decision (binding):** iOS Safari does not support the Screen Wake Lock API on older versions and gates Web Notifications behind add-to-home-screen installation. **This phase ships no polyfill, no NoSleep.js-style video-loop hack, and no fallback shim.** On an unsupported browser the app behaves exactly as it does today — audio cues, screen sleeps normally. The user-visible acknowledgement is a single passive status line in the tracker (`data-testid="brew-day-hands-free-status"`) stating which of the two capabilities is active, so a brewer learns *before* walking away rather than by missing an addition. Reviving native wake-lock/notification plugins is already captured in the roadmap's deferred "Native mobile app shell (Capacitor)" entry, whose revival trigger is precisely this.

**RA-6 — jsdom implements neither API; both are injected through a single seam, and tested through it.**
jsdom 25.0.1 provides no `navigator.wakeLock` and no `window.Notification`. Rather than mock globals ad hoc per test, both capabilities are accessed **exclusively** through the two new pure-ish utility modules named in §1, which read `navigator`/`window` at call time (never at module scope) and never throw. Layer 1 tests then install fake globals with `Object.defineProperty(globalThis, ...)` / `vi.stubGlobal`, exactly as `test/setup.ts` already does for `localStorage`, and assert on the recorded calls to those fakes:
- `permission: 'granted'` ⇒ a fake `Notification` constructor records `(title, options)`.
- `permission: 'denied'` ⇒ the fake constructor is asserted **never** called, while the `playStepAlert` spy still records its call.
- API entirely absent ⇒ globals deleted; assert no throw, and audio still fires.
- Wake lock ⇒ a fake `navigator.wakeLock.request()` resolving to a sentinel with a spied `release()`, plus a rejecting variant (Chrome rejects `request()` with `NotAllowedError` on a hidden document) asserted not to throw or to break `running`.
Capturing wall-clock behaviour uses `vi.useFakeTimers()` + `vi.setSystemTime()`, the mechanism `test/BrewDayTracker.test.tsx` already relies on. **No real permission grant/denial and no real browser is required for any Layer 1 assertion.**

**RA-7 — Muting silences audio only; it does not silence notifications.**
`playStepAlert` already honours `muted` (`audioAlerts.ts:61`). The mute toggle exists so a brewer in a shared house can kill the beeps — killing the notifications too would remove the only remaining channel. `notifyBrewDayEvent` therefore does **not** receive `muted`. Documented here because the opposite reading is defensible and a critic must not have to guess.

**RA-8 — Notification `tag` is the event's existing id; `renotify` is not used.**
Boil additions use `tag: alarm.id` (e.g. `hop-<id>`), timer completions use `tag: timerKey` (e.g. `stage-boil`, `mash-<id>`). Values come from existing computed identifiers — **no new id scheme is invented**. This makes the OS collapse a re-fired duplicate rather than stacking it, without any application-level tracking.

**RA-9 — The scope guardrail uses a SHA-256 content manifest, NOT `git diff`.**
Checked, not assumed: `git log --oneline -3` shows `a9091a1 "Milestone 39 completed"` as HEAD, and `git status --porcelain` reports **30 modified files, including all of Milestone 40's implementation** (`apps/web/src/App.tsx`, `pages/BatchDetail.tsx`, `components/designSystem.ts`, and 20+ others). Milestone 40 was closed at `/steer` but never committed. A `git diff --name-only HEAD` guardrail would therefore report M40's entire diff as this phase's changes and is **structurally incapable** of isolating M41_P1 — the exact unverifiable-criterion failure that recurred five times in this project's history. AC-24 instead specifies a **pre/post content manifest**: `git ls-files -co --exclude-standard -z | xargs -0 sha256sum > <manifest>` captured **before the executor's first edit** and again at the end, with the diff of the two manifests being the authoritative change set.

**RA-10 — `BatchDetail.tsx` gains no wake-lock or notification logic.**
All of it lives in `BrewDayTracker.tsx` and the two new utility modules. `BatchDetail` already lifts `running`/`targetEndByKey` and persists them (`BatchDetail.tsx:238-240, 363-364, 371-382`); that machinery is **read, not modified**. `BatchDetail.tsx` is deliberately **absent** from the Authorized Files list. Consequently the localStorage-persisted `running: true` restored on remount (`BatchDetail.tsx:321`) re-acquires the wake lock through the same `running`-driven effect, with no restore-path special-casing.

---

## 1. Data Schema & Contracts

**Zero changes to `db/schema.ts`, any API route, any request/response type, or any calculation module.** No exported type in `packages/` is added, removed, or altered.

### 1.1 New file: `apps/web/src/utils/wakeLock.ts`

```ts
export interface WakeLockController {
  /** Idempotent. Resolves false if unsupported, denied, or the request rejected. */
  acquire(): Promise<boolean>;
  /** Idempotent. Safe to call when nothing is held. Never throws. */
  release(): Promise<void>;
  /** True iff a sentinel is currently held and not released. */
  isHeld(): boolean;
}

/** Reads `navigator.wakeLock` at call time, never at module scope. */
export function isWakeLockSupported(): boolean;

/** Factory; each tracker instance owns one controller. Never throws. */
export function createWakeLockController(): WakeLockController;
```

### 1.2 New file: `apps/web/src/utils/brewDayNotifications.ts`

```ts
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

export function isNotificationSupported(): boolean;

export function getNotificationPermission(): BrewDayNotificationPermission;

/** Requests only when permission === 'default'. Never throws; never awaits a UI gesture. */
export function requestBrewDayNotificationPermission(): Promise<BrewDayNotificationPermission>;

/**
 * Fires one notification if and only if permission === 'granted'.
 * Returns false (no throw, no side effect) when unsupported, denied, or default.
 * MUST NOT be passed `muted` (RA-7) and MUST NOT compute any time delta.
 */
export function notifyBrewDayEvent(payload: BrewDayNotificationPayload): boolean;
```

### 1.3 Symbol inventory

| Symbol | Status |
|---|---|
| `targetEndByKey`, `remainingForKey`, `remainingSec`, `nominalDurationSec` | **UNTOUCHED** — read only |
| `playStepAlert`, `TONE_SEQUENCES`, `AudioAlertOptions` | **UNTOUCHED** — `audioAlerts.ts` is not in Authorized Files |
| `boilAlarms`, `firedBoilAlarms`, `addFiredBoilAlarm` | **READ / REUSED** — no shape change |
| `BrewDayTrackerProps` | **UNCHANGED** — no new props |
| Completion effect (`:376-383`), boil-alarm effect (`:387-397`) | **MODIFIED** — one added call each, no changed dependency array semantics |
| `handlePlay` (`:399-401`) | **MODIFIED** — permission request added after `setRunning(true)` |
| `wakeLock.ts`, `brewDayNotifications.ts` | **NEW** |

### 1.4 Refactoring / legacy cleanup

There is **no** obsolete registration loop, legacy alias, or dead map to purge — this is net-new surface. The one negative obligation: the executor must **not** "tidy" the existing `// eslint-disable-next-line react-hooks/exhaustive-deps` directives on the two modified effects. They are load-bearing (a full dependency array on the boil effect would refire on every `firedBoilAlarms` change), and removing them is a regression, not a cleanup.

---

## 2. Transformations & Pure Logic

Pure, no React, no globals captured at module scope:

- `isWakeLockSupported()` / `isNotificationSupported()` — pure predicates over the live global.
- `getNotificationPermission()` — maps absent API to `'unsupported'`; otherwise returns `Notification.permission` verbatim.
- `notifyBrewDayEvent(payload)` — permission gate → construct → `true`. Any throw is swallowed and returns `false`.

**Stateful / integration contracts** (inside `BrewDayTracker`, must not leak into the pure modules):

- A `useRef<WakeLockController>` created once per mount.
- One `useEffect` keyed on `[running]`: acquire when true, release when false; cleanup releases.
- One `useEffect` registering a `visibilitychange` listener: `hidden` ⇒ release; `visible` ⇒ re-acquire **only if `running`** (RA-1/behaviour 3). Listener removed on unmount.
- A `useRef<boolean>` guarding the once-per-session permission request.
- A derived status string for `brew-day-hands-free-status`, computed from the two support predicates plus the current permission — **never written into React state**, so an unsupported-API placeholder cannot leak into persisted brew-day state (`BatchDetail.tsx:359-382` serialises state; this value must never reach it).

---

## 3. Acceptance Criteria & Test Matrix

All ACs verifiable by `npm test` unless marked **[MANUAL]**.

### Wake Lock — normal operation

| # | Criterion |
|---|---|
| AC-1 | With a fake `navigator.wakeLock`, pressing Play (`running` false→true) calls `navigator.wakeLock.request('screen')` exactly once. |
| AC-2 | Pressing Pause calls the held sentinel's `release()` exactly once, and `isHeld()` becomes false. |
| AC-3 | A timer reaching zero (`remainingSec === 0` with `running` true) releases the lock, via the same `running`-driven effect — no separate completion-specific release call exists. |
| AC-4 | Skip, Previous Step, Reset, and Global Reset each release the lock (each sets `running = false`). |
| AC-5 | Unmounting the tracker while running calls `release()` exactly once. |
| AC-6 | Mounting the Brewing tab with `running === false` calls `request()` **zero** times (RA-1). |
| AC-7 | Two consecutive Play presses without an intervening Pause call `request()` once, not twice (idempotence). |

### Wake Lock — visibility & degradation

| # | Criterion |
|---|---|
| AC-8 | Dispatching `visibilitychange` with `visibilityState === 'hidden'` while running calls `release()`. |
| AC-9 | Returning to `'visible'` while `running` is still true calls `request()` again. |
| AC-10 | Returning to `'visible'` while `running` is false calls `request()` **zero** additional times. |
| AC-11 | With `navigator.wakeLock` entirely absent, Play still starts the timer, no exception escapes, and `remainingSec` counts down identically to the supported case (asserted against a run with the API present). |
| AC-12 | With `wakeLock.request()` rejecting (`NotAllowedError`), the rejection is swallowed, `running` stays true, and the countdown is unaffected. |
| AC-13 | The `visibilitychange` listener is removed on unmount (asserted via a spied `removeEventListener`, or by dispatching post-unmount and observing no call). |

### Notifications — anchored firing

| # | Criterion |
|---|---|
| AC-14 | With permission `'granted'` and system time advanced so `elapsedSec >= alarm.atSec` for a boil hop alarm, the fake `Notification` constructor is called once with `body` equal to that alarm's existing `label` string verbatim and `tag === alarm.id`. |
| AC-15 | The same event **also** calls `playStepAlert('warning', ...)` — notification is additive, never a replacement (AC-14 and AC-15 assert on the same single simulated event). |
| AC-16 | A mash step timer, the boil timer, and the hopstand timer each reaching zero fire exactly one notification with `tag === timerKey` for that stage, alongside the existing `playStepAlert('completion', ...)`. |
| AC-17 | Advancing time past an already-fired boil alarm re-renders without firing a second notification (dedupe via existing `firedBoilAlarms`, RA-3). |
| AC-18 | `notifyBrewDayEvent` receives `anchorAtMs` equal to `targetEndByKey[timerKey]` for completion events — the same value `remainingForKey` reads. Asserted on the recorded payload. |

### Notifications — permission paths

| # | Criterion |
|---|---|
| AC-19 | With `Notification.permission === 'default'`, the first Play calls `Notification.requestPermission()` exactly once; a Pause→Play cycle in the same session calls it zero further times (RA-4). |
| AC-20 | Rendering the tracker, switching to the Brewing tab, and any action short of pressing Play call `requestPermission()` **zero** times — no app-load or mount-time request (RA-4). |
| AC-21 | `setRunning(true)` is observable (the timer starts) even when `requestPermission()` returns a promise that never settles — the timer must not await the prompt. |
| AC-22 | With permission `'denied'`, an event that would notify calls the `Notification` constructor **zero** times while `playStepAlert` is still called with its existing arguments, and `remainingSec` / `firedBoilAlarms` / `running` transitions are identical to a control run with no notification code path exercised. |
| AC-23 | With `window.Notification` deleted entirely, the same event fires audio, throws nothing, and `getNotificationPermission()` returns `'unsupported'` (RA-5). |

### Degenerate & empty inputs

| # | Criterion |
|---|---|
| AC-24 | A recipe with **zero** boil hops and zero timed miscs (`boilAlarms.length === 0`) runs the boil timer to zero, fires exactly one completion notification, zero addition notifications, and throws nothing. |
| AC-25 | A recipe with `hopstandDurationMin === 0` (no whirlpool/aroma hops) does not fire a hopstand notification, and the wake lock is not acquired for a zero-length stage that never runs. |
| AC-26 | `notifyBrewDayEvent` with `permission === 'granted'` but a `Notification` constructor that throws returns `false` and does not propagate. |

### Single-timing-source guarantee (source sweep)

| # | Criterion |
|---|---|
| AC-27 | An automated source sweep asserts that `apps/web/src/utils/wakeLock.ts` and `apps/web/src/utils/brewDayNotifications.ts` contain **zero** occurrences of `setInterval`, `setTimeout`, `Date.now`, or `performance.now` — the notification path holds no clock of its own (RA-2). |
| AC-28 | The sweep asserts `BrewDayTracker.tsx` contains exactly **one** `setInterval` occurrence (the pre-existing repaint trigger at `:365-369`) and that its count of `Date.now()` occurrences is **unchanged** from the pre-phase count (record the pre-phase count in the test as a literal with a comment citing this AC). |
| AC-29 | The sweep asserts no new file under `apps/web/src/` outside the two authorized new utils references `wakeLock` or `Notification`. |

### Scope guardrail

| # | Criterion |
|---|---|
| AC-30 | **[MANUAL — executor obligation]** `git diff --name-only` is explicitly NOT used here (RA-9: 30 files including all of M40 are uncommitted against HEAD `a9091a1`). Instead: the executor captures `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum > /tmp/m41p1_pre.sha256` **before its first edit**, and the same command to `/tmp/m41p1_post.sha256` after its last. `diff` of the two manifests must list **only**: `apps/web/src/components/BrewDayTracker.tsx`, `apps/web/src/utils/wakeLock.ts` (new), `apps/web/src/utils/brewDayNotifications.ts` (new), `apps/web/test/M41_P1_HandsFree.test.tsx` (new), plus `.gsd/` bookkeeping files. Both manifests are pasted into the `/execute` report. |
| AC-31 | The manifest diff shows **zero** entries under `apps/api/`, `packages/`, or `db/`, and **zero** change to `apps/web/src/utils/audioAlerts.ts`, `apps/web/src/pages/BatchDetail.tsx`, or `apps/web/src/components/designSystem.ts` (RA-10). |
| AC-32 | No new runtime dependency is added: `package.json` and `package-lock.json` are absent from the manifest diff. |

### Regression & Layer 1

| # | Criterion |
|---|---|
| AC-33 | `apps/web/test/BrewDayTracker.test.tsx` passes **unmodified** — the file is absent from the AC-30 manifest diff. This is the M15/M18-behaviour-unchanged proof. |
| AC-34 | `apps/web/test/BatchDetail.test.tsx` and `BrewDayTimelineBar.test.tsx` pass unmodified. |
| AC-35 | All four Layer 1 gates green from the repo root: `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` — each by exit code 0. |
| AC-36 | The two modified effects retain their existing `// eslint-disable-next-line react-hooks/exhaustive-deps` directives (§1.4). |

### Unsupported-capability disclosure

| # | Criterion |
|---|---|
| AC-37 | An element with `data-testid="brew-day-hands-free-status"` renders in the tracker and states which capabilities are active. With both APIs faked-present and permission `'granted'` its text differs from its text with both absent (assert on two renders, not on a hardcoded string). |
| AC-38 | That status value is never written to React state and never appears in the object passed to `saveBrewDayState` — asserted by inspecting the persisted `localStorage` payload for the batch after a full play/pause cycle (§2, RA-10). |

### Real-hardware verification (milestone threshold)

| # | Criterion |
|---|---|
| AC-39 | **[MANUAL]** On a real phone, with a mash rest running and the device untouched for the full rest, the screen is still on at rest end, and the addition alert arrives at the same wall-clock instant the in-page timer reads zero. Photo/screenshot evidence in `.gsd/active/manual_verification/M41_P1/`. |
| AC-40 | **[MANUAL]** On that same device with notification permission denied, every M15/M18 timer behaviour is observed unchanged. Evidence in the same directory. |

> AC-39/AC-40 are the roadmap's stated verification threshold and cannot be satisfied by tests. They are **this phase's own** manual backlog. Milestone 40's outstanding hardware backlog (LAN reachability, 375px screenshots, tap-target confirmation across M40_P1/P2/P3) is **explicitly out of scope here** and must not be folded into this matrix.

### Amendment 1 reconciliation

| # | Criterion |
|---|---|
| AC-41 `[NEW]` | `apps/web/test/controlTargetSize.test.ts`'s `RAW_BUTTON_SUB_44PX_ALLOWLIST` entry for `BrewDayTracker.tsx`'s checklist-item button is updated from its pre-phase line number to its actual post-phase line number (verified by the executor against the real file, not assumed to still be `:619` if further drift occurred). The button's own content/classes are unchanged — this is a fixture-value correction only. No other entry in the allowlist, and no other assertion anywhere in `controlTargetSize.test.ts`, may change. |

---

## 4. Authorized Files

*(Amendment 1 — adds one file to the original four. `[+]` marks the Amendment-1 addition.)*

**Modify:**
- `apps/web/src/components/BrewDayTracker.tsx`
- `[+]` `apps/web/test/controlTargetSize.test.ts` — AC-41 only: the single `RAW_BUTTON_SUB_44PX_ALLOWLIST` line-number string for `BrewDayTracker.tsx`. No other line in this file may change.

**Create:**
- `apps/web/src/utils/wakeLock.ts`
- `apps/web/src/utils/brewDayNotifications.ts`
- `apps/web/test/M41_P1_HandsFree.test.tsx`

**Explicitly NOT authorized** (touching any of these fails AC-30/AC-31): `apps/web/src/pages/BatchDetail.tsx`, `apps/web/src/utils/audioAlerts.ts`, `apps/web/src/components/BrewDayTimelineBar.tsx`, `apps/web/src/components/designSystem.ts`, `apps/web/test/BrewDayTracker.test.tsx`, `apps/web/test/setup.ts`, anything under `apps/api/`, `packages/`, or `db/`, and `package.json` / `package-lock.json`.

**Bookkeeping (always permitted):** `.gsd/STATE.json`, `.gsd/archive/*`, `.gsd/active/*`.
