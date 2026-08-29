# FEATURE SPECIFICATION: M33_P4 — BrewDayTracker.tsx, Alone: Live Timer State & Button Hardening

> **Milestone 33:** "Brew day stops improvising its buttons" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 4 of 5.** Migrates all action and chrome buttons in `BrewDayTracker.tsx` onto `<Button>` (`primary`, `secondary`, and `icon` variants), retires hand-rolled button classes, and preserves all M15/M18 live countdown timer, audio alert, and checklist state machines without regression.

---

## Phase Summary

In Milestone 33 Phases 1, 2, and 3, we migrated `StockCheckPanel.tsx`, `ReadingLog.tsx`, and `BatchNoteLog.tsx` onto `<Button>`.
In Milestone 33 Phase 4, we migrate the timer controls and chrome buttons in `BrewDayTracker.tsx` while rigorously protecting live timer state, wall-clock target calculations, audio alerts, and checklist interactions.

In Milestone 33 Phase 4, we accomplish:
1. **`BrewDayTracker.tsx` Button Migration:**
   - **Header Icon Buttons:**
     - Mute Toggle (T-1): `<Button variant="icon" type="button" onClick={() => setMuted((m) => !m)} data-testid="brew-day-mute-toggle" aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}>{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</Button>`.
     - Global Reset (T-2): `<Button variant="icon" type="button" onClick={handleGlobalReset} data-testid="brew-day-global-reset-btn" aria-label="Reset entire brew day tracker" title="Reset entire brew day tracker" className="hover:text-rose-300"><Power className="w-4 h-4" /></Button>`.
   - **Main Stepper & Timer Action Buttons:**
     - Strike Water Ready (T-3, Prep stage): `<Button variant="primary" size="sm" type="button" onClick={handleSkip} data-testid="brew-day-skip-btn"><CheckCircle2 className="w-3.5 h-3.5" /> Strike Water Ready</Button>`.
     - Previous Step (T-4): `<Button variant="secondary" size="sm" type="button" onClick={handlePreviousStep} data-testid="brew-day-previous-btn"><SkipBack className="w-3.5 h-3.5" /> Previous Step</Button>`.
     - Play (T-5): `<Button variant="primary" size="sm" type="button" onClick={handlePlay} data-testid="brew-day-play-btn"><Play className="w-3.5 h-3.5" /> Play</Button>`.
     - Pause (T-6): `<Button variant="secondary" size="sm" type="button" onClick={handlePause} data-testid="brew-day-pause-btn"><Pause className="w-3.5 h-3.5" /> Pause</Button>`.
     - Fast-Forward (T-7): `<Button variant="secondary" size="sm" type="button" onClick={handleFastForward} data-testid="brew-day-fastforward-btn"><FastForward className="w-3.5 h-3.5" /> Fast-Forward</Button>`.
     - Adjust Time (T-8): `<Button variant="secondary" size="sm" type="button" onClick={handleAdjustTimeToggle} data-testid="brew-day-adjusttime-btn"><Pencil className="w-3.5 h-3.5" /> Adjust Time</Button>`.
     - Reset (T-9): `<Button variant="secondary" size="sm" type="button" onClick={handleReset} data-testid="brew-day-reset-btn"><RotateCcw className="w-3.5 h-3.5" /> Reset</Button>`.
     - Skip (T-10): `<Button variant="secondary" size="sm" type="button" onClick={handleSkip} data-testid="brew-day-skip-btn"><SkipForward className="w-3.5 h-3.5" /> Skip</Button>`.
     - Adjust Time Commit "Set" (T-11): `<Button variant="primary" size="sm" type="button" onClick={handleAdjustTimeCommit} data-testid="brew-day-adjusttime-commit-btn">Set</Button>`, retiring `${BUTTON_PRIMARY_CLASS} text-xs !px-3 !py-1.5`.
   - Specialized interactive rows (checklist item buttons, mash step selectors, boil addition toggle buttons) remain intact with their dedicated full-width item layout.
2. **Timer State & Audio Alert Preservation:**
   - All countdown timing based on `Date.now()` wall-clock end targets, interval repainting, completion alarms, boil hop warnings, and audio alerts (`playStepAlert`) pass 100% cleanly.
3. **Tests & Static Adoption Sweeps:**
   - All 19 existing tests in `apps/web/test/BrewDayTracker.test.tsx` pass cleanly.
   - Extend `uiPrimitives.test.tsx` with unit assertions verifying `BrewDayTracker.tsx` button migrations.

---

## Key Behaviors

1. `apps/web/src/components/BrewDayTracker.tsx`:
   - Imports `Button` from `./ui`.
   - Retires manual button class strings:
     - `${BUTTON_SECONDARY_CLASS} text-xs flex items-center gap-1.5` -> `<Button variant="secondary" size="sm">`
     - `${BUTTON_PRIMARY_CLASS} text-xs flex items-center gap-1.5` -> `<Button variant="primary" size="sm">`
     - `bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5...` -> `<Button variant="secondary" size="sm">`
     - `${BUTTON_PRIMARY_CLASS} text-xs !px-3 !py-1.5` -> `<Button variant="primary" size="sm">`
     - `text-slate-400 hover:text-slate-200 p-1.5 cursor-pointer` -> `<Button variant="icon">`
     - `text-slate-400 hover:text-rose-300 p-1.5 cursor-pointer` -> `<Button variant="icon">`
   - Retains all `data-testid`, `onClick`, `aria-label`, and icon child elements.

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added or modified.

**RA-2 — `Button.tsx` Remains Read-Only / Settled.**
`Button.tsx` API was hardened in M33_P1 and is read-only in this phase.

**RA-3 — Specialized List Item Buttons vs Standard Action Buttons.**
Checklist items (`checklist-item-${item.id}`), mash step selectors (`mash-step-${idx}`), and boil additions (`brew-day-boil-alarm-${alarm.id}`) are complex multi-column list items with bespoke border/pulse/line-through semantics; standardizing them onto list row components is owned by Milestone 35. This phase focuses on all 11 action and chrome buttons (T-1 through T-11).

**RA-4 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 33 Phase 4 migrates BrewDayTracker timer and chrome buttons onto `<Button>`. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Unified button typography, heights, and icon alignments. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/BrewDayTracker.tsx` | **MODIFY** | Migrate all 11 timer and chrome button sites onto `<Button>`. |
| `apps/web/test/BrewDayTracker.test.tsx` | **MODIFY** | Verify all 19 tests pass cleanly and add button component assertions. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add component assertions for BrewDayTracker button migration. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `designSystem.ts` and `Button.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. 28 exports unchanged. |
| **AC-2** | Mute toggle button (T-1) renders via `<Button variant="icon">` | Component Test | Button has test ID `brew-day-mute-toggle` and toggles muted state. |
| **AC-3** | Global reset button (T-2) renders via `<Button variant="icon">` | Component Test | Button has test ID `brew-day-global-reset-btn` and resets tracker state. |
| **AC-4** | Strike Water Ready button (T-3) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `brew-day-skip-btn` in prep stage and advances stage. |
| **AC-5** | Previous Step button (T-4) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `brew-day-previous-btn` and navigates to previous stage. |
| **AC-6** | Play button (T-5) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `brew-day-play-btn` and starts countdown timer. |
| **AC-7** | Pause button (T-6) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `brew-day-pause-btn` and pauses timer countdown. |
| **AC-8** | Fast-Forward button (T-7) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `brew-day-fastforward-btn` and compresses timer. |
| **AC-9** | Adjust Time button (T-8) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `brew-day-adjusttime-btn` and toggles adjust panel. |
| **AC-10** | Reset button (T-9) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `brew-day-reset-btn` and restores nominal duration. |
| **AC-11** | Skip button (T-10) renders via `<Button variant="secondary" size="sm">` | Component Test | Button has test ID `brew-day-skip-btn` and advances to next stage. |
| **AC-12** | Adjust Time Set button (T-11) renders via `<Button variant="primary" size="sm">` | Component Test | Button has test ID `brew-day-adjusttime-commit-btn` and sets custom duration. |
| **AC-13** | All 19 existing `BrewDayTracker.test.tsx` tests pass unmodified | Existing Tests | All timer, audio alert, alarm, checklist, lockstep, and equipment tests pass 100%. |
| **AC-14** | Control plane height alignment: small primary and secondary buttons evaluate to ~32px height band | Rendered Test | Timer action buttons share `text-xs px-3 py-1.5 font-semibold`. |
| **AC-15** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Exactly 3 authorized files modified, 0 created, 0 deleted. |
| **AC-16** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,198 passed across 121 files). |
| **AC-17** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-18** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-19** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-20** | Manual verification screenshot (best-effort) | Verification | `M33_P4_brew_day_tracker_buttons.png` saved to `.gsd/active/manual_verification/` if browser automation available. |
| **AC-21** | Audio alert synthesis and mute state flow uninterrupted | Integration Test | `playStepAlert` calls for warning, chime, completion continue to trigger properly. |
| **AC-22** | Wall-clock target end calculation survives interval throttling | Integration Test | Remaining time derived from Date.now() vs targetEndByKey remains accurate. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (3 files)
1. `apps/web/src/components/BrewDayTracker.tsx`
2. `apps/web/test/BrewDayTracker.test.tsx`
3. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/ui/Button.tsx` and `ui/index.ts`.
- `pages/BatchDetail.tsx`.
- `packages/**`, `apps/api/**`.

---

## 4. Layer 1 Command Gates

```bash
npm test
npm run typecheck
npm run build
npm run lint
```
All four gates must exit 0 cleanly before `/execute` halts for `/steer`.

---

## 5. Manual Verification Evidence

Save to `.gsd/active/manual_verification/`:
- **`M33_P4_brew_day_tracker_buttons.png`**: Screenshot of `BrewDayTracker` component showing migrated `<Button>` components (Play, Pause, Fast-Forward, Adjust Time, Reset, Skip, and header icon buttons) with standardized ~32px compact heights, icon button targets, and `gap-1.5` layout.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
