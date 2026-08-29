# FEATURE SPECIFICATION: M33_P1 — The Button Axes, Proven on the Smallest Surface

> **Milestone 33:** "Brew day stops improvising its buttons" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 1 of 5.** Grows `<Button>` unified icon alignment and gap (`inline-flex items-center justify-center gap-1.5`), settles the `size="sm"` compact control plane (~32px), and migrates `StockCheckPanel.tsx` (4 raw buttons) onto `<Button>`.

---

## Phase Summary

In Milestone 30, the basic `<Button>` primitive was created with `variant` (`primary`, `secondary`, `danger`, `icon`) and `size` (`md`, `sm`).
In Milestone 33, we systematically eliminate the 29+ hand-rolled button variants and arbitrary height/gap splits across all active batch and brew day screens.

In Milestone 33 Phase 1, we prove and harden the button axes on the smallest batch surface:
1. **`Button.tsx` Primitives Hardening:**
   - Standardizes icon+text layout: `<Button>` applies `inline-flex items-center justify-center gap-1.5` by default.
   - Resolves the legacy `gap-1.5` vs `gap-2` split to unified `gap-1.5` for icon buttons.
   - Refines `size="sm"`: applies `text-xs px-3 py-1.5 font-semibold rounded-lg` (~32px height), ensuring small primary and secondary buttons render consistent geometric dimensions.
   - Settle `variant="icon"`: ensures icon buttons render square hit targets with `p-2 rounded-lg` and appropriate hover/disabled states without injected text sizing.
2. **`StockCheckPanel.tsx` Migration (4 Raw Buttons):**
   - **Header Adjust Button:** Migrates "Adjust Batch Recipe" to `<Button variant="secondary" size="sm" onClick={onAdjustRecipe} data-testid="batch-adjust-recipe-btn">`.
   - **Bulk Deduct Action:** Migrates "Deduct All from Inventory" to `<Button variant="primary" size="sm" disabled={...} onClick={handleDeductAll} data-testid="stock-check-deduct-all-btn">`.
   - **Per-Row Undo Action:** Migrates table row "Undo" button to `<Button variant="secondary" size="sm" disabled={...} onClick={() => handleToggle(line)} data-testid={`stock-check-undo-${line.nameKey}`}>`.
   - **Per-Row Deduct Action:** Migrates table row "Deduct" button to `<Button variant="primary" size="sm" disabled={...} onClick={() => handleToggle(line)} data-testid={`stock-check-deduct-${line.nameKey}`}>`.
   - Purges all manual class strings and achieves **zero raw `<button>` elements** in `StockCheckPanel.tsx`.
3. **Tests & Static Adoption Sweeps:**
   - All existing `StockCheckPanel.test.tsx` (16 tests) and `StockCheckDeduction.test.tsx` tests pass 100% unmodified.
   - Extend `uiPrimitives.test.tsx` with unit tests for `<Button>` icon gap/alignment and static sweep verifying zero raw `<button>` elements in `StockCheckPanel.tsx`.

---

## Key Behaviors

1. `apps/web/src/components/ui/Button.tsx`:
   - Emits consistent flex and gap classes:
     ```tsx
     const baseVariantClass = VARIANT_MAP[variant];
     const sizeClass = size === 'sm' && variant !== 'icon' ? 'text-xs px-3 py-1.5' : '';
     const layoutClass = variant !== 'icon' ? 'inline-flex items-center justify-center gap-1.5' : 'inline-flex items-center justify-center';
     const mergedClass = [layoutClass, baseVariantClass, sizeClass, className].filter(Boolean).join(' ');
     ```
2. `apps/web/src/components/StockCheckPanel.tsx`:
   - Replaces 4 raw button elements with `<Button>` from `./ui`.
   - Preserves all `data-testid`, `onClick`, `disabled`, and icon child elements (`<PackageCheck>`, `<Undo2>`).
   - Retires manual class strings:
     - `bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700...` -> `<Button variant="secondary" size="sm">`
     - `bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg...` -> `<Button variant="primary" size="sm">`
     - `inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700...` -> `<Button variant="secondary" size="sm">`
     - `inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-500...` -> `<Button variant="primary" size="sm">`

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added or modified.

**RA-2 — Single Decided Gap for Icon Buttons.**
The gap between icons and labels in `<Button>` is standardized to `gap-1.5`. This unifies all small primary, secondary, and danger buttons.

**RA-3 — Preserving Existing Test IDs and Event Handlers.**
All existing `data-testid` attributes (`batch-adjust-recipe-btn`, `stock-check-deduct-all-btn`, `stock-check-undo-${line.nameKey}`, `stock-check-deduct-${line.nameKey}`) and asynchronous deduction/reversal state flows in `StockCheckPanel.tsx` are preserved 100%.

**RA-4 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source code file.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_EXECUTION` | Milestone 33 Phase 1 proves and hardens the button axes on the Planning stock check surface. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Unified button typography, heights, and icon alignments. |

---

## 1. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/ui/Button.tsx` | **MODIFY** | Add unified flex layout (`inline-flex items-center justify-center gap-1.5`) and refine `size="sm"` classes. |
| `apps/web/src/components/StockCheckPanel.tsx` | **MODIFY** | Migrate all 4 raw `<button>` elements to `<Button>`. |
| `apps/web/test/StockCheckPanel.test.tsx` | **MODIFY** | Extend with button component assertions while preserving existing 16 tests. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add `Button` icon gap unit tests and static sweep proving zero raw `<button>` elements in `StockCheckPanel.tsx`. |

---

## 2. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `designSystem.ts` confirmed byte-identical (RA-1) | Verification | SHA-256 identical pre/post. 28 exports unchanged. |
| **AC-2** | `Button` applies `inline-flex items-center justify-center gap-1.5` for non-icon variants | Component Test | Rendered `<Button>` has flex centering and `gap-1.5`. |
| **AC-3** | `Button` `size="sm"` applies `text-xs px-3 py-1.5 font-semibold` | Component Test | Small button renders compact padding and small typography. |
| **AC-4** | `Button` `variant="icon"` applies `BUTTON_ICON_CLASS` with `p-2` | Component Test | Icon button renders square hit target without text padding. |
| **AC-5** | `StockCheckPanel.tsx` "Adjust Batch Recipe" renders via `<Button variant="secondary" size="sm">` | Component Test | Header adjust button renders as secondary small button with test ID. |
| **AC-6** | `StockCheckPanel.tsx` "Deduct All from Inventory" renders via `<Button variant="primary" size="sm">` | Component Test | Bulk deduct button renders as primary small button with `<PackageCheck>` icon. |
| **AC-7** | `StockCheckPanel.tsx` row "Undo" button renders via `<Button variant="secondary" size="sm">` | Component Test | Undo action button renders as secondary small button with `<Undo2>` icon. |
| **AC-8** | `StockCheckPanel.tsx` row "Deduct" button renders via `<Button variant="primary" size="sm">` | Component Test | Deduct action button renders as primary small button with `<PackageCheck>` icon. |
| **AC-9** | Zero raw `<button className=...>` in `StockCheckPanel.tsx` | Static Sweep (`uiPrimitives.test.tsx`) | Regex `/<button[\s>]/g` in `StockCheckPanel.tsx` matches 0. |
| **AC-10** | Button height consistency: small primary and secondary buttons evaluate to ~32px height band | Rendered Test | Primary and secondary `size="sm"` buttons share `text-xs px-3 py-1.5`. |
| **AC-11** | Bulk deduct and single-item toggle handlers function with optimistic updates | Integration Test | All 16 pre-existing tests in `StockCheckPanel.test.tsx` and `StockCheckDeduction.test.tsx` pass cleanly. |
| **AC-12** | Disabled button styling and cursor behavior hold | Component Test | Disabled buttons retain `disabled:opacity-50 disabled:cursor-not-allowed`. |
| **AC-13** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Exactly 4 authorized files modified, 0 created, 0 deleted. |
| **AC-14** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,192 passed across 121 files). |
| **AC-15** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-16** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-17** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-18** | Manual verification screenshot (best-effort) | Verification | `M33_P1_stock_check_buttons.png` saved to `.gsd/active/manual_verification/` if browser automation available. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Modify (4 files)
1. `apps/web/src/components/ui/Button.tsx`
2. `apps/web/src/components/StockCheckPanel.tsx`
3. `apps/web/test/StockCheckPanel.test.tsx`
4. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Create
**None.**

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, 28 constants).
- `apps/web/src/components/ReadingLog.tsx`, `BatchNoteLog.tsx`, `BrewDayTracker.tsx`, `pages/BatchDetail.tsx`.
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
- **`M33_P1_stock_check_buttons.png`**: Screenshots of `StockCheckPanel` displaying migrated `<Button>` components (Adjust Recipe, Deduct All, and row Deduct/Undo actions) with unified ~32px compact button heights and `gap-1.5` icon alignments.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
