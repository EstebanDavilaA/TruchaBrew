# FEATURE SPECIFICATION: M25_P1 — Every Dialog Behaves Like a Dialog (Shared Modal Wrapper & A11y Focus-Trap)

## Phase Summary

This is the single and closing phase of **Milestone 25 ("Every dialog behaves like a dialog")**.

While Milestone 23 established accessible attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and Milestone 24 unified design tokens and vocabulary across the app, dialogs still lack standardized keyboard interactivity. Currently, pressing Tab allows keyboard focus to escape dialogs into the underlying page, pressing Escape does not reliably dismiss all dialogs, focus is not systematically trapped or restored to the opening trigger upon close, and backdrop click handling is hand-rolled with inconsistent container styling.

This phase introduces a standardized, accessible `<Modal>` component wrapper and `useModalA11y` hook in `apps/web/src/components/Modal.tsx`, and migrates all **8 dialogs** across the application onto it.

### Key Behaviors

1. **Focus Trap & Cycle**: While any modal is open, pressing `Tab` or `Shift+Tab` cycles focus strictly among the tabbable elements within the modal container (`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`, excluding disabled elements), preventing focus from leaking into the underlying background document.
2. **Escape Dismissal**: Pressing the `Escape` key immediately closes the active modal via its `onClose` / `onCancel` callback, unless explicitly prevented while an operation is in flight (`busy === true` or `disableEscape === true`).
3. **Focus Restoration**: Upon opening a modal, focus moves to the first focusable element (or specified `initialFocusRef`); upon closing, focus is automatically returned to the element that held focus immediately before the modal was opened.
4. **Stacked / Nested Modal Hierarchy**: If a modal opens over another (e.g. `ConfirmDialog` opened to confirm an action), the top-most modal captures keyboard events (`Escape`, `Tab`) and closes cleanly without dismissing the underlying dialog.
5. **Backdrop Click Dismissal**: Clicking the semi-transparent backdrop outside the modal dialog container dismisses the modal (unless `disableBackdropClick === true` or `busy === true`).
6. **Migrate All 8 Dialogs**:
   - `ConfirmDialog.tsx`
   - `PresetPickerModal.tsx`
   - `RefractometerFermentationModal.tsx`
   - `PostBrewCalibrationModal.tsx`
   - `BatchRecipeAdjustModal.tsx`
   - `RecipeImportModal.tsx`
   - `WaterCalculatorModal.tsx`
   - `App.tsx` (Scale Recipe Batch Size modal)
7. **Design System & Module Boundary**: The shared `Modal` component and hooks live in `apps/web/src/components/Modal.tsx`. `apps/web/src/components/designSystem.ts` remains strictly a constants-only module exporting zero functions/components (preserving `designSystem.test.ts`).

---

## Resolved Ambiguities (Binding)

- **RA-1 — Module Placement & Design System Integrity**: `Modal` and `useModalA11y` are implemented in `apps/web/src/components/Modal.tsx`. `designSystem.ts` is NOT modified to export components, ensuring `designSystem.test.ts`'s `"exports no functions"` assertion passes unmodified.
- **RA-2 — Focusable Elements Selector**: The focus trap selector is:
  `'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'`
  Elements with `display: none`, `visibility: hidden`, or `disabled` are excluded from the focus cycle. If a modal contains zero focusable elements, focus stays on the modal container itself (`tabIndex={-1}`).
- **RA-3 — Escape Key Handling & In-Flight Protection**: The Escape key listener is registered on `document` (or the modal container) on mount and cleaned up on unmount. If `busy={true}` (such as during a deletion in `ConfirmDialog` or recipe save in `BatchRecipeAdjustModal`), the Escape listener does not trigger dismissal.
- **RA-4 — Initial Focus Priority**: When `isOpen` becomes `true`:
  1. If `initialFocusRef` is provided and points to a valid element, focus that element.
  2. Otherwise, focus the first tabbable element inside the modal.
  3. If none, focus the modal container root.
- **RA-5 — Stacked Modal Hierarchy**: Modals maintain a global or stack-based active registry (or capture-phase key listener) so that when multiple dialogs are open (e.g. `ConfirmDialog` on top of another modal), `Escape` only closes the topmost dialog.
- **RA-6 — Scale Modal in `App.tsx`**: `App.tsx`'s inline scale modal at line 761 is refactored to use `<Modal>`. The resulting DOM structure must continue to satisfy `accessibilityAndPolish.test.tsx` AC-11 assertions (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="scale-modal-title"`, `id="scale-modal-title"`, and `aria-label="Target batch size in liters"`).
- **RA-7 — Scope Guardrail Baseline**: Pre/post SHA-256 content manifest diff against working tree files.

---

## 1. Data Schema & Contracts

### 1.1 `ModalProps` Interface (`apps/web/src/components/Modal.tsx`)

```typescript
export interface ModalProps {
  /** Whether the modal is currently open and mounted. */
  readonly isOpen: boolean;
  /** Callback fired when modal requests dismissal (Escape key, backdrop click, or close button). */
  readonly onClose: () => void;
  /** Accessible title for aria-labelledby. If string provided, can be rendered or linked to title ID. */
  readonly titleId?: string;
  /** Optional accessible description for aria-describedby. */
  readonly ariaDescribedBy?: string;
  /** ARIA role: 'dialog' (default) or 'alertdialog' (for confirm prompts). */
  readonly role?: 'dialog' | 'alertdialog';
  /** Max width / sizing class for the dialog container (e.g. 'max-w-lg', 'max-w-4xl'). Defaults to 'max-w-lg'. */
  readonly maxWidthClass?: string;
  /** Additional container classes. */
  readonly containerClassName?: string;
  /** Additional backdrop classes. */
  readonly backdropClassName?: string;
  /** Optional ref to focus when the modal opens. Defaults to first focusable element. */
  readonly initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Disable clicking backdrop to close. Defaults to false. */
  readonly disableBackdropClick?: boolean;
  /** Disable Escape key to close. Defaults to false. */
  readonly disableEscape?: boolean;
  /** If true, indicates an in-flight operation; disables backdrop and Escape dismissals. */
  readonly busy?: boolean;
  /** Modal content. */
  readonly children: React.ReactNode;
}
```

### 1.2 Modified vs. Untouched Files

**New Files (2):**
- `apps/web/src/components/Modal.tsx`
- `apps/web/test/Modal.test.tsx`

**Modified — Source Files (8):**
- `apps/web/src/components/ConfirmDialog.tsx`
- `apps/web/src/components/PresetPickerModal.tsx`
- `apps/web/src/components/RefractometerFermentationModal.tsx`
- `apps/web/src/components/PostBrewCalibrationModal.tsx`
- `apps/web/src/components/BatchRecipeAdjustModal.tsx`
- `apps/web/src/components/RecipeImportModal.tsx`
- `apps/web/src/components/WaterCalculatorModal.tsx`
- `apps/web/src/App.tsx` (scale recipe modal refactored to `<Modal>`)

**Modified — Test Files (as coupled to modal changes):**
- `apps/web/test/ConfirmDialog.test.tsx`
- `apps/web/test/PresetPickerModal.test.tsx`
- `apps/web/test/RefractometerFermentationModal.test.tsx`
- `apps/web/test/PostBrewCalibrationModal.test.tsx`
- `apps/web/test/BatchRecipeAdjustModal.test.tsx`
- `apps/web/test/RecipeImportModal.test.tsx`
- `apps/web/test/WaterCalculatorModal.test.tsx`
- `apps/web/test/ScopeGuardrail.test.tsx` (reconciled if dialog wrappers change)
- `apps/web/test/accessibilityAndPolish.test.tsx` (asserts on scale modal in App.tsx)

**Explicitly Untouched Files:**
- `apps/web/src/components/designSystem.ts` (constants-only contract preserved)
- `apps/web/test/designSystem.test.ts` (asserts module exports no functions)
- `apps/api/**`, `packages/calculations/**`, `packages/shared-types/**`

---

## 2. Transformations & Pure Logic

`Modal.tsx` encapsulates:
1. `useModalA11y`: Hook managing:
   - `useEffect` for `keydown` listener capturing `Escape` and `Tab`.
   - Focus trap loop: if active element is last focusable and user presses `Tab`, prevent default and focus first element; if active element is first focusable and user presses `Shift+Tab`, prevent default and focus last element.
   - Preserving `document.activeElement` on open and calling `.focus()` on it during unmount/cleanup.
2. Backdrop container with click delegation checking `e.target === e.currentTarget` to prevent internal content clicks from bubbling as backdrop dismissals.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Title | Scope | Expected Outcome |
|---|---|---|---|
| AC-1 | Modal Wrapper Focus Trapping | Component | In `Modal.test.tsx`, rendering `<Modal>` with multiple focusable inputs: pressing `Tab` on the last element wraps focus to the first element; pressing `Shift+Tab` on the first element wraps focus to the last element. |
| AC-2 | Modal Wrapper Escape Dismissal | Component | In `Modal.test.tsx`, pressing `Escape` calls `onClose`. If `busy={true}` or `disableEscape={true}`, pressing `Escape` does not call `onClose`. |
| AC-3 | Modal Wrapper Focus Restoration | Component | In `Modal.test.tsx`, focusing an external button, opening the modal, and closing it returns focus to that initial external button. |
| AC-4 | Modal Wrapper Backdrop Click | Component | In `Modal.test.tsx`, clicking the backdrop overlay calls `onClose`; clicking inside the modal dialog container does NOT call `onClose`. |
| AC-5 | Stacked Modal Hierarchy | Component | In `Modal.test.tsx`, opening a second nested modal on top of a first modal: pressing `Escape` closes only the topmost modal and leaves the base modal open. |
| AC-6 | `ConfirmDialog` Migration | Component | `ConfirmDialog` uses `<Modal role="alertdialog">`, traps focus, dismisses on `Escape` (when not busy), and passes `ConfirmDialog.test.tsx`. |
| AC-7 | `PresetPickerModal` Migration | Component | `PresetPickerModal` uses `<Modal>`, traps focus, closes on `Escape`, and passes `PresetPickerModal.test.tsx`. |
| AC-8 | `RefractometerFermentationModal` Migration | Component | `RefractometerFermentationModal` uses `<Modal>`, traps focus, closes on `Escape`, and passes `RefractometerFermentationModal.test.tsx`. |
| AC-9 | `PostBrewCalibrationModal` Migration | Component | `PostBrewCalibrationModal` uses `<Modal>`, traps focus, closes on `Escape`, and passes `PostBrewCalibrationModal.test.tsx`. |
| AC-10 | `BatchRecipeAdjustModal` Migration | Component | `BatchRecipeAdjustModal` uses `<Modal>`, traps focus, closes on `Escape`, and passes `BatchRecipeAdjustModal.test.tsx`. |
| AC-11 | `RecipeImportModal` Migration | Component | `RecipeImportModal` uses `<Modal>`, traps focus, closes on `Escape`, and passes `RecipeImportModal.test.tsx`. |
| AC-12 | `WaterCalculatorModal` Migration | Component | `WaterCalculatorModal` uses `<Modal>`, traps focus, closes on `Escape`, and passes `WaterCalculatorModal.test.tsx`. |
| AC-13 | `App.tsx` Scale Modal Migration | Component | `App.tsx` scale modal uses `<Modal>`, preserves all AC-11 attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="scale-modal-title"`, `aria-label="Target batch size in liters"`), and passes `accessibilityAndPolish.test.tsx`. |
| AC-14 | Design System Constants-Only Contract | Unit | `designSystem.test.ts` passes with body unmodified; `designSystem.ts` exports 0 functions or components. |
| AC-15 | Scope Guardrail | Verification | Only authorized 8 source files, 1 new component file, 1 new test file, coupled test files, `.gsd/STATE.json`, and `.gsd/ROADMAP.md` modified. |
| AC-16 | Four Layer 1 Gates Clean | Verification | `npm test` (all workspaces), `npm run typecheck`, `npm run build`, and `npm run lint` all exit 0. |

---

## 4. Follow-ups logged, not built

- Off-canvas mobile sidebar (Milestone 26, which reuses this Modal focus-trap/Escape behavior).
- React Router adoption (Milestone 27).

---

> **HALT GATE (STATE 2):** Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution, or provide feedback/adjustments.
