# Milestone 44 / Wave unsaved-guard

**Date:** 2026-10-09 · **Status:** REVIEWED stage 1 — all gates green; checkpoint presented
**Branch:** `wave/M44-unsaved-guard` (created at approval)

> Coordination only. What each phase delivers is in its spec; nothing here restates it.

## Lanes

| Stage | Phase | Spec | Approval | Status |
|---|---|---|---|---|
| 1 | P1 | `.codestream/active/M44_P1_unsaved_editor_guard.md` | approved | merged; independently reviewed (VERIFIED) |
| 1 | P2 | `.codestream/active/M44_P2_unsaved_modal_guard.md` | approved | merged; independently reviewed (VERIFIED) |

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

2026-10-09: Resolved BUG-044 line-drift in apps/web/test/controlTargetSize.test.ts; all five project gates independently verified green (test 2,932 passed / 2 skipped across 146 files, exit 0; typecheck 4/4 clean, exit 0; build clean, exit 0; lint 0 errors, 18 baseline warnings, exit 0; smoke clean, exit 0). Independent reviews completed: P1 reviewer verified 3/3 outcomes; P2 reviewer verified 3/3 outcomes; integration review verified dialog accessibility and focus safety. Reached steering checkpoint.

2026-10-09: Recovered the missed runner handoff after the user reported both execution sessions had completed. P1 session `copilotcli:/bcda164d-9941-44ac-87b5-0fc7665ab1e7` returned commit `a00b8f2` on `wave/M44-unsaved-guard-P1`; P2 session `copilotcli:/d457a1c0-edc3-47e9-978a-4b28c570b3ec` returned commit `5800efb` on `wave/M44-unsaved-guard-P2`. Both are based on `4caf8b3`, have clean lane worktrees, and touch only their owned paths. Worktrees remain in the sibling `TruchaBrew.worktrees/` directory under `wavem44-execute-phase-p1-lane` and `wavem44-execute-phase-p2-lane`.

2026-10-09: Fast-forwarded P1 into the wave branch; `npm test --workspace=@truchabrew/web -- test/App.test.tsx test/BatchDetail.test.tsx` exited 0 (153 passed). Merged P2 with merge commit `0bb2273`, without conflicts. Git ancestry checks for both reported lane commits exited 0. No merge into `master` and no project push.

2026-10-09: Combined page/form integration tests plus `test/controlTargetSize.test.ts` exited 1 (280 passed, 1 failed). Full `npm test` exited 1, reproducing the same source-line allowlist mismatch (web: 1,621 passed, 1 failed; calculations: 696 passed, 2 skipped). The root packaging suite was not reached because the workspace test command failed. Repository typecheck, build, lint, and smoke each exited 0; lint emitted warnings. Integration remains blocked by BUG-044; no `/steer` reviewers or checkpoint have run.

2026-10-09: Lane-reported dependency installation advisories: 15 total (4 critical, 4 high, 7 moderate), not independently triaged. P1 reported every gate passing after its fixes; P2 reported focused tests/typecheck/build/lint/smoke passing and the full-test guardrail failure. Completion is recorded separately from merged verification.

2026-10-09: User approved the wave; both stage-1 lanes are approved and starting in parallel.

2026-10-08: Wave planning opened. Existing M44_P1 draft joins this wave; P2 is planned against the roadmap's second phase. Both planners found non-overlapping ownership; stages remain parallel.
