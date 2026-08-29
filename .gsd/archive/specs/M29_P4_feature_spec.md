# Feature Specification: Milestone 29, Phase 4 (Batch Detail & Active Brew Day Ergonomics)

**Milestone 29:** Product-Wide UI/UX Ergonomics, Accessibility & Information Architecture (`FEAT-020`)  
**Phase:** Phase 4 — Batch Detail & Active Brew Day Ergonomics (`M29_P4`)  
**Status:** DRAFT (Awaiting `SPEC_APPROVED`)  
**Date:** 2026-08-22  

---

## 1. Overview & Intent

Phase 4 of Milestone 29 optimizes the core brew day operator experience across batch lifecycle tracking, active brewing workflow, and identity editing:

1. **Horizontal Lifecycle Stage Stepper (`BatchStageTabs.tsx`) — `MAJ-03`**:
   - Upgrade the tab bar into a modern horizontal stepper with numbered stage indicators (`1` Planning, `2` Brewing, `3` Fermenting, `4` Packaging, `5` Completed).
   - Display active stage with glowing amber/emerald accent, completed stages with check indicators or distinct styling, and future stages with subtle neutral styling.
   - Maintain full keyboard navigation, accessible roles, and test compatibility.

2. **12-Column Responsive Active Brew Day Workbench (`BatchDetail.tsx`) — `MAJ-01`**:
   - Restructure `activeTab === 'brewing'` from a vertical stack into an ergonomic 12-column responsive layout on desktop viewports (`lg:grid lg:grid-cols-12 gap-6`):
     - **Main Focus Column (`lg:col-span-7 xl:col-span-8`)**: Houses `BrewDayTracker.tsx` (real-time countdown timer, segmented stage progress bar, and stage checklist) and `BrewSheet.tsx`.
     - **Side Workbench Column (`lg:col-span-5 xl:col-span-4`)**: Houses Live Efficiency & Brewhouse Summary metrics alongside the Brew Day Measurements quick entry card (`measuredPreBoilGravity`, `measuredMashPh`, `measuredBoilSizeL`, `measuredBoilTimeMin`, `measuredOg`).
     - **Full-Width Bottom Span**: Houses `BatchNoteLog.tsx` for timestamped brew day logs.

3. **Unified Identity Header Editing (`BatchDetail.tsx`) — `CRIT-02`**:
   - Eliminate deceptive "Done" button pseudo-saves in the batch identity editor.
   - Batch name, batch number, brewer, and brew date edit directly into staged `formData`, clearly signaling to the brewer that persisting requires the TopBar "Save Changes" action (or keyboard shortcut / save button).
   - Provide clean edit trigger and cancel affordance without misleading local "Done" confirmation.

4. **Descriptive Brew Sheet Toggle (`BrewSheet.tsx`) — `MAJ-02`**:
   - Replace ambiguous toggle labels `'ON'` / `'OFF'` with clear, accessible copy: `'View Brew Sheet'` when collapsed and `'Hide Brew Sheet'` when expanded.
   - Add explicit `aria-expanded` attribute on the toggle trigger.

---

## 2. Acceptance Criteria Matrix

| AC ID | Area | Requirement Description | Verification |
|---|---|---|---|
| **AC-1** | Stage Stepper | `BatchStageTabs.tsx` renders numbered lifecycle stage indicators (1 to 5) with responsive connector styling and visual cues for active and completed stages. | `BatchStageTabs.test.tsx` / `BatchDetail.test.tsx` |
| **AC-2** | Stepper Accessibility | Each stage step in `BatchStageTabs.tsx` maintains accessible tab/button semantics (`role="tab"`, `aria-selected`, `aria-current`, keyboard focus). | `BatchStageTabs.test.tsx` |
| **AC-3** | 12-Column Brewing Layout | `BatchDetail.tsx` brewing tab renders a 12-column responsive layout on `lg` screens with `BrewDayTracker` in the primary column and measurements/stats in the secondary workbench column. | `BatchDetail.test.tsx` |
| **AC-4** | Identity Header Edit | Batch identity fields in `BatchDetail.tsx` edit in-place and bind to `formData` without rendering a deceptive "Done" pseudo-save button; persists cleanly via TopBar Save. | `BatchDetail.test.tsx` |
| **AC-5** | BrewSheet Toggle Copy | `BrewSheet.tsx` toggle button displays `'View Brew Sheet'` when closed and `'Hide Brew Sheet'` when open, and carries `aria-expanded` reflecting open state. | `BrewSheet.test.tsx` |
| **AC-6** | Status Progression Banner | Advancing batch status via `Change Status to <Stage>` remains clearly accessible and updates batch status via API. | `BatchDetail.test.tsx` |
| **AC-7** | Layer 1 Four Gates | All automated test suites, typecheck across all 4 workspaces, production build, and lint pass with exit code 0. | `npm test && npm run typecheck && npm run build && npm run lint` |
| **AC-8** | Scope Guardrail | Changes strictly confined to frontend batch components (`BatchStageTabs.tsx`, `BatchDetail.tsx`, `BrewSheet.tsx`, and their tests). | SHA-256 manifest diff |

---

## 3. Execution Instructions & Next Steps

Review this specification. Reply with **`SPEC_APPROVED`** to begin execution of Milestone 29 Phase 4.
