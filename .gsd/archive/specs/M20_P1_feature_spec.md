# FEATURE SPECIFICATION: M20_P1 - Dedicated Packaging Stage Tab & Completed Stage Re-alignment (Refinement 2)

**Milestone:** 20 — Dedicated Packaging Stage Tab & Completed Stage Re-alignment  
**Phase:** 1 (of 1 estimated)  
**Features formalized:** `FEAT-016`  
**Refinement:** Option A Refinement 2 (Harmonize and elevate stats summary blocks to the top of each batch stage tab for visual cohesion)  
**Bugs absorbed:** none  

---

## Phase Summary

Introduce a dedicated 5th batch stage tab `Packaging` in `BatchDetail.tsx` and `BatchStageTabs.tsx` (`FEAT-016`), establishing a specialized 5-stage batch workflow with a cohesive top-level stats summary hierarchy across every stage:
$$\text{Planning} \longrightarrow \text{Brewing} \longrightarrow \text{Fermentation} \longrightarrow \text{Packaging} \longrightarrow \text{Completed}$$

### Refinement Scope (Option A — Refinement 2):
1. **App-Wide Stage Stats Cohesion:**
   - **`Brewing` Tab:** Elevate the brewing vitals stats tiles (`Mash Efficiency (live)`, `Brewhouse Efficiency (est.)`, `Predicted Mash pH`) to the top of the tab (above `BrewDayTracker`), providing immediate high-level visibility on efficiency and predicted pH before brew timeline controls.
   - **`Packaging` Tab:** Top stats & temperature grid (`Final Gravity`, `ABV`, `Packaging Volume (L)`, and `Carbonation/Storage Temp (°C)` input) placed above `SplitPackagingPanel`, with redundant "Packaging Measurements" card eliminated.
   - **`Fermentation` Tab:** Live vitals tiles (`Apparent Attenuation`, `Live ABV`, `Current Gravity`, `Current Temp / Pressure`) at the top above cellar schedule and logs.
   - **`Planning` Tab:** 2-column layout with Batch Recipe card and Water Summary row.
   - **`Completed` Tab:** Top `Measured vs. Estimated` vitals comparison with calibration trigger.
2. **5-Stage Navigation (`FEAT-016` §1):** Maintain `BatchStageTab` 5 distinct tabs (`'planning' | 'brewing' | 'fermentation' | 'packaging' | 'completed'`).
3. **Stage Segregation (`FEAT-016` §2):**
   - **`Packaging` Tab (Mapped to `Conditioning` status):** Houses the top Stats & Temperature row, `SplitPackagingPanel` (bottling/kegging split calculations, priming sugar syrup calculator, syringe dosing, keg PSI), and in-tab transition button `↳ Change Status to Packaging` (when `status !== 'Conditioning'`).
   - **`Completed` Tab (Mapped to `Completed` status):** Dedicated post-conditioning review focusing on `SensoryEvaluationPanel` (5-axis BJCP tasting score breakdown, 0–50 quality tiers, 1–5 star rating sync, tasting notes), `PostBrewCalibrationModal` (post-brew equipment losses and recipe efficiency calibration), `MeasuredComparison` (target vs. actual vitals comparison), `BatchCostPanel`, and `BatchNutritionPanel`.

---

## 1. Resolved Ambiguities & Binding Domain Contracts

1. **`BatchStageTab` Union & Order:**
   - `export type BatchStageTab = 'planning' | 'brewing' | 'fermentation' | 'packaging' | 'completed';`
   - `TAB_ORDER: readonly BatchStageTab[] = ['planning', 'brewing', 'fermentation', 'packaging', 'completed'];`
   - `TAB_LABEL: Record<BatchStageTab, string>`:
     - `planning`: `'Planning'`
     - `brewing`: `'Brewing'`
     - `fermentation`: `'Fermentation'`
     - `packaging`: `'Packaging'`
     - `completed`: `'Completed'`
2. **Tab-to-Status and Status-to-Label Mapping in `BatchDetail.tsx`:**
   - `TAB_TO_STATUS: Record<BatchStageTab, BatchStatus>`:
     - `planning`: `'Planning'`
     - `brewing`: `'Brewing'`
     - `fermentation`: `'Fermenting'`
     - `packaging`: `'Conditioning'`
     - `completed`: `'Completed'`
   - `STATUS_TO_TAB_LABEL: Record<BatchStatus, string>`:
     - `Planning`: `'Planning'`
     - `Brewing`: `'Brewing'`
     - `Fermenting`: `'Fermentation'`
     - `Conditioning`: `'Packaging'`
     - `Completed`: `'Completed'`
3. **Stage Layout and Hierarchy Contract:**
   - **`brewing` tab renders:**
     - Top row: Brew Sheet toggle button (when clicked, renders `BrewSheet`).
     - Top Stats Summary Grid (`data-testid="brewing-stats-summary"`):
       - Mash Efficiency (live) tile (`liveMashEfficiencyPct !== null ? `${liveMashEfficiencyPct.toFixed(1)}%` : '—'`)
       - Brewhouse Efficiency (est.) tile (`${batch.recipeSnapshot.equipment.brewhouseEfficiencyPct}%`)
       - Predicted Mash pH tile (`predictedMashPh !== null ? predictedMashPh.toFixed(2) : '—'`)
     - `BrewDayTracker` (timeline bar, active step, checklist, audio cues, timers).
     - `Brew Day Measurements` card (pre-boil gravity, mash pH, boil size, boil time, OG).
   - **`packaging` tab renders:**
     - Top Stats & Temperature Summary Grid (`data-testid="packaging-stats-summary"`):
       - Final Gravity metric tile (`measuredFigures.finalGravity !== null ? measuredFigures.finalGravity.toFixed(3) : '—'`)
       - ABV metric tile (`measuredFigures.abv !== null ? `${measuredFigures.abv.toFixed(1)}%` : '—'`)
       - Packaging Volume (L) metric tile (`measuredFigures.beerVolumeL !== null ? measuredFigures.beerVolumeL.toFixed(1) : '—'`)
       - Carbonation/Storage Temperature input (`id="carbonationTempC"` / `data-testid="packaging-carbonation-temp"`).
     - `SplitPackagingPanel` (`data-testid="split-packaging-panel"`).
     - In-tab transition button when `batch.status !== 'Conditioning'`: `↳ Change Status to Packaging` (which persists `status: 'Conditioning'`).
   - **`completed` tab renders:**
     - `data-testid="batch-tab-panel-completed"`:
       - `SensoryEvaluationPanel`
       - Post-Brew Equipment & Target Calibration trigger button (`data-testid="open-calibration-modal-btn"`) opening `PostBrewCalibrationModal`
       - `MeasuredComparison` component (displaying estimated vs. actual vitals)
       - `BatchCostPanel`
       - `BatchNutritionPanel`
       - In-tab transition button when `batch.status !== 'Completed'`: `↳ Change Status to Completed` (which persists `status: 'Completed'`).
4. **Handoffs Between Stages:**
   - `handleAdvanceToConditioning` in `BatchDetail.tsx` updates batch status to `Conditioning` and switches active tab to `'packaging'`.
5. **Pure Pure-View State Invariant:**
   - Clicking tabs in `BatchStageTabs` updates only local `activeTab` view state; it never mutates batch state or triggers API calls without clicking explicit action buttons.

---

## 2. Data Schema & Code Modification Contracts

### 2.1 Untouched Modules (Explicit)
- `packages/shared-types/src/batches.ts` — Untouched.
- `packages/calculations/` — All calculation modules remain byte-unchanged.
- `apps/api/` — Untouched.
- `apps/web/src/components/SplitPackagingPanel.tsx` — Untouched.

### 2.2 Modified Files
- `apps/web/src/components/BatchStageTabs.tsx`:
  - 5-stage tab union and order (`BatchStageTab`).
- `apps/web/src/pages/BatchDetail.tsx`:
  - In `activeTab === 'brewing'`, position the stats tiles grid (`Mash Efficiency (live)`, `Brewhouse Efficiency (est.)`, `Predicted Mash pH`) above `BrewDayTracker`.
  - In `activeTab === 'packaging'`, position top stats summary grid (Final Gravity, ABV, Packaging Volume L, Carbonation Temp input) above `SplitPackagingPanel`.
- `apps/web/test/BatchStageTabs.test.tsx`:
  - 5-stage navigation tests.
- `apps/web/test/BatchDetail.test.tsx`:
  - Update tests to verify top stats summary rendering in Brewing and Packaging tabs.

---

## 3. Acceptance Criteria Matrix

| ID | Title | Scope | Criterion |
|---|---|---|---|
| AC-1 | 5 Stage Tabs Rendered | Component | `BatchStageTabs` renders 5 clickable tabs in order: Planning, Brewing, Fermentation, Packaging, Completed. |
| AC-2 | Active Tab Styling | Component | The selected tab carries active amber styling (`bg-amber-500/10 text-amber-400`); inactive tabs carry neutral slate styling. |
| AC-3 | Pure Tab Switching | Component | Clicking tabs calls `onSelectTab` with the corresponding `BatchStageTab` without calling any API or mutating batch status. |
| AC-4 | Brewing Tab Top Stats Elevation | Component | In `activeTab === 'brewing'`, the stats summary block (Mash Efficiency, Brewhouse Efficiency, Predicted Mash pH) renders above `BrewDayTracker`. |
| AC-5 | Packaging Tab Top Stats & Temperature | Component | When `activeTab === 'packaging'`, renders `batch-tab-panel-packaging` containing top stats (Final Gravity, ABV, Packaging Volume L), Carbonation/Storage Temp (°C) input, and `SplitPackagingPanel`. |
| AC-6 | Completed Tab Panel Content | Component | When `activeTab === 'completed'`, renders `batch-tab-panel-completed` containing `SensoryEvaluationPanel`, calibration modal trigger, `MeasuredComparison`, `BatchCostPanel`, and `BatchNutritionPanel`. |
| AC-7 | Redundant Packaging Card Removed | Component | The standalone "Packaging Measurements" card and its redundant inputs are removed from the Packaging tab. |
| AC-8 | Stage Content Segregation | Component | `SplitPackagingPanel` does not render on the `completed` tab; `SensoryEvaluationPanel`, `PostBrewCalibrationModal` trigger, and `MeasuredComparison` do not render on the `packaging` tab. |
| AC-9 | Carbonation Temperature Persistence | Component | Editing `Carbonation/Storage Temp (°C)` on the Packaging tab updates form state and persists to backend upon clicking `Save Changes`. |
| AC-10 | In-Tab Status Action Alignment | Component | In-tab status transition buttons render when tab stage does not match batch status (`↳ Change Status to Packaging` on Packaging tab, `↳ Change Status to Completed` on Completed tab). |
| AC-11 | Four Gates Clean | Gate | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all pass clean with exit code 0. |

---

## 4. Scope Guardrail Allowlist

Only these paths may be modified or created:
```
apps/web/src/components/BatchStageTabs.tsx
apps/web/src/pages/BatchDetail.tsx
apps/web/test/BatchStageTabs.test.tsx
apps/web/test/BatchDetail.test.tsx
```

All other files across `packages/` and `apps/` must remain untouched.

---

# ⛔ HALT GATE — SPEC APPROVAL REQUIRED

Review this feature specification. Reply with `SPEC_APPROVED` to begin execution.
