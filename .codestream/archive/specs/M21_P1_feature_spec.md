# FEATURE SPECIFICATION: M21_P1 - Dedicated Water Chemistry & Acid Calculator Modal (FEAT-012, FEAT-001)

**Milestone:** 21 — Dedicated Water Chemistry & Acid Calculator Modal  
**Phase:** 1 (of 1 estimated)  
**Features formalized:** `FEAT-012`, `FEAT-001`  
**Refinement:** Initial draft  
**Bugs absorbed:** none  

---

## Phase Summary

Deliver a dedicated, full-featured Water Chemistry & Acid Adjustments Modal (`WaterCalculatorModal.tsx`) and replace the bulky inline `WaterSection` card in the Recipe Designer with a slim Brewfather-style recipe summary line (`WaterSection.tsx`). 

The summary row presents water volume totals, source/target profile chips, finished ion concentrations, and an interactive `pH X.XX [CALC]` badge that opens the modal. Inside the modal, brewers can inspect grist distilled baseline pH, configure source dilution (RO/distilled), select target profiles, dose mineral salts independently for mash vs. sparge water, calculate exact acid additions (Lactic 88%, Phosphoric 75%, Acidulated Malt) to hit target mash and sparge pH levels, and atomically commit changes back to the recipe via "Save Adjustments to Recipe".

---

## 1. Resolved Ambiguities & Binding Domain Contracts

1. **Recipe Designer Water Summary Row (`WaterSection.tsx`):**
   - Renders a compact, single-card summary row matching the visual density of the recipe builder:
     - **Volumes:** Mash Water (L), Sparge Water (L @ Sparge Temp °C), Total Water (L), Total Mash Volume (L).
     - **Active Profiles & Finished Ions:** Source profile name chip, Target profile name chip, and live finished ion concentrations ($Ca^{2+}, Mg^{2+}, Na^+, Cl^-, SO_4^{2-}, HCO_3^-$ in ppm).
     - **Interactive Trigger Badge:** Prominent right-aligned `pH X.XX [CALC]` / `Water & Acid Calculator` button (`data-testid="open-water-calc-modal-btn"`), opening the modal.
2. **Dedicated Water Calculator Modal (`WaterCalculatorModal.tsx`):**
   - **Header & Live Predicted Mash pH:**
     - Displays live predicted mash pH badge (color-coded: emerald for $5.20 \le \text{pH} \le 5.60$, amber otherwise).
     - `Reset` button (`RESTABLECER` / `data-testid="water-reset-btn"`) to clear all salt and acid adjustments back to zero.
     - `Auto-adjust` button (`AUTO` / `data-testid="water-auto-btn"`) to automatically calculate recommended salt grams to match target profile ions.
   - **Grist Distilled Baseline pH Breakdown:**
     - Lists recipe fermentables with mass (kg), color (EBC), and their calculated distilled-water pH contribution, showing the base grist DI mash pH.
   - **Source Profile & Dilution:**
     - Source water profile selector with ion ppm display ($Ca, Mg, Na, Cl, SO_4, HCO_3$).
     - Dilution slider (0% to 100% distilled / RO water), scaling source baseline ions proportionally:
       $$\text{Ion}_{\text{diluted}} = \text{Ion}_{\text{source}} \times \left(1 - \frac{\text{Dilution}\%}{100}\right)$$
   - **Target Profile & Sulfate/Chloride Ratio:**
     - Target water profile selector with ion goal ranges.
     - Live Sulfate-to-Chloride ratio indicator:
       - Ratio $> 2.0$: "Very Bitter / Dry"
       - $1.3 \le \text{Ratio} \le 2.0$: "Bitter / Crisp"
       - $0.8 \le \text{Ratio} < 1.3$: "Balanced"
       - $0.5 \le \text{Ratio} < 0.8$: "Malty / Full"
       - Ratio $< 0.5$: "Very Malty"
   - **Independent Mineral Additions (Mash vs. Sparge):**
     - Independent gram inputs for Gypsum ($CaSO_4$), Calcium Chloride ($CaCl_2$), Epsom Salt ($MgSO_4$), Table Salt ($NaCl$), Baking Soda ($NaHCO_3$).
     - Separate sections for **Mash Water Additions** and **Sparge Water Additions**.
     - Live ion comparison table: Source ppm $\rightarrow$ Added ppm $\rightarrow$ Finished ppm vs. Target ppm (with delta badges).
   - **Acid Adjustments (Mash & Sparge):**
     - **Mash Acid Adjustment:**
       - Target Mash pH input (default `5.30`, bounded $4.80 - 6.00$).
       - Acid selection: Lactic Acid 88% (mL), Phosphoric Acid 75% (mL), or Acidulated Malt (g).
       - Live calculated required acid dosage to achieve target pH from post-salts mash pH.
     - **Sparge Water Acid Adjustment:**
       - Sparge target pH (default `5.50`, recommended range $5.40 - 5.80$ to prevent polyphenol/tannin extraction).
       - Acid selection & calculated dosage for sparge water volume.
   - **Atomic Commit ("Save Adjustments to Recipe"):**
     - Clicking "Save Adjustments to Recipe" (`GUARDE AJUSTES A LA RECETA` / `data-testid="save-water-adjustments-btn"`):
       - Converts active salts into recipe `miscs` items with `type: 'WaterAgent'`, setting `use: 'Mash'` for mash additions and `use: 'Sparge'` for sparge additions.
       - Converts calculated acid additions into recipe `miscs` items with `type: 'WaterAgent'`, `use: 'Mash'` or `use: 'Sparge'`.
       - Emits updated `miscs`, `waterSourceId`, and `waterTargetId` to recipe state in a single atomic update.
       - Closes modal and updates the summary row.
3. **Pure Calculation Engine Extensions (`packages/calculations/src/water.ts`):**
   - Ensure pure helper functions support:
     - Diluted source ion calculations.
     - Separate mash vs. sparge ion contributions and finished combined ion ppm.
     - Sparge acid neutralization calculation (acid required to lower sparge water alkalinity to target sparge pH).

---

## 2. Data Schema & Code Modification Contracts

### 2.1 Untouched Modules (Explicit)
- `packages/shared-types/src/batches.ts` — Untouched.
- `apps/api/` — Untouched.
- `apps/web/src/pages/BatchDetail.tsx` — Untouched.

### 2.2 Modified & New Files
- `packages/calculations/src/water.ts`:
  - Export pure helper functions for water dilution, separate mash/sparge ion rollups, and sparge acid requirements.
- `packages/calculations/test/water.test.ts`:
  - Unit tests covering dilution, split mash/sparge mineral dosing, and sparge acid calculations.
- `apps/web/src/components/WaterCalculatorModal.tsx` (NEW):
  - Full modal dialog with grist baseline breakdown, source dilution, target profile, mash & sparge salt inputs, acid additions, and commit action.
- `apps/web/src/components/WaterSection.tsx`:
  - Refactor to render compact summary row and manage `WaterCalculatorModal` open/close state.
- `apps/web/test/WaterSection.test.tsx` / `apps/web/test/WaterCalculatorModal.test.tsx`:
  - Component tests verifying summary row rendering, modal trigger, live calculations, auto-adjust, and atomic commit to recipe miscs.

---

## 3. Acceptance Criteria Matrix

| ID | Title | Scope | Criterion |
|---|---|---|---|
| AC-1 | Compact Recipe Water Summary | Component | `WaterSection` renders compact summary row showing water volumes, active profile chips, finished ions, and `[CALC] / pH X.XX` trigger button. |
| AC-2 | Water Calculator Modal Trigger | Component | Clicking `[CALC] / pH X.XX` badge in `WaterSection` opens `WaterCalculatorModal` (`data-testid="water-calc-modal"`). |
| AC-3 | Live Predicted Mash pH Header | Component | Modal header displays live predicted mash pH badge dynamically updating when salts, acid, or dilution change. |
| AC-4 | Grist Distilled pH Breakdown | Component | Modal displays table of recipe fermentables with mass, EBC, and distilled water pH baseline contribution. |
| AC-5 | Source Water Dilution Slider | Component | Adjusting dilution slider (0–100%) scales source profile ions proportionally in live calculations. |
| AC-6 | Target Profile & SO4/Cl Ratio | Component | Selecting target profile displays target ion ranges and live Sulfate-to-Chloride ratio descriptor (e.g. "Bitter / Crisp", "Balanced"). |
| AC-7 | Independent Mash & Sparge Salts | Component | Independent gram inputs for Gypsum, CaCl2, Epsom Salt, Table Salt, Baking Soda with separate Mash vs. Sparge allocation. |
| AC-8 | Auto-Adjust Salts | Component | Clicking `AUTO` calculates and populates mineral salt additions to minimize delta against selected target profile ions. |
| AC-9 | Mash & Sparge Acid Dosages | Component | Acid calculators compute exact dosage (Lactic 88%, Phosphoric 75%, Acidulated Malt) to reach target mash pH and target sparge pH. |
| AC-10 | Atomic Commit to Recipe Miscs | Component | Clicking "Save Adjustments to Recipe" writes salts and acids to recipe `miscs` with appropriate `use: 'Mash'` and `use: 'Sparge'` and closes modal. |
| AC-11 | Four Gates Clean | Gate | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all pass clean with exit code 0. |

---

## 4. Scope Guardrail Allowlist

Only these paths may be modified or created:
```
packages/calculations/src/water.ts
packages/calculations/test/water.test.ts
apps/web/src/components/WaterCalculatorModal.tsx
apps/web/src/components/WaterSection.tsx
apps/web/test/WaterCalculatorModal.test.tsx
apps/web/test/WaterSection.test.tsx
```

All other files across `packages/` and `apps/` must remain untouched.

---

# ⛔ HALT GATE — SPEC APPROVAL REQUIRED

Review this feature specification. Reply with `SPEC_APPROVED` to begin execution.
