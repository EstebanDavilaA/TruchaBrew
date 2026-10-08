# FEATURE SPECIFICATION: M34_P3 — WaterCalculatorModal.tsx, Alone: Form Realignment, Unified AUTO Calculation, Balanced Column Grid, and Design System Primitives

> **Milestone 34:** "Every dialog and panel is built from the same parts" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 3 of 5.** Migrates the form contents of `WaterCalculatorModal.tsx` onto `components/ui/` primitives (`<Button>`, `<Select>`, `<NumberInput>`), unifies salt + acid calculation under a single header `AUTO` action (retiring fragmented inline auto buttons), harmonizes column distribution across Needed/Mash/Sparge/Total in the mineral table, and structures Acid Adjustments with balanced spacing and design system control heights.

---

## Phase Summary

Milestone 34 Phase 2 established the content-migration pattern on the four import-and-calibration dialogs. Phase 3 isolates `WaterCalculatorModal.tsx` because it is the dialog most likely to have accumulated behavior a content migration could quietly break — it is the only dialog with live reactive chemistry calculations interleaved with its form controls.

This revised Phase 3 spec addresses both the primitive adoption and the layout/workflow alignment requested by the brewer:

1. **Unified Global `AUTO` Header Action (FEAT-028 / UI/UX Realignment):**
   - The top header `AUTO` button (`<Button variant="secondary" size="sm">`) computes both **optimal salt additions** and **mash/sparge acid additions** in a single click based on the selected Target Profile and Target pH values.
   - Retires the disconnected, crowded inline `Auto` text links in the Acid section.
   - Header action layout is normalized into a cohesive button cluster with standardized `<Button size="sm">` variants, balanced gaps, and aligned height.
2. **Minerals Needed Column Grid & Metric Alignment:**
   - Symmetrically balances column widths across `Mineral` (left), `Needed` (right), `Mash` (center-right), `Sparge` (center-right), and `Total` (right).
   - In `Mash` and `Sparge` columns, `<NumberInput size="sm" width="lg" align="right" addonRight="g">` inputs are cleanly aligned within their table cells so they visually align with the `Needed` reference column and `Total` values without floating or jumping.
   - Sparge column checkbox toggle remains integrated in the `Sparge (volume L)` column header, disabling sparge salt inputs when unchecked.
3. **Acid Adjustments Form Structure & Target pH Rhythm:**
   - Replaces the irregular nested table inside Acid Adjustments with clean, structured form cards/rows using `<FormField>` / `<Select size="sm">` and `<NumberInput size="sm">`.
   - Clear grouping:
     - **Acid Selector**: Shared `<Select size="sm">` for Acid Type.
     - **Mash Acidification Card**: `Target pH` input + `Dosage` (`ml` or `g`) input, gated on `Mash` toggle.
     - **Sparge Acidification Card**: `Target pH` input + `Dosage` (`ml` or `g`) input, gated on `Sparge` toggle.
     - **Total Acid Addition**: Dedicated live summary indicator.
   - All input controls maintain standard design system heights (32px / `size="sm"`), consistent label alignment (`text-xs text-slate-400 font-medium`), and eliminate cramped fixed-width label truncation.
4. **`components/ui/` Primitives Adoption:**
   - Replaces all raw buttons with `<Button variant="primary" | "secondary" | "icon" size="sm">`.
   - Replaces all `<select>` dropdowns with `<Select size="sm">`.
   - Replaces all raw number inputs with `<NumberInput size="sm" align="right" addonRight="...">`.
5. **`designTokens.test.ts` & `WaterCalculatorModal.test.tsx` Reconciliation:**
   - Removes the `WaterCalculatorModal.tsx` AC-13 token-import row in `designTokens.test.ts`.
   - Reconciles `WaterCalculatorModal.test.tsx` and `FermentableSection.test.tsx` occurrence pins to adoption assertions.

---

## Key Behaviors & Architecture

1. `apps/web/src/components/WaterCalculatorModal.tsx`:
   - Imports `Button`, `Select`, `NumberInput` from `./ui`.
   - **Header Toolbar**: Contains title, initial/adjusted pH pills, `Reset` button, unified `AUTO` button, and `Close` button.
   - **Unified `handleAutoAdjustAll`**:
     - Calculates suggested salt additions via `suggestSaltAdditions(source, target, totalVolumeL)` and allocates across mash/sparge according to `treatSpargeWater`.
     - Calculates mash acid dosage via `calculateAcidAdditions` when `addMashAcid` is true.
     - Calculates sparge acid dosage via `calculateSpargeAcid` when `addSpargeAcid` is true.
   - **Minerals Needed Table**:
     - Columns: `Mineral (26%)`, `Needed (16%)`, `Mash (22%)`, `Sparge (22%)`, `Total (14%)`.
     - Number inputs use `width="lg"` and `align="right"` with `addonRight="g"`.
   - **Acid Adjustments Section**:
     - Renders Acid Type selector, followed by side-by-side or responsive grid for Mash and Sparge acidification, displaying `Target pH` and calculated/manual `Dosage` side by side with proper label hierarchy.
2. **Backward Compatibility & Regression Invariants**:
   - `data-testid`s preserved: `water-reset-btn`, `water-auto-btn`, `treat-sparge-water-toggle`, `add-mash-acid-toggle`, `add-sparge-acid-toggle`, `mineral-needed-*`, `modal-initial-mash-ph`, `modal-predicted-mash-ph`, `save-water-adjustments-btn`.
   - `onSaveAdjustments` payload structure strictly identical.

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added, modified, or deleted.

**RA-2 — `Modal.tsx` Shell Remains Read-Only.**
`Modal.tsx` is the container shell hardened in M25 and remains read-only.

**RA-3 — Global Header `AUTO` Button Action.**
Clicking the header `AUTO` button executes `handleAutoAdjustAll`:
1. If `target` water profile is selected, optimizes mineral salts for mash and sparge (respecting `treatSpargeWater`).
2. Recalculates and sets `mashAcidAmount` to match `targetMashPh` if `addMashAcid` is enabled.
3. Recalculates and sets `spargeAcidAmount` to match `targetSpargePh` if `addSpargeAcid` is enabled.

**RA-4 — Native Checkboxes Exempt from Primitive Sweep.**
The 3 toggle checkboxes (`treatSpargeWater`, `addMashAcid`, `addSpargeAcid`) remain native `<input type="checkbox">` elements.

**RA-5 — Control Dimensions & Alignment.**
All number inputs in the modal use `size="sm"` with explicit `width="lg"` (`w-20`) for salt doses and `width="md"` (`w-16`) for pH / acid doses, with `align="right"`.

**RA-6 — `FermentableSection.test.tsx` Pin Reconciliation.**
Updates the two global pins: AC-3 `width="lg"` count (1 → 3) and AC-22 `${INPUT_CLASS} font-mono tabular-nums` count (13 → 7).

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_PLANNING` | Milestone 34 Phase 3 migrates `WaterCalculatorModal.tsx` onto `components/ui/`. |
| **FEAT-005** — App-Wide UI/UX Redesign | `IN_PLANNING` | Unified dialog form controls and button styling continue. |
| **FEAT-028** — Water Chemistry Modal Layout & Auto UX | `IN_PLANNING` | Consolidated auto calculation and balanced table column distribution. |

---

## Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | `designSystem.ts` and `Modal.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. |
| **AC-2** | Header Reset button renders via `<Button variant="secondary" size="sm">` | Component Test | `data-testid="water-reset-btn"` retained, click calls `handleReset`. |
| **AC-3** | Header AUTO button renders via `<Button variant="secondary" size="sm">` and automates both salts and acid dosages | Component Test | `data-testid="water-auto-btn"` retained, click calculates both mineral salts and acid additions. |
| **AC-4** | Header Close button renders via `<Button variant="icon">` | Component Test | `aria-label="Close"`, click dispatches `onClose`. |
| **AC-5** | Source Water Profile renders via `<Select size="sm">` | Component Test | `id="waterSourceSelect"`, `aria-label="Source Profile"`, options render. |
| **AC-6** | Target Water Profile renders via `<Select size="sm">` | Component Test | `id="waterTargetSelect"`, `aria-label="Target Profile"`, options render. |
| **AC-7** | Minerals Needed table columns align symmetrically with `<NumberInput width="lg" align="right" addonRight="g">` | Component Test | Table headers and cells align properly across Needed, Mash, Sparge, and Total. |
| **AC-8** | Sparge salt inputs respect `disabled={!treatSpargeWater}` gating | Component Test | Disabling sparge zeroes sparge amounts and disables inputs. |
| **AC-9** | Acid Type renders via `<Select size="sm">` | Component Test | `id="acidTypeSelect"`, `aria-label="Acid Type"`. |
| **AC-10** | Target Mash pH and Dosage render via `<NumberInput>` with `disabled={!addMashAcid}` | Component Test | `id="targetMashPhInput"`, `id="mashAcidDosageInput"`, addon g/ml reflects acid type. |
| **AC-11** | Target Sparge pH and Dosage render via `<NumberInput>` with `disabled={!addSpargeAcid}` | Component Test | `id="targetSpargePhInput"`, `id="spargeAcidDosageInput"`, addon g/ml reflects acid type. |
| **AC-12** | Total Acid addition displays live computed sum of active mash and sparge acid | Component Test | Reactively reflects active additions and units (`ml` or `g`). |
| **AC-13** | Footer Cancel button renders via `<Button variant="secondary" size="sm">` | Component Test | Click dispatches `onClose`. |
| **AC-14** | Footer Save Adjustments button renders via `<Button variant="primary" size="sm">` | Component Test | `data-testid="save-water-adjustments-btn"` retained, click saves payload. |
| **AC-15** | Zero raw `<button>`, zero raw `<select>`, and zero raw text/number `<input>` in `WaterCalculatorModal.tsx` | Static Sweep | `WaterCalculatorModal.tsx` passes adoption sweep. |
| **AC-16** | `designTokens.test.ts` AC-13 row for `WaterCalculatorModal` removed | Existing Test | `designTokens.test.ts` passes. |
| **AC-17** | `WaterCalculatorModal.test.tsx` reconciled and passing | Existing Tests | 100% green. |
| **AC-18** | `FermentableSection.test.tsx` AC-3 and AC-22 pins updated (RA-6) | Existing Test | `FermentableSection.test.tsx` passes. |
| **AC-19** | M25 Modal shell invariants pass unmodified | Existing Tests | `Modal.test.tsx` 100% pass. |
| **AC-20** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Authorized files only modified. |
| **AC-21** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,201 passed across 121 files). |
| **AC-22** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0. |
| **AC-23** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-24** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |

---

## Scope Guardrail — Authorized Files

### Authorized to Modify (5 files)
1. `apps/web/src/components/WaterCalculatorModal.tsx`
2. `apps/web/test/uiPrimitives.test.tsx`
3. `apps/web/test/designTokens.test.ts`
4. `apps/web/test/WaterCalculatorModal.test.tsx`
5. `apps/web/test/FermentableSection.test.tsx`

### Explicitly Forbidden
- `apps/web/src/components/designSystem.ts`
- `apps/web/src/components/Modal.tsx`
- `apps/web/src/components/ui/*`
- `packages/**`, `apps/api/**`
- All other dialog and panel files.

---

## Layer 1 Command Gates

```bash
npm test
npm run typecheck
npm run build
npm run lint
```

---

## Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
