# FEATURE SPECIFICATION: M34_P1 — Dialog Content Migration: ConfirmDialog, PresetPickerModal, and RefractometerFermentationModal

> **Milestone 34:** "Every dialog and panel is built from the same parts" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 1 of 5.** Migrates the form contents of the three simplest dialogs (`ConfirmDialog.tsx`, `PresetPickerModal.tsx`, and `RefractometerFermentationModal.tsx`) onto `components/ui/` primitives (`<Button>`, `<Input>`, `<NumberInput>`), establishing that content migration preserves the M25 `<Modal>` focus-trapping, Escape-dismissal, and focus-restoration guarantees unmodified.

---

## Phase Summary

In Milestone 33, we settled the `<Button>` API across all batch and brew-day surfaces.
In Milestone 34, we migrate the app's eight dialogs and manager panels so their contents share the same design primitives.

In Milestone 34 Phase 1, we migrate the three simplest dialogs:
1. **`ConfirmDialog.tsx` Content Migration:**
   - **Cancel Button (CD-1):** Migrates to `<Button variant="secondary" size="sm" type="button" data-testid="confirm-dialog-cancel" onClick={onCancel} disabled={busy}>Cancel</Button>`.
   - **Confirm Button (CD-2):** Migrates to `<Button variant="danger" size="sm" type="button" data-testid="confirm-dialog-confirm" onClick={onConfirm} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{confirmLabel ?? 'Delete'}</Button>`.
   - Retires manual button styling strings (`text-xs text-slate-400 hover:text-slate-200 px-3 py-2...` and `bg-rose-700 hover:bg-rose-600...`).
2. **`PresetPickerModal.tsx` Content Migration:**
   - **Close Button (PP-1):** Migrates to `<Button variant="icon" type="button" onClick={onClose} aria-label="Close" title="Close"><X className="w-5 h-5" /></Button>`.
   - **Search Input (PP-2):** Migrates to `<Input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." data-testid="preset-picker-search" />`.
   - **Add Custom Item Button (PP-3):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={() => onSelectCustom(category)} data-testid="preset-add-custom-btn" className="w-full border-dashed"><Plus className="w-4 h-4" /> Add Custom Item</Button>`.
3. **`RefractometerFermentationModal.tsx` Content Migration:**
   - **Close Button (RF-1):** Migrates to `<Button variant="icon" type="button" onClick={onClose} aria-label="Close modal" title="Close"><X className="w-5 h-5" /></Button>`.
   - **Initial Brix Input (RF-2):** Migrates to `<NumberInput id="refract-initial-brix" step="0.1" value={initialBrix} onChange={(e) => setInitialBrix(e.target.value)} className="mt-1 block w-full" />`.
   - **Current Brix Input (RF-3):** Migrates to `<NumberInput id="refract-current-brix" step="0.1" value={currentBrix} onChange={(e) => setCurrentBrix(e.target.value)} className="mt-1 block w-full" />`.
   - **Wort Correction Factor Input (RF-4):** Migrates to `<NumberInput id="refract-wcf" step="0.01" value={wcf} onChange={(e) => setWcf(e.target.value)} className="mt-1 block w-full" />`.
   - **Cancel Button (RF-5):** Migrates to `<Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>`.
   - **Apply Button (RF-6):** Migrates to `<Button variant="primary" size="sm" type="button" data-testid="apply-corrected-sg-btn" disabled={correctedSg === null} onClick={handleApply}>Use Corrected SG ({correctedSg !== null ? correctedSg.toFixed(3) : '—'})<ArrowRight className="w-3.5 h-3.5" /></Button>`.
4. **Preserving M25 Modal Shell Invariants:**
   - The outer `<Modal>` wrappers, backdrop blur, `maxWidthClass`, `role="dialog"` / `role="alertdialog"`, and focus trapping mechanisms remain 100% untouched and functional.
5. **Tests & Static Adoption Sweeps:**
   - All tests in `ConfirmDialog.test.tsx`, `PresetPickerModal.test.tsx`, `RefractometerFermentationModal.test.tsx`, and `Modal.test.tsx` pass cleanly.
   - `uiPrimitives.test.tsx` extended with static sweep asserting zero raw `<button className=...>` or raw `<input className=...>` in the three migrated dialog components.

---

## Key Behaviors

1. `apps/web/src/components/ConfirmDialog.tsx`:
   - Imports `Button` from `./ui`.
   - Both action buttons render through `<Button>`.
2. `apps/web/src/components/PresetPickerModal.tsx`:
   - Imports `Button` and `Input` from `./ui`.
   - Replaces raw `<input className={INPUT_CLASS}>` with `<Input>`.
   - Replaces raw header and footer buttons with `<Button>`.
3. `apps/web/src/components/RefractometerFermentationModal.tsx`:
   - Imports `Button` and `NumberInput` from `./ui`.
   - Replaces raw numeric `<input type="number" className={INPUT_CLASS}>` with `<NumberInput>`.
   - Replaces raw buttons with `<Button>`.

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added or modified.

**RA-2 — `Modal.tsx` Shell Remains Read-Only.**
`Modal.tsx` is the container shell hardened in M25 and remains read-only; this phase migrates only dialog content children.

**RA-3 — Border-Dashed Style on PresetPicker Add Custom Button.**
The dashed border on `preset-add-custom-btn` is preserved via `className="w-full border-dashed"` on `<Button variant="secondary" size="sm">`.

**RA-4 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 34 Phase 1 begins dialog content migration onto Living Design System components. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Unified dialog form controls and button styling. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/ConfirmDialog.tsx` | **MODIFY** | Migrate buttons onto `<Button>`. |
| `apps/web/src/components/PresetPickerModal.tsx` | **MODIFY** | Migrate search input to `<Input>` and buttons to `<Button>`. |
| `apps/web/src/components/RefractometerFermentationModal.tsx` | **MODIFY** | Migrate numeric inputs to `<NumberInput>` and buttons to `<Button>`. |
| `apps/web/test/ConfirmDialog.test.tsx` | **MODIFY** | Verify tests pass cleanly. |
| `apps/web/test/PresetPickerModal.test.tsx` | **MODIFY** | Verify tests pass cleanly. |
| `apps/web/test/RefractometerFermentationModal.test.tsx` | **MODIFY** | Verify tests pass cleanly. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add static sweeps for ConfirmDialog, PresetPickerModal, and RefractometerFermentationModal. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `designSystem.ts` and `Modal.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. |
| **AC-2** | `ConfirmDialog.tsx` Cancel button renders via `<Button variant="secondary" size="sm">` | Component Test | Test ID `confirm-dialog-cancel`, click dispatches `onCancel`. |
| **AC-3** | `ConfirmDialog.tsx` Confirm button renders via `<Button variant="danger" size="sm">` | Component Test | Test ID `confirm-dialog-confirm`, click dispatches `onConfirm`, spinner when busy. |
| **AC-4** | `PresetPickerModal.tsx` Close button renders via `<Button variant="icon">` | Component Test | `aria-label="Close"`, click dispatches `onClose`. |
| **AC-5** | `PresetPickerModal.tsx` Search input renders via `<Input>` | Component Test | Test ID `preset-picker-search`, filtering works case-insensitively. |
| **AC-6** | `PresetPickerModal.tsx` Add Custom Item button renders via `<Button variant="secondary" size="sm">` | Component Test | Test ID `preset-add-custom-btn`, click dispatches `onSelectCustom`. |
| **AC-7** | `RefractometerFermentationModal.tsx` Close button renders via `<Button variant="icon">` | Component Test | `aria-label="Close modal"`, click dispatches `onClose`. |
| **AC-8** | `RefractometerFermentationModal.tsx` inputs render via `<NumberInput>` | Component Test | IDs `refract-initial-brix`, `refract-current-brix`, `refract-wcf`. |
| **AC-9** | `RefractometerFermentationModal.tsx` Cancel button renders via `<Button variant="secondary" size="sm">` | Component Test | Click dispatches `onClose`. |
| **AC-10** | `RefractometerFermentationModal.tsx` Apply button renders via `<Button variant="primary" size="sm">` | Component Test | Test ID `apply-corrected-sg-btn`, click applies calculated SG. |
| **AC-11** | Zero raw `<button className=...>` and zero raw `<input className=...>` in the 3 dialogs | Static Sweep (`uiPrimitives.test.tsx`) | All 3 files pass source adoption assertions. |
| **AC-12** | M25 Modal shell invariants pass unmodified | Existing Tests | All focus-trapping, Escape-dismissal, backdrop click, and focus-restoration tests in `Modal.test.tsx` pass 100%. |
| **AC-13** | All existing tests in `ConfirmDialog.test.tsx`, `PresetPickerModal.test.tsx`, `RefractometerFermentationModal.test.tsx` pass | Existing Tests | 100% green. |
| **AC-14** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Authorized files only modified. |
| **AC-15** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,198 passed across 121 files). |
| **AC-16** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-17** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-18** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (7 files)
1. `apps/web/src/components/ConfirmDialog.tsx`
2. `apps/web/src/components/PresetPickerModal.tsx`
3. `apps/web/src/components/RefractometerFermentationModal.tsx`
4. `apps/web/test/ConfirmDialog.test.tsx`
5. `apps/web/test/PresetPickerModal.test.tsx`
6. `apps/web/test/RefractometerFermentationModal.test.tsx`
7. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/Modal.tsx`.
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
- **`M34_P1_dialog_buttons_and_inputs.png`**: Screenshot of `ConfirmDialog`, `PresetPickerModal`, and `RefractometerFermentationModal` showing migrated `<Button>`, `<Input>`, and `<NumberInput>` components.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
