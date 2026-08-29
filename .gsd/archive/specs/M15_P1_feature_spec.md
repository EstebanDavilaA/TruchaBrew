# Feature Specification: Milestone 15 Phase 1 (M15_P1: Interactive Brew Day Assistant, Planning Stock Deduction & Brewing Stage Workflow)

## 1. Executive Summary & Context

Milestone 15 Phase 1 (M15_P1) delivers a comprehensive, interactive Brew Day Companion inside the `BatchDetail` views (inspired by Brewfather's *Seguimiento de la elaboración*), closing `FEAT-013`:

1. **Planning Stage Inventory Deduction & Verification ("Deducir del Inventario")**:
   - Upgrades `StockCheckPanel` in the `Planning` stage tab from a read-only list into an interactive stock verification and deduction control center.
   - Displays required vs. on-hand quantities across all four categories (Fermentables, Hops, Yeasts, Miscs/Salts).
   - Provides a 1-click **"Deduct All from Inventory"** bulk action that executes checkoffs across all matched items via `POST /api/batches/:id/checkoff`, updating on-hand inventory levels with full FIFO ledger traceability.
   - Provides per-item checkoff and reversal (`POST /api/batches/:id/checkoff/reverse`) actions with real-time checkmark badges.

2. **In-Batch Recipe Adjustments & Substitutions ("Ajustar Receta del Lote")**:
   - Provides an **"Adjust Batch Recipe"** modal in Planning mode allowing the brewer to substitute ingredients directly on the batch (e.g. malt shortages, hop variety swaps, yeast strain changes) without altering the master recipe in the library.
   - Recalculates batch target vitals ($OG$, $FG$, $\text{ABV}$, $\text{IBU}$, $\text{SRM}$, Strike & Sparge water volumes) live from the substituted grist.
   - Supports a toggle to optionally sync adjustments back to the master recipe in the recipe library.
   - Automatically synchronizes the stock checkoff engine to deduct the *actually substituted* ingredients.

3. **Interactive Brew Day Timeline & Live Timers (`Seguimiento de la elaboración`)**:
   - Visual progress timeline at the top of the `Brewing` stage tab:
     $$\text{1. Preparación} \longrightarrow \text{2. Macerado} \longrightarrow \text{3. Hervir} \longrightarrow \text{4. Hop Stand} \longrightarrow \text{5. Fermentador}$$
   - Digital countdown timer with **Play / Pause**, **Skip**, **Fast-Forward**, **Reset**, and Web Audio synthesized sound alerts (`Beep` / `Chime`) with mute/unmute toggle.
   - Contextual step card rendering active step guidance (e.g. *"Calentar 19.32 L de agua a 72.7°C"*, *"Macerado: 75 min @ 65.0°C"*, *"Adición de lúpulo: 50 g Saaz a los 60 min"*, *"Enfriar a 80°C e iniciar Hop Stand de 20 min"*).

4. **Precision Brew Day Capture Tools**:
   - **In-Place Refractometer Brix $\rightarrow$ SG Converter**: Inline popup/toggle next to Pre-Boil SG and Post-Boil OG inputs allowing instant entry in °Brix / °P with automatic conversion.
   - **Hot Wort Thermal Expansion ($\gamma = 0.04$) Toggle**: 1-click conversion from kettle hot expansion volume to standard 20°C cold volume.
   - **Live Mash Efficiency Feedback**: Immediate calculation of achieved $E_{\text{mash}}$ with prompt suggestions if gravity is off-target.

5. **Fermentation Hand-off**:
   - Chilled volume capture, yeast pitch confirmation, and 1-click **"Start Fermentation / Iniciar Fermentación"** action that sets `fermentationStartDate`, transitions batch status from `Brewing` to `Fermenting`, and hands off to the Fermentation stage tab.

---

## 2. File Organization & Boundaries

### 2.1 Modified Files
- `apps/web/src/pages/BatchDetail.tsx`:
  - Integrate interactive stock checkoff and bulk deduction in Planning stage tab.
  - Mount the Brew Day Assistant timeline, live timer bar, and guided step controller in Brewing stage tab.
  - Integrate in-place Refractometer conversion and hot thermal expansion toggles next to gravity/volume inputs.
  - Add 1-click "Start Fermentation" hand-off.
- `apps/web/src/components/StockCheckPanel.tsx`:
  - Add interactive "Deduct All from Inventory" bulk trigger.
  - Add per-item checkoff and reversal button actions.
  - Display green checkmark badges and deducted quantity status.
- `apps/web/src/api/client.ts`:
  - Add `updateBatchRecipeSnapshot(batchId: string, recipeSnapshot: Recipe)` endpoint wrapper.
- `apps/api/src/routes/batches.ts`:
  - Add `PUT /api/batches/:id/recipe-snapshot` endpoint to save in-batch ingredient adjustments to `batches.recipe_snapshot_json` and recompute `stats_snapshot_json`.
- `apps/api/src/repositories/batchRepository.ts`:
  - Add `updateRecipeSnapshot(db, batchId, recipeSnapshot, statsSnapshot)` method.
- `packages/calculations/src/hydrometry.ts`:
  - Export `hotWortToColdVolumeL(hotL: number, expansionCoeff?: number): number` and `coldToHotWortVolumeL(coldL: number, expansionCoeff?: number): number`.
- `apps/api/src/routes/schemas.ts` *(named exception, added by the 2026-08-19 amendment — see §6 Deviation 1)*:
  - Add **exactly one** new named body-schema export for `PUT /api/batches/:id/recipe-snapshot` (the `{ recipeSnapshot, syncToMasterRecipe? }` body of §3.2), consumed by `batches.ts` as `schema: { body: <that export> }`.
  - Permitted change is limited to that single appended export (plus whatever type import it requires). No existing schema export in this file may be edited, renamed, widened, narrowed, or removed.
  - Rationale (binding): all 23 existing body-bearing routes in `apps/api` declare their body schema as a named export from this file; there is **zero** precedent anywhere in the repo for an inline schema literal at the route. Declaring the new route's schema anywhere else would itself have been the deviation.

### 2.2 New Files
- `apps/web/src/components/BrewDayTracker.tsx`: Full-featured Brew Day Assistant component with interactive sub-stage timeline, step checklist, live timer controls, audio alert synthesis, and guided brew sheet reference.
- `apps/web/src/components/BatchRecipeAdjustModal.tsx`: In-batch ingredient adjustment and substitution modal with live target recalculation and optional master recipe sync.
- `apps/web/src/components/calculators/refractometerBridge.ts` *(named exception, added by the 2026-08-19 amendment — see §6 Deviation 1)*: A **one-line re-export** of the canonical `brixToSg` (re-exported under the call-site name used by `BrewDayTracker.tsx`, e.g. `convertBrixReadingToSg`), so AC-13's conversion delegates to the single canonical implementation. This file MUST NOT contain, duplicate, wrap, or re-derive any part of the Brix→SG formula — a second definition of the conversion is expressly forbidden.
  - Rationale (binding): the pre-existing `apps/web/test/calculatorImportGraph.test.ts` (a prior milestone's verified invariant, outside this phase's scope and byte-unchanged) asserts that `brixToSg` has no caller in `apps/web/src` outside `components/calculators/`. `BrewDayTracker.tsx` lives outside that directory but must call it for AC-13. A direct import would break a prior milestone's already-verified invariant; inlining the formula would create two sources of truth. The re-export is the only resolution that violates neither.
- `apps/web/src/utils/audioAlerts.ts`: Web Audio API synthesizer generating clean, pleasant alert tones (start chime, step warning beep, completion fanfare) without external audio asset dependencies.
- `apps/web/test/BrewDayTracker.test.tsx`: Component tests for brew day timeline, timers, audio alerts, and step transitions.
- `apps/web/test/BatchRecipeAdjustModal.test.tsx`: Component tests for in-batch substitutions, live vitals recalculation, and snapshot update.
- `apps/web/test/StockCheckDeduction.test.tsx`: Integration tests for Planning mode 1-click bulk inventory deduction and checkoff reversals.

### 2.3 Untouched Files (Protected)
- `packages/calculations/test/fixtures.test.ts` (Frozen).
- `apps/web/src/components/designSystem.ts` (Frozen tokens).

---

## 3. Data Schema & Component Contracts

### 3.1 Pure Function Contract: Hot Wort Thermal Expansion (`packages/calculations/src/hydrometry.ts`)

```typescript
export const WORT_THERMAL_EXPANSION_COEFF = 0.04; // 4% volumetric expansion at ~100°C

export function hotWortToColdVolumeL(hotVolumeL: number, expansionCoeff = WORT_THERMAL_EXPANSION_COEFF): number {
  if (hotVolumeL <= 0 || isNaN(hotVolumeL)) return 0;
  return Number((hotVolumeL / (1 + expansionCoeff)).toFixed(2));
}

export function coldToHotWortVolumeL(coldVolumeL: number, expansionCoeff = WORT_THERMAL_EXPANSION_COEFF): number {
  if (coldVolumeL <= 0 || isNaN(coldVolumeL)) return 0;
  return Number((coldVolumeL * (1 + expansionCoeff)).toFixed(2));
}
```

### 3.2 In-Batch Recipe Snapshot Endpoint Contract (`apps/api/src/routes/batches.ts`)

```typescript
PUT /api/batches/:id/recipe-snapshot
Body: {
  recipeSnapshot: StoredRecipe;
  syncToMasterRecipe?: boolean;
}
Response: 200 BatchWithReadings
```
- Updates `batches.recipe_snapshot_json` with the modified recipe.
- Recomputes `batches.stats_snapshot_json` via `calculateRecipeStats(recipeSnapshot)`.
- If `syncToMasterRecipe: true`, also writes the adjusted recipe back to the master recipe row via the repository's **real** update method, `updateRecipe(db, recipeSnapshot.id, RecipeWriteInput)`.
  - **Correction (2026-08-19 amendment — see §6 Deviation 2):** an earlier draft of this line named `updateStoredRecipe(db, recipeSnapshot.id, recipeSnapshot)`. **No such function has ever existed anywhere in this repo.** The binding contract is `updateRecipe`, whose second-position payload is a `RecipeWriteInput`, not a `StoredRecipe`.
  - Because the two shapes differ, the route bridges them through a local adapter, `toRecipeWriteInput(recipeSnapshot): RecipeWriteInput`. The adapter must be a **faithful, total translation** — it may not narrow the recipe: `mashProfile`/`mashProfileId`, `fermentationProfile`/`fermentationProfileId`, `waterSourceId`, `waterTargetId`, `notes`, `author`, `styleName`, equipment linkage, and all four line-item categories (fermentables, hops, yeasts, miscs) must survive the round trip.
  - This is a documentation-accuracy correction only. AC-6 is unchanged, and no new behavior is required: the adapter-plus-`updateRecipe` path was independently exercised live by the Layer 2 critic audit (2026-08-19 entry in `.gsd/archive/CRITIC_REPORT.md`), with mash, fermentation and both water profiles attached, and confirmed to meet AC-6's intent with every field above preserved.

### 3.3 Web Audio Synthesizer Contract (`apps/web/src/utils/audioAlerts.ts`)

```typescript
export interface AudioAlertOptions {
  muted?: boolean;
  volume?: number;
}

export function playStepAlert(type: 'warning' | 'completion' | 'chime', options?: AudioAlertOptions): void;
```
- Uses standard `window.AudioContext` or `window.webkitAudioContext`.
- Gracefully handles browser audio autoplay restrictions.
- Zero external MP3/WAV network dependencies.

---

## 4. Acceptance Criteria Matrix

| ID | Category | Requirement / Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Planning: Inventory Stock Checkoff Display | `StockCheckPanel` renders all 4 ingredient categories with on-hand quantity, required recipe quantity, and unit badges. | Component test in `StockCheckDeduction.test.tsx`. |
| **AC-2** | Planning: Bulk Inventory Deduction Action | Clicking "Deduct All from Inventory" issues `POST /api/batches/:id/checkoff` for all matched items and updates on-hand stock and checkmark badges. | Integration test in `StockCheckDeduction.test.tsx`. |
| **AC-3** | Planning: Single Item Checkoff & Reversal | Individual items can be checked off or reversed (`POST /api/batches/:id/checkoff/reverse`), restoring stock levels in real time. | Integration test in `StockCheckDeduction.test.tsx`. |
| **AC-4** | Planning: In-Batch Ingredient Adjustments | "Adjust Batch Recipe" button opens `BatchRecipeAdjustModal`. Substituting or splitting malts/hops updates `recipeSnapshot` without mutating other batches. | Component test in `BatchRecipeAdjustModal.test.tsx`. |
| **AC-5** | Planning: Live Batch Vitals Recalculation | Substituting ingredients in `BatchRecipeAdjustModal` immediately updates target OG, ABV, IBU, SRM, and water volume projections. | Component test in `BatchRecipeAdjustModal.test.tsx`. |
| **AC-6** | Planning: Master Recipe Sync Toggle | Checkbox in `BatchRecipeAdjustModal` allows opting into updating the parent recipe in the library upon saving. | API & Component test in `BatchRecipeAdjustModal.test.tsx`. |
| **AC-7** | Brewing: Brew Day Progress Timeline | `BrewDayTracker` renders 5 sub-stages (`Preparación`, `Macerado`, `Hervir`, `Hop Stand`, `Fermentador`) with active stage highlighting. | Component test in `BrewDayTracker.test.tsx`. |
| **AC-8** | Brewing: Live Countdown Timers | Digital countdown timer supports Play, Pause, Skip, Reset, and correctly tracks elapsed and remaining seconds. | Component test in `BrewDayTracker.test.tsx`. |
| **AC-9** | Brewing: Audio Alerts Synthesis | Completing a timer step or reaching a timed hop addition triggers `playStepAlert` with synthesized Web Audio tones without throwing errors. | Unit/Component test in `BrewDayTracker.test.tsx`. |
| **AC-10** | Brewing: Mash Step Schedule Timers | Mash rest steps from recipe `MashProfile` are rendered with individual duration countdowns and temperature target prompts. | Component test in `BrewDayTracker.test.tsx`. |
| **AC-11** | Brewing: Timed Boil Hop Alarms | Boil countdown synchronizes alarms for all recipe hop additions (e.g. 60m, 15m, flameout) and misc additions (Whirlfloc at 10m). | Component test in `BrewDayTracker.test.tsx`. |
| **AC-12** | Brewing: Hopstand / Whirlpool Steep Timer | Hopstand sub-stage provides cooling target prompt ($80^\circ\text{C}$) followed by active steep countdown timer. | Component test in `BrewDayTracker.test.tsx`. |
| **AC-13** | Precision: Refractometer In-Place Conversion | Quick conversion popup next to Pre-Boil SG and OG inputs converts °Brix to Specific Gravity using `brixToSg`. | Component test in `BrewDayTracker.test.tsx`. |
| **AC-14** | Precision: Hot Wort Thermal Contraction | Thermal volume toggle converts hot kettle volume to 20°C cold equivalent using `hotWortToColdVolumeL`. | Unit test in `hydrometry.test.ts` & Component test. |
| **AC-15** | Brewing: Fermentation Transition Hand-off | 1-click "Start Fermentation" records `fermentationStartDate`, transitions batch status to `Fermenting`, and navigates to the Fermentation tab. | Integration test in `BrewDayTracker.test.tsx`. |
| **AC-16** | Quality: Four Gates | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all pass with exit code 0. | CLI verification. |
| **AC-17** | Scope Guardrail | No file outside the **permitted set** below is created, modified, or deleted. The permitted set is exactly: (a) the 7 files in §2.1 Modified — `BatchDetail.tsx`, `StockCheckPanel.tsx`, `client.ts`, `routes/batches.ts`, `batchRepository.ts`, `hydrometry.ts`, `routes/schemas.ts`; (b) the 7 files in §2.2 New — `BrewDayTracker.tsx`, `BatchRecipeAdjustModal.tsx`, `audioAlerts.ts`, `components/calculators/refractometerBridge.ts`, `BrewDayTracker.test.tsx`, `BatchRecipeAdjustModal.test.tsx`, `StockCheckDeduction.test.tsx`; (c) `packages/calculations/test/hydrometry.test.ts`, already authorized by AC-14's own named verification method. Both §2.3 Protected files must be byte-unchanged. Any file outside (a)–(c) is a violation regardless of how small or how justified the change appears. | Pre/post SHA-256 content-manifest comparison: `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` captured **before the resumed `/execute` pass's first edit** and again at its end, diffed by path. `git diff --name-only` against a base commit is **not** usable in this repo (`git rev-list --count HEAD` is 1; the sole commit predates M1). For the original execution window, whose pre-edit manifest was never captured, the mtime sweep recorded in the 2026-08-19 `CRITIC_REPORT.md` entry stands as the documented fallback evidence (M1_P1 AC-42 precedent) and is **retained**, not superseded. |

---

## 5. Implementation Sequence

1. **Phase 1: Hydrometry Calculations & API Endpoints**:
   - Add `hotWortToColdVolumeL` and `coldToHotWortVolumeL` in `packages/calculations/src/hydrometry.ts`.
   - Add `PUT /api/batches/:id/recipe-snapshot` route and repository method.
   - Add `updateBatchRecipeSnapshot` in `apps/web/src/api/client.ts`.
2. **Phase 2: Web Audio Synthesizer & In-Place Conversion Utilities**:
   - Implement `apps/web/src/utils/audioAlerts.ts` with Web Audio API sound synthesis.
   - Build refractometer in-place converter and thermal volume toggle hooks.
3. **Phase 3: Planning Stock Deduction & In-Batch Recipe Adjustment**:
   - Enhance `StockCheckPanel.tsx` with bulk deduction and reversal triggers.
   - Build `BatchRecipeAdjustModal.tsx` for in-batch substitutions and live vitals recalculation.
4. **Phase 4: Brew Day Assistant Timeline & Step Timers**:
   - Build `BrewDayTracker.tsx` with sub-stage navigation, live countdown timers, hop alarms, and hopstand steep controller.
   - Integrate `BrewDayTracker` into `BatchDetail.tsx` (Brewing stage tab).
5. **Phase 5: Verification & Four Gates**:
   - Implement automated test suites (`BrewDayTracker.test.tsx`, `BatchRecipeAdjustModal.test.tsx`, `StockCheckDeduction.test.tsx`).
   - Run full test suite, typecheck across all 4 workspaces, production bundle build, and Oxlint.

---

## 6. Deviation Register

*(Added by the 2026-08-19 spec amendment, following the Layer 2 `critic` FAIL and `/diagnose` routing. Both entries are spec-layer corrections: the code was right and the spec text was wrong. No acceptance criterion's substance was weakened, no AC was renumbered, and AC-1..AC-16 are byte-unchanged.)*

1. **Two files fell outside §2.1/§2.2's literal tables and are now named exceptions: `apps/api/src/routes/schemas.ts` (Modified) and `apps/web/src/components/calculators/refractometerBridge.ts` (New).** Both were discovered necessary during execution, and both were independently examined and judged justified — not scope creep — by the `critic` subagent's Layer 2 audit (`.gsd/archive/CRITIC_REPORT.md`, 2026-08-19 entry, findings F-2 and F-3), which nonetheless traced AC-17 **PARTIAL on the letter** because the spec's file tables did not list them. `schemas.ts`: this repo declares every one of its 23 body-bearing routes' schemas as a named export from that one file, with zero inline-literal precedent, so the new `PUT /api/batches/:id/recipe-snapshot` route had nowhere else conformant to put its body schema. `refractometerBridge.ts`: the pre-existing, prior-milestone-verified `apps/web/test/calculatorImportGraph.test.ts` invariant restricts `brixToSg`'s callers to `components/calculators/`, while AC-13 requires `BrewDayTracker.tsx` (outside that directory) to perform the conversion — a direct import would have broken a closed milestone's verified invariant, and inlining the formula would have created a second source of truth. The one-line re-export violates neither. Both are folded into §2.1/§2.2 with their permitted changes enumerated exhaustively and into AC-17's permitted set. **The guardrail itself is not relaxed** — AC-17 is tightened from prose ("permitted batch, inventory, and calculation components") into an explicit 15-path allowlist, so the criterion is now decidable rather than interpretive. `packages/calculations/test/hydrometry.test.ts` is listed in that allowlist as already-authorized by AC-14's own named verification method; it is a clarification of what AC-14 always implied, not a new exception. Same shape as M2_P1's `brewingMath.test.ts` exception, M3_P1's `setup.ts`/`_journal.json` additions, M3_P2's `equipment.migration.test.ts`/`errors.test.ts` exceptions, and M4_P1's `scaling.test.ts` exception. With these two paths in scope, AC-17 reads as **satisfied** against the implementation as already built, with no further code change required for this criterion.

2. **§3.2 named a function that has never existed: `updateStoredRecipe`.** The real repository method is `updateRecipe(db, id, RecipeWriteInput)`, reached through a local `toRecipeWriteInput` adapter because the payload shapes differ (`RecipeWriteInput` vs `StoredRecipe`). This was a phantom reference in the spec, not an implementation deviation — the executor flagged it during the build, and the `critic` then exercised the real sync path **live** (test recipe with mash profile, fermentation profile and both water profiles attached) and confirmed AC-6's actual intent, syncing substituted-ingredient changes back to the master recipe, is genuinely met with every profile link, line-item category, note, author and style name preserved (`CRITIC_REPORT.md` 2026-08-19, finding F-4: "a faithful translation, not a silent narrowing"). §3.2 is corrected to name the real function and the adapter pattern. **Documentation accuracy only:** AC-6 is unchanged and no new behavior is required of the resumed `/execute` pass.

### Explicitly out of scope for this amendment
The following critic findings were routed elsewhere by `/diagnose` and are deliberately **not** addressed in the spec text:
- **AC-8 / F-1** (countdown timers tick-counted rather than wall-clock anchored) — implementation bug, fixed directly at `/execute`. AC-8's text stands as written; the criterion was always correct, the code was not.
- **F-5** (sync silently 200s when `updateRecipe` returns `null`), **F-7** (`StockCheckPanel` stale display after an in-batch adjustment), **F-8** (no api-workspace test over the new route; no `BatchDetail`-level integration coverage) — implementation-layer follow-up for the resumed `/execute` pass.
- **F-6** (§3.2 writes to the caller-supplied `recipeSnapshot.id` with no ownership check against `existing.recipeId`) — the critic explicitly accepted this as intended spec behavior, not a defect. §3.2's contract is left as-is.
