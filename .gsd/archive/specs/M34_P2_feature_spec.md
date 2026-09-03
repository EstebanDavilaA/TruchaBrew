# FEATURE SPECIFICATION: M34_P2 — The Import and Calibration Dialogs: RecipeImportModal, PostBrewCalibrationModal, BatchRecipeAdjustModal, and the App.tsx Scale Modal

> **Milestone 34:** "Every dialog and panel is built from the same parts" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 2 of 5.** Migrates the form contents of the four import-and-calibration dialogs (`RecipeImportModal.tsx`, `PostBrewCalibrationModal.tsx`, `BatchRecipeAdjustModal.tsx`, and `App.tsx`'s inline scale modal) onto `components/ui/` primitives (`<Button>`, `<Input>`, `<Select>`, `<NumberInput>`), continuing the content-migration pattern established in M34_P1 that preserves the M25 `<Modal>` focus-trapping, Escape-dismissal, and focus-restoration guarantees unmodified.

---

## Phase Summary

Milestone 34 Phase 1 established the content-migration pattern on the three simplest dialogs. Phase 2 extends it to the four dialogs that handle *import* and *calibration* — the surfaces where a brewer's data is at stake and the controls carry the most meaning:

1. **`RecipeImportModal.tsx` Content Migration:**
   - **Close Button (RI-1):** Migrates to `<Button variant="icon" type="button" onClick={onClose} aria-label="Close" title="Close"><X className="w-5 h-5" /></Button>`.
   - **Equipment Profile `<select>` (RI-2):** Migrates to `<Select size="sm" aria-label="Target Equipment Profile" value={targetEquipmentId} onChange={(e) => setTargetEquipmentId(e.target.value)} data-testid="recipe-import-equipment-select">{equipmentProfiles.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.batchSizeL} L)</option>)}</Select>`.
   - **Toggle-All Button (RI-3):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={handleToggleAll} className="!px-3 !py-1.5 text-xs underline">{selectedIndices.size === parsedRecipes.length ? 'Deselect All' : 'Select All'}</Button>` — the text-link styling (`text-amber-400 hover:text-amber-300 font-semibold underline`) is preserved by appending `text-amber-400 hover:text-amber-300 font-semibold underline` classes.
   - **Cancel Button (RI-4):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>`.
   - **Import Selected Button (RI-5):** Migrates to `<Button variant="primary" size="sm" type="button" data-testid="confirm-import-btn" disabled={selectedIndices.size === 0 || isSubmitting} onClick={handleImport} className="flex items-center gap-2">{isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}<span>Import Selected ({selectedIndices.size})</span></Button>`.
   - **Checkbox/radio form controls (RI-6):** The per-recipe select checkboxes (`w-4 h-4 accent-amber-500 cursor-pointer rounded`), the duplicate-strategy radio inputs, and the header/queue styling remain **unchanged** — these are native form inputs, not `components/ui/` primitives, and the milestone's adoption assertion (raw `<input>`/`<select>` sweep) is scoped to `components/ui/`-representable controls only. See **RA-4**.
2. **`PostBrewCalibrationModal.tsx` Content Migration:**
   - **Close Button (PB-1):** Migrates to `<Button variant="icon" type="button" data-testid="close-calibration-modal-btn" onClick={onClose} aria-label="Close calibration modal" title="Close"><X className="w-5 h-5" /></Button>`.
   - **Update Recipe Target Button (PB-2):** Migrates to `<Button variant="secondary" size="sm" type="button" data-testid="calibrate-recipe-btn" disabled={recBusy || !evaluation.canCalibrate} onClick={handleApplyRecipeCalibration} className="text-xs flex items-center gap-1.5">…</Button>` preserving the existing `recSuccess`/`recBusy` conditional label content.
   - **Update Equipment Profile Button (PB-3):** Migrates to `<Button variant="primary" size="sm" type="button" data-testid="calibrate-equipment-btn" disabled={eqBusy || !equipmentProfile || !evaluation.canCalibrate} onClick={handleApplyEquipmentCalibration} className="text-xs flex items-center gap-1.5">…</Button>` preserving the existing `eqSuccess`/`eqBusy` conditional label content.
   - The comparison `<table>` (M17_P1) and the `SUBPANEL_CLASS` wrapper remain **unchanged** — the table is not a form control.
3. **`BatchRecipeAdjustModal.tsx` Content Migration:**
   - **Close Button (BA-1):** Migrates to `<Button variant="icon" type="button" data-testid="batch-recipe-adjust-close-btn" onClick={onClose} disabled={saving} aria-label="Close" title="Close"><X className="w-5 h-5" /></Button>`.
   - **Cancel Button (BA-2):** Migrates to `<Button variant="secondary" size="sm" type="button" data-testid="batch-recipe-adjust-cancel-btn" onClick={onClose} disabled={saving}>Cancel</Button>`.
   - **Save Adjustments Button (BA-3):** Migrates to `<Button variant="primary" size="sm" type="button" data-testid="batch-recipe-adjust-save-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save Adjustments</Button>`.
   - **Sync-to-master checkbox (BA-4):** The native `<input type="checkbox">` remains **unchanged** — not a `components/ui/` primitive (see **RA-4**).
4. **`App.tsx` Inline Scale Modal Content Migration:**
   - **Cancel Button (AS-1):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={() => setShowScaleModal(false)} disabled={scaleBusy}>Cancel</Button>`.
   - **Scale Recipe Button (AS-2):** Migrates to `<Button variant="primary" size="sm" type="button" onClick={handleScaleRecipe} disabled={scaleBusy}>{scaleBusy ? 'Scaling…' : 'Scale Recipe'}</Button>`.
   - **Target Batch Size `<NumberInput>` (AS-3):** The existing `<NumberInput>` stays as-is (it already uses `components/ui/`), but any raw class-string remnants around it (`text-slate-400` literals, etc.) are normalized onto the primitive's `addonRight="Liters"` where applicable, and the raw `Cancel`/`Scale Recipe` buttons above are migrated.
5. **`designTokens.test.ts` AC-13 Row Conversions (adoption assertions):**
   - The AC-13 `CASES` array currently contains rows for `PostBrewCalibrationModal.tsx` (tokens `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`) and `RecipeImportModal.tsx` (tokens `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `FORM_SELECT_COMPACT_CLASS`). After this phase removes those token imports, the rows **cannot** keep asserting token imports — convert them to **adoption assertions** ("does this file render `<Button>` / `<Select>`?") following the M33_P1/M33_P2 precedent, while deleting the token-import rows for these two files. The `ReadingLog.tsx` row (still importing `INPUT_COMPACT_CLASS`) and the `BatchDetail.tsx` row (still importing `INPUT_CLASS`) remain **untouched**.
6. **M25 Modal Shell Invariants:**
   - The outer `<Modal>` wrappers, backdrop blur, `maxWidthClass`, `role="dialog"` / `role="alertdialog"`, and focus-trapping mechanisms remain 100% untouched and functional.
7. **Tests & Static Adoption Sweeps:**
   - All tests in `RecipeImportModal.test.tsx`, `PostBrewCalibrationModal.test.tsx`, `BatchRecipeAdjustModal.test.tsx`, `App.test.tsx`, and `Modal.test.tsx` pass cleanly.
   - `uiPrimitives.test.tsx` extended with a static sweep asserting zero raw `<button className=...>`, zero raw `<input className=...>`/`<NumberInput className=...>` (excluding the explicitly-exempt native checkbox/radio inputs per **RA-4**), and zero raw `<select>` in the migrated set (the four dialog surfaces).

---

## Key Behaviors

1. `apps/web/src/components/RecipeImportModal.tsx`:
   - Imports `Button` and `Select` from `./ui`.
   - Replaces the raw header close, toggle-all, footer Cancel and footer Import buttons with `<Button>`.
   - Replaces the raw equipment `<select>` with `<Select size="sm">`.
   - Keeps native checkboxes/radios unchanged (RA-4).
   - Removes the now-unused `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `FORM_SELECT_COMPACT_CLASS` imports.
2. `apps/web/src/components/PostBrewCalibrationModal.tsx`:
   - Imports `Button` from `./ui`.
   - Replaces the raw close, recipe-calibration, and equipment-calibration buttons with `<Button>`.
   - Keeps the comparison table and `SUBPANEL_CLASS` wrapper unchanged.
   - Removes the now-unused `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS` imports (keeps `SUBPANEL_CLASS`).
3. `apps/web/src/components/BatchRecipeAdjustModal.tsx`:
   - Imports `Button` from `./ui`.
   - Replaces the raw header close, footer Cancel and footer Save buttons with `<Button>`.
   - Keeps the sync-to-master native checkbox unchanged (RA-4).
   - Removes the now-unused `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS` imports (keeps the other designSystem tokens it uses: `METRIC_TILE_CLASS`, `METRIC_LABEL_CLASS`, `METRIC_VALUE_CLASS`, `MONO_VALUE_CLASS`, `SUBPANEL_CLASS`).
4. `apps/web/src/App.tsx`:
   - Imports `Button` from `./components/ui` (alongside the existing `NumberInput` import).
   - Replaces the raw Cancel and Scale Recipe buttons in the inline scale modal with `<Button>`.
   - The scale modal's `<NumberInput>` remains a `components/ui/` primitive; normalizes the "Liters" unit suffix onto `addonRight="Liters"` and drops the adjacent raw `<span className="text-sm text-slate-400">Liters</span>`.
   - All other raw buttons in `App.tsx` (the "Go to Equipment Profiles" empty-state button at ~line 408, the TopBar "Back to library", "Delete", "Scale Batch", "Brew This" buttons at ~lines 591–622) remain **unchanged** — they are not part of the scale modal and are explicitly out of scope for this phase (see **RA-5**).

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added, modified, or deleted.

**RA-2 — `Modal.tsx` Shell Remains Read-Only.**
`Modal.tsx` is the container shell hardened in M25 and remains read-only; this phase migrates only dialog content children.

**RA-3 — Button `size="sm"` Uses Compact Styling with Overrides.**
All migrated action buttons use `size="sm"` (which resolves to `text-xs px-3 py-1.5`). Where the existing dialog used `text-xs py-2 px-4`/`py-2 px-5` (RecipeImportModal footer buttons) or `text-xs` alone (PostBrewCalibrationModal, BatchRecipeAdjustModal), the `size="sm"` compact height is the binding target, and any needed density is applied via explicit `className` (e.g. `px-4`/`px-5` padding overrides). The unified `~32px` control-height band from M33 is preserved.

**RA-4 — Native Checkbox/Radio/Form Inputs Are Explicitly Exempt From the Adoption Sweep.**
The per-recipe select checkboxes, the duplicate-strategy radio inputs, and the sync-to-master checkbox in the migrated dialogs are native `<input>` elements that `components/ui/` does not (and per Milestone 34's roadmap should not) abstract — `ui/` exports `Button`, `Input`, `NumberInput`, `Select`, `FormField` only. The static adoption sweep therefore targets raw `<button>`, raw `<select>`, and raw **text/number** `<input>` elements, and explicitly excludes `type="checkbox"` and `type="radio"` inputs. This is a binding scoping decision: the milestone's verification threshold ("zero raw `<input>`/`<select>`/`<textarea>`/`<button className>`") is understood as "zero raw controls representable by `components/ui/` primitives."

**RA-5 — `App.tsx` Scope Is the Scale Modal Only.**
`App.tsx` contains 7 raw `<button>` elements; only the two inside the inline scale modal (lines ~838 and ~845) are migrated this phase. The empty-state "Go to Equipment Profiles" button and the three TopBar buttons (Back to library, Delete, Scale Batch, Brew This) are **not** in scope — they are not part of a dialog and Milestone 34's roadmap explicitly scopes the "remaining panel surfaces" (RecipeLibrary, InventoryManager, Calculators, etc.) to later phases (M34_P4/P5). The adoption sweep for `App.tsx` must therefore assert only that the **scale modal's** buttons render through `<Button>` (via test IDs / source-scoped matching), not that the whole file is free of raw buttons.

**RA-6 — `designTokens.test.ts` AC-13 Row Conversion Is the Only Change to That File.**
The `AC-13: the 7 §1.3 drift files import their mapped token(s) from designSystem` `CASES` array loses exactly two rows (`PostBrewCalibrationModal.tsx` and `RecipeImportModal.tsx`) and gains zero new token-import rows. The `ReadingLog.tsx` and `BatchDetail.tsx` rows remain. Adoption assertions for the two converted dialogs live in `uiPrimitives.test.tsx` (not in `designTokens.test.ts`), matching the M33_P1/P2 precedent.

**RA-7 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file. The AC matrix's scope-guardrail criterion uses this pre/post manifest diff (see the note on `git diff --name-only` viability in `plan_spec` — this repo's history is sparse for the current work, so a content-manifest diff is the binding mechanism).

**RA-8 — AC-13/AC-14/AC-15 Literal Sweeps in `designTokens.test.ts` Remain Green.**
The `AC-14`/`AC-15` deleted-literal sweeps (old `rounded-xl` primary/secondary button strings for RecipeImportModal) and the `AC-6: zero red-*` and `AC-7: form-control backgrounds` sweeps in `RecipeImportModal.test.tsx` must remain satisfied after migration — the new `<Button>`/`<Select>` render the app-standard palette, so no removed literal may reappear and no `bg-red-`/`text-red-` may be introduced.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_PLANNING` | Milestone 34 Phase 2 migrates the four import-and-calibration dialog surfaces onto `components/ui/`. |
| **FEAT-005** — App-Wide UI/UX Redesign | `IN_PLANNING` | Unified dialog form controls and button styling continue. |

---

## 1. Data Schema & Contracts

- **Exported Constants & Types:** No new exported constants or types. `designSystem.ts` stays at exactly 28 exports (RA-1).
- **Symbol Inventory:**
  - **Modified:**
    - `apps/web/src/components/RecipeImportModal.tsx` — replaces `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `FORM_SELECT_COMPACT_CLASS` imports with `Button`/`Select` from `./ui`.
    - `apps/web/src/components/PostBrewCalibrationModal.tsx` — replaces `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS` imports with `Button` from `./ui` (keeps `SUBPANEL_CLASS`).
    - `apps/web/src/components/BatchRecipeAdjustModal.tsx` — replaces `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS` imports with `Button` from `./ui` (keeps `METRIC_TILE_CLASS`, `METRIC_LABEL_CLASS`, `METRIC_VALUE_CLASS`, `MONO_VALUE_CLASS`, `SUBPANEL_CLASS`).
    - `apps/web/src/App.tsx` — adds `Button` to the existing `import { NumberInput } from './components/ui'`.
    - `apps/web/test/uiPrimitives.test.tsx` — adds the M34_P2 adoption-sweep block.
    - `apps/web/test/designTokens.test.ts` — removes the two AC-13 token-import rows for PostBrewCalibrationModal/RecipeImportModal.
    - `apps/web/test/RecipeImportModal.test.tsx`, `apps/web/test/PostBrewCalibrationModal.test.tsx`, `apps/web/test/BatchRecipeAdjustModal.test.tsx`, `apps/web/test/App.test.tsx` — verify existing tests pass cleanly (and any source-level `SOURCE` assertions that reference removed token imports are reconciled).
  - **Untouched:** `designSystem.ts`, `Modal.tsx`, `components/ui/*` (all five primitives), `packages/**`, `apps/api/**`, and every other dialog/panel file.
- **Pure Logic vs Stateful Integration:** No pure-logic changes. All four surfaces are stateful render integrations; the migration is strictly a presentational-layer swap of raw elements for `components/ui/` primitives with identical props/behavior.

---

## 2. Transformations & Pure Logic

- **Pure Function Contracts:** None changed. `calculateRecipeStats`, `canScale`, `deriveScaledEquipment`, `scaleRecipe` call sites are untouched.
- **No-Match / Fallback Contracts:** None changed. The `RecipeImportModal` preview, `PostBrewCalibrationModal` comparison table, and `BatchRecipeAdjustModal` live-vitals computation keep their existing fallback behaviors (e.g. `correctedSg === null` disabled state, `canCalibrate` gating).
- **Stateful Integration Contract:** Each migrated button/input/select keeps its exact `onClick`/`onChange` handler, `disabled` gating, `data-testid`, and `aria-*` props. Only the rendered element and its class composition change.
- **Refactoring & Legacy Cleanup:** The two `designTokens.test.ts` AC-13 rows for the migrated dialogs are removed (RA-6). No obsolete registration loops or legacy aliases exist in this surface.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | `designSystem.ts` and `Modal.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. |
| **AC-2** | `RecipeImportModal.tsx` header Close button renders via `<Button variant="icon">` | Component Test | `aria-label="Close"`, click dispatches `onClose`. |
| **AC-3** | `RecipeImportModal.tsx` equipment `<select>` renders via `<Select size="sm">` | Component Test | `aria-label="Target Equipment Profile"`, options render, `onChange` sets target equipment (AC-6 of the M22 test block passes). |
| **AC-4** | `RecipeImportModal.tsx` Toggle-All button renders via `<Button variant="secondary" size="sm">` | Component Test | `Select All`/`Deselect All` text toggles and behavior unchanged. |
| **AC-5** | `RecipeImportModal.tsx` footer Cancel button renders via `<Button variant="secondary" size="sm">` | Component Test | Click dispatches `onClose`. |
| **AC-6** | `RecipeImportModal.tsx` Import Selected button renders via `<Button variant="primary" size="sm">` | Component Test | `data-testid="confirm-import-btn"` retained; import behavior and disabled gating unchanged. |
| **AC-7** | `PostBrewCalibrationModal.tsx` Close button renders via `<Button variant="icon">` | Component Test | `data-testid="close-calibration-modal-btn"` retained, click dispatches `onClose`. |
| **AC-8** | `PostBrewCalibrationModal.tsx` Update Recipe Target button renders via `<Button variant="secondary" size="sm">` | Component Test | `data-testid="calibrate-recipe-btn"` retained, click calls `onUpdateRecipe` with the calibrated patch (AC-11 test passes). |
| **AC-9** | `PostBrewCalibrationModal.tsx` Update Equipment Profile button renders via `<Button variant="primary" size="sm">` | Component Test | `data-testid="calibrate-equipment-btn"` retained, click calls `onUpdateEquipmentProfile` with the calibrated patch (AC-10 test passes). |
| **AC-10** | `BatchRecipeAdjustModal.tsx` Close button renders via `<Button variant="icon">` | Component Test | `data-testid="batch-recipe-adjust-close-btn"` retained, click dispatches `onClose`. |
| **AC-11** | `BatchRecipeAdjustModal.tsx` Cancel button renders via `<Button variant="secondary" size="sm">` | Component Test | `data-testid="batch-recipe-adjust-cancel-btn"` retained, click dispatches `onClose`. |
| **AC-12** | `BatchRecipeAdjustModal.tsx` Save button renders via `<Button variant="primary" size="sm">` | Component Test | `data-testid="batch-recipe-adjust-save-btn"` retained, click saves via `updateBatchRecipeSnapshot` and calls `onSaved`. |
| **AC-13** | `App.tsx` scale modal Cancel button renders via `<Button variant="secondary" size="sm">` | Component Test | Click closes the scale modal (existing App.test.tsx scale-modal tests pass). |
| **AC-14** | `App.tsx` scale modal Scale Recipe button renders via `<Button variant="primary" size="sm">` | Component Test | Click calls `handleScaleRecipe`; `Scaling…` busy label and disabled gating preserved. |
| **AC-15** | `App.tsx` scale modal target-size input renders through `<NumberInput>` with `addonRight="Liters"` | Component Test | `aria-label="Target batch size in liters"` retained; the raw `Liters` `<span>` is removed. |
| **AC-16** | Zero raw `<button className=...>`, zero raw `<select>`, and zero raw text/number `<input>` in the four migrated dialog surfaces (checkbox/radio exempt per RA-4) | Static Sweep (`uiPrimitives.test.tsx`) | All four files pass source adoption assertions. |
| **AC-17** | AC-13 token-import rows for `PostBrewCalibrationModal` and `RecipeImportModal` removed from `designTokens.test.ts`; `ReadingLog` and `BatchDetail` rows remain | Existing Test | `designTokens.test.ts` CASES array matches expected reduced set; ReadingLog/BatchDetail rows still pass. |
| **AC-18** | `RecipeImportModal.test.tsx` AC-5/AC-6/AC-7 (off-palette primary, zero red-*, form-control backgrounds) still pass | Existing Tests | SOURCE assertions reconciled to the new `<Button>`/`<Select>` (no removed literal reappears, no `bg-red-`/`text-red-` introduced). |
| **AC-19** | M25 Modal shell invariants pass unmodified | Existing Tests | All focus-trapping, Escape-dismissal, backdrop click, and focus-restoration tests in `Modal.test.tsx` pass 100%. |
| **AC-20** | All existing tests in `RecipeImportModal.test.tsx`, `PostBrewCalibrationModal.test.tsx`, `BatchRecipeAdjustModal.test.tsx`, and the App.test.tsx scale-modal block pass | Existing Tests | 100% green. |
| **AC-21** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Authorized files only modified. |
| **AC-22** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,198 passed across 121 files). |
| **AC-23** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-24** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-25** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |

---

## 4. Scope Guardrail — Authorized Files

### 4.1 Authorized to Modify (8 files)
1. `apps/web/src/components/RecipeImportModal.tsx`
2. `apps/web/src/components/PostBrewCalibrationModal.tsx`
3. `apps/web/src/components/BatchRecipeAdjustModal.tsx`
4. `apps/web/src/App.tsx`
5. `apps/web/test/uiPrimitives.test.tsx`
6. `apps/web/test/designTokens.test.ts`
7. `apps/web/test/RecipeImportModal.test.tsx`
8. `apps/web/test/PostBrewCalibrationModal.test.tsx`
9. `apps/web/test/BatchRecipeAdjustModal.test.tsx`
10. `apps/web/test/App.test.tsx`

### 4.2 Authorized to Create
**None.**

### 4.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/Modal.tsx`.
- `apps/web/src/components/ui/*` (all five primitives — they are the settled contract, not the migration target).
- `packages/**`, `apps/api/**`.
- Every other dialog/panel file (`WaterCalculatorModal.tsx`, `SensoryEvaluationPanel.tsx`, `SplitPackagingPanel.tsx`, `RecipeLibrary.tsx`, `InventoryManager.tsx`, etc.) — those are later M34 phases.

---

## 5. Layer 1 Command Gates

```bash
npm test
npm run typecheck
npm run build
npm run lint
```
All four gates must exit 0 cleanly before `/execute` halts for `/steer`.

---

## 6. Manual Verification Evidence

Save to `.gsd/active/manual_verification/`:
- **`M34_P2_import_calibration_dialogs.png`**: Screenshot of `RecipeImportModal`, `PostBrewCalibrationModal`, `BatchRecipeAdjustModal`, and the `App.tsx` scale modal showing migrated `<Button>`, `<Select>`, and `<NumberInput>` components.

---

## 7. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
