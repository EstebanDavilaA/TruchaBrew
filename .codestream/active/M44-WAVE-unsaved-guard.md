# Milestone 44 / Wave unsaved-guard

**Date:** 2026-10-09 · **Status:** BUILDING stage 1
**Branch:** `wave/M44-unsaved-guard` (created at approval)

> Coordination only. What each phase delivers is in its spec; nothing here restates it.

## Lanes

| Stage | Phase | Spec | Approval | Status |
|---|---|---|---|---|
| 1 | P1 | `.codestream/active/M44_P1_unsaved_editor_guard.md` | approved | building |
| 1 | P2 | `.codestream/active/M44_P2_unsaved_modal_guard.md` | approved | building |

## Ownership

Each lane edits only the files it owns. A file no lane owns is out of bounds for every lane.

| Phase | Owns (rewrites) | May only add to (shared) |
|---|---|---|
| P1 | `apps/web/src/App.tsx`, `apps/web/src/pages/BatchDetail.tsx`, `apps/web/test/App.test.tsx`, `apps/web/test/BatchDetail.test.tsx` | none |
| P2 | `apps/web/src/components/InventoryForm.tsx`, `EquipmentForm.tsx`, `MashProfileForm.tsx`, `FermentationProfileForm.tsx`, `WaterProfileForm.tsx` and their corresponding tests | none |

## Why this staging

Both lanes cover distinct exit controls and source/test files: P1 owns recipe and batch page navigation plus browser unload; P2 owns Back/Cancel within inventory and profile forms only. Neither depends on the other's output, so they run in parallel.

## Approval

`WAVE_APPROVED` received 2026-10-09; P1 and P2 are approved.

User decisions recorded: P2 covers form Back/Cancel only, not app-wide navigation or browser reload/close. `BUG-026`–`BUG-039` responsive/layout triage is removed from M44 and remains for separate future triage. Both phases are approved and dependency-ready. Only explicitly approved, dependency-ready phases may run; the wave remains open until every listed phase is merged or explicitly removed by the user.

## Runner's log

2026-10-09: User approved the wave; both stage-1 lanes are approved and starting in parallel.

2026-10-08: Wave planning opened. Existing M44_P1 draft joins this wave; P2 is planned against the roadmap's second phase. Both planners found non-overlapping ownership; stages remain parallel.
