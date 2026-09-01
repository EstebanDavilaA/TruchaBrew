# FEATURE SPECIFICATION: M37_P2 — Target Auto-Tuning UI, Fit Score Visualization & WaterCalculatorModal Integration

> **Milestone 37:** "Multi-Ion Water Chemistry Solver & Target Tuning" (`.gsd/ROADMAP.md`)
> **Phase 2 of 2 (Milestone Closure).** Integrates the bounded multi-ion water chemistry solver into `WaterCalculatorModal.tsx`, providing a live profile match fit score badge/bar ($0-100\%$), dynamic Sulfate-to-Chloride flavor ratio badge ($SO_4^{2-}:Cl^-$), interactive "Auto-Optimize Dosing" action with balance strategy presets (Balanced, Crisp Hop-Forward, Malty/Full), live per-ion delta indicators with `<Badge>`, and closing milestone quality gates.

---

## Phase Summary

Milestone 37 Phase 1 delivered the pure mathematical bounded multi-ion optimization engine in `@truchabrew/calculations`. Phase 2 now integrates this engine into the primary brewing water UI:

1. **Water Calculator Modal Solver Integration (`apps/web/src/components/WaterCalculatorModal.tsx`):**
   - Wires `optimizeWaterProfile` into the "Auto" dosing button (`data-testid="water-calc-auto-dose-btn"`).
   - Automatically populates mash and sparge salt amounts ($CaCl_2$, $CaSO_4$, $MgSO_4$, $NaCl$, $NaHCO_3$) proportionally based on mash and sparge water volumes.
2. **Live Fit Score & Match Rating Indicator (`WaterCalculatorModal.tsx`):**
   - Renders a prominent Profile Fit Score bar/badge in the modal header/summary strip:
     - **$ge 90\%$:** Emerald badge / green bar (*"Excellent Match"*).
     - **$75-89\%$:** Amber badge / amber bar (*"Good Match"*).
     - **$<75\%$:** Slate badge / neutral bar (*"Approximate Match"*).
3. **Sulfate-to-Chloride Flavor Ratio Tag (`WaterCalculatorModal.tsx`):**
   - Displays real-time $SO_4^{2-}:Cl^-$ ratio with descriptive brewing impact:
     - $> 2.0$: *"Very Bitter / Dry"* (West Coast IPA, Pale Ale).
     - $1.3 - 2.0$: *"Crisp / Hop-Forward"* (Pilsner, Amber Ale).
     - $0.8 - 1.3$: *"Balanced"* (Kölsch, Stout).
     - $< 0.8$: *"Full / Malty / Soft"* (NEIPA, Hazy Pale, Porter).
4. **Per-Ion Visual Delta Indicators (`WaterCalculatorModal.tsx`):**
   - Ion table displays Target vs Adjusted (Source + Additions) vs Delta (ppm).
   - In-range values ($pm 5\text{ ppm}$) display an emerald badge; overshoots and shortfalls display clear signed deltas (`+12 ppm`, `-8 ppm`).
5. **Quality Gates & Invariants:**
   - Component and integration tests in `apps/web/test/WaterCalculatorModal.test.tsx` and `apps/web/test/WaterCalculatorIntegration.test.tsx`.
   - Adherence to design system primitives (all inputs use `<NumberInput addonRight="g">`, all badges use `<Badge>`, modal uses standard `<Modal>` container).

---

## Acceptance Criteria Matrix (22 ACs)

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Auto-Optimize Button | Clicking "Auto-Optimize" (`data-testid="water-calc-auto-dose-btn"`) executes `optimizeWaterProfile` and populates salt inputs. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-2** | Multi-Salt Population | Auto-optimize populates Gypsum, Calcium Chloride, Epsom Salt, Table Salt, and Baking Soda fields without manual calculations. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-3** | Proportional Mash/Sparge Split | When both mash and sparge volumes exist, salt additions are distributed proportionally to water volume. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-4** | Live Fit Score Badge | Modal renders a live Profile Fit Score badge (`data-testid="water-calc-fit-score"`) showing percentage match ($0-100\%$). | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-5** | Fit Score Semantic Colors | Fit score badge adopts emerald palette for $\ge 90\%$, amber for $75-89\%$, and slate for $<75\%$. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-6** | Sulfate/Chloride Ratio Display | Modal renders live $SO_4^{2-}:Cl^-$ ratio tag (`data-testid="water-calc-so4-cl-ratio"`) with flavor balance description. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-7** | Per-Ion Target Match Badges | Each of the 6 core ions displays a target alignment badge showing delta or "Target Matched". | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-8** | Interactive Salt Adjustment | Manually typing in salt inputs immediately updates ion concentrations, deltas, ratio, and fit score live. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-9** | Calcium Overshoot Guardrail | Auto-optimizing on a target with 150 ppm Cl and 150 ppm SO4 yields Calcium $\le 185\text{ ppm}$ on screen. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-10** | Reset Action | Clicking Reset (`data-testid="water-calc-reset-btn"`) clears all salts and acids to 0.00g and recalculates base score. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-11** | Save to Recipe Action | Clicking "Save to Recipe" (`data-testid="water-calc-save-btn"`) commits salt/acid additions to recipe miscs and closes modal. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-12** | Acid Volume Calculation | Mash and sparge acid additions calculate required mL (Lactic 88% / Phosphoric 75%) based on target mash pH. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-13** | Soft Water Preservation | Auto-optimizing against a soft Pilsen profile applies minimal salt additions without salt over-dosing. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-14** | Responsive Modal Grid | Water chemistry table and controls render cleanly without horizontal overflow or clipped text on intermediate screens. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-15** | Primitive Adherence | All buttons, number inputs, badges, and cards inside `WaterCalculatorModal.tsx` use `components/ui/` primitives (0 raw elements). | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-16** | Scope Guardrail | Pre/post SHA-256 manifest verifies only authorized files modified, 0 deleted. | Manifest comparison |
| **AC-17** | Bug Closure Invariant | `BUG-024` in `.gsd/BUGS.md` is verified resolved by end-to-end user workflow. | `.gsd/BUGS.md` inspection |
| **AC-18** | Layer 1 Gate: Tests | Full test suite passes without reduction (>= 2,374 tests passing across 126 files). | `npm test` (exit 0) |
| **AC-19** | Layer 1 Gate: Typecheck | All 4 workspaces pass typecheck with 0 errors. | `npm run typecheck` (exit 0) |
| **AC-20** | Layer 1 Gate: Build | Production client bundle builds cleanly in <1.2s. | `npm run build` (exit 0) |
| **AC-21** | Layer 1 Gate: Lint | Monorepo linter passes with 0 errors. | `npm run lint` (exit 0) |
| **AC-22** | Design Token Guarantee | `uiPrimitives.test.tsx` DOM scanner asserts 0 raw un-abstracted form elements across the app. | `apps/web/test/uiPrimitives.test.tsx` |

---

## Resolved Ambiguities (Binding)

**RA-1 — Auto-Dosing Mash vs Sparge Proportions.**
When both Mash Volume ($V_{\text{mash}}$) and Sparge Volume ($V_{\text{sparge}}$) are defined:
- $V_{\text{total}} = V_{\text{mash}} + V_{\text{sparge}}$
- Total optimal salt $g_{\text{total}}$ is computed on $V_{\text{total}}$.
- $g_{\text{mash}} = g_{\text{total}} \times \frac{V_{\text{mash}}}{V_{\text{total}}}$
- $g_{\text{sparge}} = g_{\text{total}} \times \frac{V_{\text{sparge}}}{V_{\text{total}}}$
- Both amounts are rounded to 2 decimal places ($0.01\text{ g}$).

**RA-2 — Visual Fit Score Classification.**
- Percentage $\ge 90.0\%$: `<Badge variant="emerald">` with text `Fit: {score}% (Optimal)`.
- Percentage $75.0\% - 89.9\%$: `<Badge variant="amber">` with text `Fit: {score}% (Good)`.
- Percentage $< 75.0\%$: `<Badge variant="slate">` with text `Fit: {score}% (Approx)`.

**RA-3 — Spec-gap amendments (executor, 2026-08-31).** Two reconciliations were required that the Authorized-Files list did not name:
1. **`packages/calculations/src/waterOptimization.ts` gained an optional `weights` override** on `optimizeWaterProfile`/`solveOptimalSalts` (and threaded through `objective`/`fitScore`). This is how the balance-strategy presets (Balanced / Crisp Hop-Forward / Malty/Full) bias the solver — the spec's Phase Summary mandates the presets but its Authorized list omits the solver file. The change is backward-compatible: `weights` is optional, defaults to the existing `ION_WEIGHTS`, and all M37_P1 tests pass unmodified (54/54).
2. **`apps/web/test/WaterSection.test.tsx` testid references reconciled** to the spec's new testids (`water-auto-btn`→`water-calc-auto-dose-btn`, `water-reset-btn`→`water-calc-reset-btn`, `save-water-adjustments-btn`→`water-calc-save-btn`) and the SO4:Cl ratio label moved to the `water-calc-so4-cl-ratio` badge. This file routes through the modal and pinned the old testids; the spec's AC-1..AC-3 mandate the new ones, so the old pins were stale. No behavioral assertion changed — only testid/label references. Same consequence-pin class as M37_P1 RA-3.

---

## Authorized Files to Modify

- `apps/web/src/components/WaterCalculatorModal.tsx`
- `apps/web/test/WaterCalculatorModal.test.tsx`
- `apps/web/test/uiPrimitives.test.tsx`
- `.gsd/STATE.json`
- `.gsd/BUGS.md`

---

## Halt Gate (State 2)

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
