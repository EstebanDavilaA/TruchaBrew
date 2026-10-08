# Feature Specification: Milestone 29, Phase 2

**Milestone 29:** Product-Wide UI/UX Ergonomics, Accessibility & Information Architecture (`FEAT-020`)  
**Phase:** Phase 2 — Recipe & Catalog Information Architecture & Visual Hierarchy (`M29_P2`)  
**Status:** DRAFT (Awaiting `SPEC_APPROVED`)  
**Date:** 2026-08-22  

---

## 1. Overview & Intent

Phase 2 addresses `CRIT-02`, `CRIT-04`, `MAJ-01`, and `MAJ-02` from the UI/UX Specification (`UI_UX_SPECIFICATION.md`):

1. **`MAJ-01` — Page Header Standardization**: Standardize the top-level page heading in [`TopBar.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/TopBar.tsx) using `PAGE_TITLE_CLASS` (`text-xl md:text-2xl font-black text-white tracking-tight truncate`), ensuring all 11 application routes inherit consistent typographic scale and vertical rhythm without heading styling divergence.
2. **`CRIT-02` / `MAJ-02` — Recipe Library List Row Ergonomics & Accessibility**: Attach an explicit, unique `aria-label={`Duplicate "${r.name}"`}` to the duplicate button in [`RecipeLibrary.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/RecipeLibrary.tsx), style it with `BUTTON_ICON_CLASS`, and ensure metadata tags wrap cleanly on mobile viewports.
3. **`CRIT-04` — Recipe Editor Action & Save State Hierarchy**: Standardize action buttons in [`App.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/App.tsx) Recipe Editor TopBar (Delete using `BUTTON_DANGER_CLASS`, Scale Batch using `BUTTON_SECONDARY_CLASS`, Brew This using `BUTTON_PRIMARY_CLASS`, and SaveBar maintaining dirty tracking and save feedback).
4. **`MAJ-02` — Catalog Managers Standardized Tokens & Actions**: Standardize action buttons, retry buttons, and empty-state containers across [`EquipmentManager.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/EquipmentManager.tsx), [`MashProfileManager.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/MashProfileManager.tsx), [`FermentationProfileManager.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/FermentationProfileManager.tsx), [`WaterProfileManager.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/WaterProfileManager.tsx), and [`InventoryManager.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/InventoryManager.tsx) using design system tokens (`BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `BUTTON_DANGER_CLASS`, `EMPTY_STATE_CLASS`).

---

## 2. Symbol & Contract Inventory

### Modified Files
- `apps/web/src/components/TopBar.tsx` — Apply `PAGE_TITLE_CLASS` to the `<h1>` title element.
- `apps/web/src/components/RecipeLibrary.tsx` — Add `aria-label={`Duplicate "${r.name}"`}` and `BUTTON_ICON_CLASS` styling to the duplicate action button in list rows.
- `apps/web/src/App.tsx` — Apply `BUTTON_DANGER_CLASS`, `BUTTON_SECONDARY_CLASS`, and `BUTTON_PRIMARY_CLASS` to Recipe Editor TopBar action buttons.
- `apps/web/src/components/EquipmentManager.tsx` — Use `BUTTON_PRIMARY_CLASS` on the "New Profile" button.
- `apps/web/src/components/MashProfileManager.tsx` — Use `BUTTON_PRIMARY_CLASS` on the "New Profile" button.
- `apps/web/src/components/FermentationProfileManager.tsx` — Use `BUTTON_PRIMARY_CLASS` on the "New Profile" button.
- `apps/web/src/components/WaterProfileManager.tsx` — Use `BUTTON_PRIMARY_CLASS` on the "New Profile" button.
- `apps/web/test/TopBar.test.tsx` — Update test assertions to verify `PAGE_TITLE_CLASS` on the level-1 heading.
- `apps/web/test/RecipeLibrary.test.tsx` — Verify duplicate button accessible name.

### Untouched Files (Scope Guardrail)
All other files in `packages/shared-types/**`, `packages/calculations/**`, `apps/api/**`, `apps/web/src/context/**`, and `apps/web/src/utils/**` remain completely unmodified.

---

## 3. Stateful Integration & Data Flow

- **Page Titles**: `TopBar` receives `title?: string`. When provided, it renders `<h1 className={`${PAGE_TITLE_CLASS} truncate`}>{title}</h1>`. When omitted, no heading element of any level is rendered (contract from M5.5_P3 / AC-10 preserved).
- **List Row Actions**: In `RecipeLibrary.tsx`, clicking the duplicate button triggers `handleDuplicate(r.id)` with `e.stopPropagation()`. The button is disabled when `busyId === r.id` and carries `aria-label={`Duplicate "${r.name}"`}` and `title="Duplicate"`.
- **Recipe Editor Dirty Tracking**: In `App.tsx`, `useBlocker` intercepts route transitions when `editor.isDirty === true`, presenting `ConfirmDialog`. `SaveBar` reflects `editor.saveState` ('idle' | 'saving' | 'error') and `editor.isDirty`.

---

## 4. Binding Resolved Ambiguities

1. **TopBar Title Level & Class**: `TopBar` renders a semantic `<h1>` element when `title` is defined. The `<h1>` must include `${PAGE_TITLE_CLASS} truncate`.
2. **Backward Compatibility in TopBar**: When `title` is `undefined`, `TopBar` continues to render zero heading elements of any level (preserving AC-10 contract in `TopBar.test.tsx`).
3. **Duplicate Button Accessibility**: The duplicate button in `RecipeLibrary.tsx` must have an accessible name matching `/^Duplicate /` via `aria-label={`Duplicate "${r.name}"`}`.
4. **Scope Guardrail Execution**: Verified via pre/post-execution SHA-256 content manifests (`git ls-files -co --exclude-standard -z | xargs -0 sha256sum`).

---

## 5. Acceptance Criteria Matrix

| AC ID | Category | Requirement Description | Verification Method |
| :--- | :--- | :--- | :--- |
| **AC-1** | TopBar | `TopBar.tsx` renders `<h1 className={`${PAGE_TITLE_CLASS} truncate`}>{title}</h1>` when `title` is provided. | `TopBar.test.tsx` DOM inspection |
| **AC-2** | TopBar | When `title` is omitted, `TopBar.tsx` renders zero heading elements of any level and no `role="heading"` elements. | `TopBar.test.tsx` AC-10(b) assertion |
| **AC-3** | RecipeLibrary | Duplicate button on each recipe list row carries `aria-label={`Duplicate "${r.name}"`}`. | `RecipeLibrary.test.tsx` / DOM query |
| **AC-4** | RecipeLibrary | Duplicate button on recipe list row carries `title="Duplicate"` and `disabled={busyId === r.id}`. | `RecipeLibrary.test.tsx` / DOM query |
| **AC-5** | RecipeEditor | Delete button in Recipe Editor TopBar uses `BUTTON_DANGER_CLASS` styling and retains `data-testid="recipe-delete"`. | `App.test.tsx` / DOM query |
| **AC-6** | RecipeEditor | Scale Batch button in Recipe Editor TopBar uses `BUTTON_SECONDARY_CLASS` styling. | `App.test.tsx` / DOM query |
| **AC-7** | RecipeEditor | Brew This button in Recipe Editor TopBar uses `BUTTON_PRIMARY_CLASS` styling. | `App.test.tsx` / DOM query |
| **AC-8** | Managers | "New Profile" button in `EquipmentManager.tsx` uses `BUTTON_PRIMARY_CLASS` styling and retains `data-testid="equipment-new-profile"`. | `EquipmentManager.test.tsx` |
| **AC-9** | Managers | "New Profile" button in `MashProfileManager.tsx` uses `BUTTON_PRIMARY_CLASS` styling and retains `data-testid="mash-new-profile"`. | `MashProfileManager.test.tsx` |
| **AC-10** | Managers | "New Profile" button in `FermentationProfileManager.tsx` uses `BUTTON_PRIMARY_CLASS` styling and retains `data-testid="fermentation-new-profile"`. | `FermentationProfileManager.test.tsx` |
| **AC-11** | Managers | "New Profile" button in `WaterProfileManager.tsx` uses `BUTTON_PRIMARY_CLASS` styling and retains `data-testid="water-new-profile"`. | `WaterProfileManager.test.tsx` |
| **AC-12** | Layer 1 | All automated test suites (1,942+ tests across all workspaces), typecheck, build, and lint pass with exit code 0. | `npm test && npm run typecheck && npm run build && npm run lint` |
| **AC-13** | Scope | Pre/post-execution SHA-256 manifest confirms only the authorized files modified. | `sha256sum` manifest comparison |

---

## 6. Execution Instructions & Next Steps

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution of **Milestone 29 Phase 2**.
