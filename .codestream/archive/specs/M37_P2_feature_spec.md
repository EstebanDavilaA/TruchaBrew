# FEATURE SPECIFICATION: M37_P2 — Target Auto-Tuning UI, Fit Score Visualization & WaterCalculatorModal Integration

> **Milestone 37:** "Multi-Ion Water Chemistry Solver & Target Tuning" (`.gsd/ROADMAP.md`)
> **Phase 2 of 2 (Milestone Closure).** Integrates the bounded multi-ion water chemistry solver into `WaterCalculatorModal.tsx`, providing a live profile match fit score badge/bar ($0-100\%$), dynamic Sulfate-to-Chloride flavor ratio badge ($SO_4^{2-}:Cl^-$), interactive "Auto-Optimize Dosing" action with balance strategy presets (Balanced, Crisp Hop-Forward, Malty/Full), live per-ion delta indicators with `<Badge>`, and closing milestone quality gates.

> ### ⚠ AMENDMENT 1 — 2026-09-01 (post-Layer-2-FAIL corrective pass)
> This spec was approved on 2026-08-31, executed, and **FAILed Layer 2** (`critic` audit, `.gsd/archive/CRITIC_REPORT.md` M37_P2 entry, 2026-09-01: 12 YES / 1 NO / 8 PARTIAL / 1 UNVERIFIED of 22). Per hard rule 4 it routed through `/diagnose`. **This is a same-phase amendment, not a new phase.** No `M37_P3` is opened.
>
> **What changed in Amendment 1:**
> - **AC IDs 1–22 are stable.** AC-3, AC-5, AC-6, AC-7, AC-14, AC-15, AC-16, AC-17, AC-18, AC-20, AC-22 have **amended text** (marked `[AMENDED]` in the matrix). No AC was renumbered, retired, or reused for a different requirement.
> - **AC-23 … AC-34 appended** for the new obligations this amendment introduces.
> - **Authorized Files list expanded** — including retroactive authorization of the two files the executor edited under its own self-written RA-3 (see RA-13).
> - **RA-4 … RA-14 added**; RA-1 tightened; RA-3 annotated as retroactively authorized.
> - Phase Summary §3 and §5 corrected (see RA-4 and RA-9).
>
> **Baseline for this pass:** the working tree as it stands *after* the original M37_P2 execution and after the `/steer` session's rule-7 environment repair to `apps/web/test/setup.ts`. This pass is a **delta on top of that work**, not a rebuild from the pre-M37_P2 tree. Nothing from the first execution is to be reverted except where an AC below explicitly requires it.

> ### ⚠ AMENDMENT 2 — 2026-09-01 (BUG-041 + FEAT-044 combined pass)
> This is a **same-phase amendment**, not a new phase (no `M37_P3`). It was planned and approved (`SPEC_APPROVED`) as one combined spec on top of Amendment 1's tree (2,416 passed / 126 files baseline).
>
> **What changed in Amendment 2:**
> - **BUG-041 (badge conformance):** every badge in `WaterCalculatorModal.tsx` now renders through the `Badge` primitive with **zero `className` overrides**. The `Badge` primitive gains a first-class `xs` size (`px-1.5 py-0.5 text-[10px] rounded-full border …` — pill radius preserved) for the dense ion tiles. The two leftover raw `<span className="px-2 py-0.5 rounded bg-amber/emerald-…">` pseudo-badges migrate onto `<Badge variant="amber|emerald" size="xs">`. `ui/Badge.tsx` moves from AC-34's byte-identical untouched list onto the Authorized Files list.
> - **FEAT-044 (balance strategy relocation):** the calculator's `Balance Strategy` selector and `STRATEGY_WEIGHTS` weighting are **removed**; `optimizeWaterProfile` and `calculateProfileFitScore` are now called with **default (balanced) weights**. A new pure `applyBalanceStrategy(ions, strategy)` + `BalanceStrategy` + `BALANCE_STRATEGY_RATIO` in `packages/calculations` computes a target-ion preset (Cl/SO₄ per strategy). `WaterProfileForm` gains a Balance Strategy `<Select>` + "Apply to Ion Targets" action that writes the preset into the profile's existing ion fields — **transient, no schema/DB/API migration**.
> - **AC IDs 1–34 stay stable** (amended text marked `[AMENDED]` where applicable). **AC-25 and AC-26 are SUPERSEDED** (the strategy selector is gone) by new AC-39 and AC-35 respectively. **AC-35 … AC-40 appended.** New **RA-15 … RA-19** added.
> - **Baseline for this pass:** the working tree as it stands *after* Amendment 1's execution (2,416 passed / 126 files). This pass is a delta on top of that work.

> ### ⚠ AMENDMENT 3 — 2026-09-01 (Option A refinement: FEAT-043 "Proper 'Sparge' MiscUse Category")
> Same-phase refinement selected at the `/steer` checkpoint for Amendment 2. It aligns the Water Calculator's "Save to Recipe" with the original M21_P1 intent (`.gsd/archive/specs/M21_P1_feature_spec.md` §… "use: 'Mash' for mash and use: 'Sparge' for sparge additions"): today `handleSave` tags sparge salt/acid miscs by appending `" (Sparge)"` to the name while leaving `use: 'Mash'`.
>
> **What changes in Amendment 3:**
> - `MiscUse` (`packages/shared-types/src/misc.ts`) gains `'Sparge'`; the API validator `miscUseEnum` (`apps/api/src/routes/schemas.ts`) gains `'Sparge'`. Additive — no DB migration (plain `text('use')` column, no CHECK).
> - `WaterCalculatorModal.handleSave` writes sparge salts/acids with `use: 'Sparge'` and the plain ingredient name (no `(Sparge)` suffix). The load-side effect classifies sparge via `use === 'Sparge'`, with a legacy `name.includes('(Sparge)')` fallback for already-saved recipes (RA-20).
> - `MiscSection.tsx`'s "use" `<select>` gains `'Sparge'`.
> - Tests reconciled (`WaterCalculatorModal.test.tsx`, `WaterSection.test.tsx`) from name-suffix assertions to `use === 'Sparge'`, plus a save→reload round-trip.
> - **AC-41 … AC-46 appended.** **RA-20 added.** Authorized Files list expanded.
> - **Baseline for this pass:** the working tree as it stands *after* Amendment 2's execution (2,433 passed / 126 files).

> ### ⚠ AMENDMENT 4 — 2026-09-01 (BUG-042: recipe mash pH diverges from the modal's adjusted mash pH)
> Post-execution regression reported while using the app: after Amendment 3's save-format change (plain name + `use: 'Sparge'`), the recipe's displayed mash pH (computed by `WaterSection.tsx`) no longer matches the Water Calculator modal's "Adjusted Mash pH".
>
> **Root cause (diagnosed via /diagnose — cause 2, spec error):** `WaterSection.tsx:67` aggregates acid miscs for the recipe-side mash pH **by name only** (`ACID_AGENT_NAMES.has(m.name)`), with no `use` filter. Pre-Amendment-3, sparge acid was saved with the `" (Sparge)"` name suffix, so it was naturally excluded from the mash-pH aggregation (name not in `ACID_AGENT_NAMES`). Amendment 3 (AC-42) changed saves to plain names + `use: 'Sparge'` — now the sparge acid matches `ACID_AGENT_NAMES` and is summed into the mash-acid total, lowering the recipe's displayed mash pH. The modal's own "Adjusted Mash pH" (`WaterCalculatorModal.tsx:217-225`) applies only the mash acid (`mashAcidAmount`), so the two surfaces disagree. Reproduced on the shared fixture: recipe **5.20** vs modal **5.35** — 0.15 pH too low whenever a sparge acid is saved.
>
> **What changes in Amendment 4:**
> - `WaterSection.tsx`'s acid aggregation filters to **mash additions only** (`use === 'Mash'`), so the recipe-side `liveMashPh` equals the modal's adjusted mash pH. Legacy `(Sparge)`-suffixed entries remain excluded by name (they never matched `ACID_AGENT_NAMES`), so the RA-20 load shim is unaffected.
> - New **cross-surface** round-trip test: save mash + sparge acid from the modal, then render `WaterSection` with the saved miscs and assert its `liveMashPh` equals the modal's adjusted pH (shared fixture: 5.35). This is the modal→recipe gap the Amendment-3 in-modal round-trip (AC-45) did not cover.
> - `WaterSection.tsx` moves from the byte-identical NOT-authorized list onto the Authorized Files list (`[A4]`). `WaterSection.test.tsx` was already authorized.
> - **AC-47, AC-48 appended.** **RA-21 added.**
> - **Baseline for this pass:** the working tree as it stands *after* Amendment 3's execution (2,435 passed / 126 files).

---

## Phase Summary

Milestone 37 Phase 1 delivered the pure mathematical bounded multi-ion optimization engine in `@truchabrew/calculations`. Phase 2 now integrates this engine into the primary brewing water UI:

1. **Water Calculator Modal Solver Integration (`apps/web/src/components/WaterCalculatorModal.tsx`):**
   - Wires `optimizeWaterProfile` into the "Auto" dosing button (`data-testid="water-calc-auto-dose-btn"`).
   - Automatically populates mash and sparge salt amounts ($CaCl_2$, $CaSO_4$, $MgSO_4$, $NaCl$, $NaHCO_3$) proportionally based on mash and sparge water volumes.
2. **Live Fit Score & Match Rating Indicator (`WaterCalculatorModal.tsx`):**
   - Renders a prominent Profile Fit Score bar/badge in the modal header/summary strip:
     - **$\ge 90\%$:** Emerald badge / green bar (*"Excellent Match"*).
     - **$75-89\%$:** Amber badge / amber bar (*"Good Match"*).
     - **$<75\%$:** Slate badge / neutral bar (*"Approximate Match"*).
   - **[AMENDED]** The score is computed by the **shared** `calculateProfileFitScore` exported from `waterOptimization.ts` (no duplicated local formula), weighted by the **currently selected balance strategy's** ion weights, so the badge grades against the same objective the solver optimized (RA-6).
3. **Sulfate-to-Chloride Flavor Ratio Tag (`WaterCalculatorModal.tsx`):**
   - Displays real-time $SO_4^{2-}:Cl^-$ ratio with descriptive brewing impact. **[AMENDED — exact bands binding per RA-4, implemented in the shared helper:]**
     - $\text{ratio} > 2.0$: *"Very Bitter / Dry"* (West Coast IPA, Pale Ale).
     - $1.3 \le \text{ratio} \le 2.0$: *"Crisp / Hop-Forward"* (Pilsner, Amber Ale).
     - $0.8 \le \text{ratio} < 1.3$: *"Balanced"* (Kölsch, Stout).
     - $\text{ratio} < 0.8$: *"Full / Malty / Soft"* (NEIPA, Hazy Pale, Porter).
4. **Per-Ion Visual Delta Indicators (`WaterCalculatorModal.tsx`):**
   - Ion table displays Target vs Adjusted (Source + Additions) vs Delta (ppm).
   - In-range values ($\pm 5\text{ ppm}$) display an emerald badge reading the literal text **`Target Matched`**; overshoots and shortfalls display clear signed deltas (`+12.0 ppm`, `-8.0 ppm`) whose displayed magnitude can never contradict the in-range caption (RA-7).
5. **Quality Gates & Invariants:**
   - **[AMENDED per RA-9]** Component and integration tests in `apps/web/test/WaterCalculatorModal.test.tsx`, plus modal-through-`WaterSection` integration assertions in `apps/web/test/WaterSection.test.tsx`. *(The previously named `apps/web/test/WaterCalculatorIntegration.test.tsx` is **removed** from this spec — it was never created and no AC pinned it. See RA-9.)*
   - Adherence to design system primitives (all inputs use `<NumberInput addonRight="g">`, all badges use `<Badge>`, all inner tiles use a `designSystem.ts` token, modal uses standard `<Modal>` container).
   - **[AMENDED]** Real manual-verification evidence captured for this phase (AC-32), and `BUGS.md`'s BUG-024 note corrected to claim no more than what was actually done (AC-33).

---

## 1. Data Schema & Contracts

### 1.1 `packages/calculations/src/waterOptimization.ts` — new public exports

The private `ION_WEIGHTS` constant and the private `fitScore()` function are **promoted to public exports** so the web app can import rather than duplicate them. Values are unchanged.

```ts
export interface IonWeights {
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
}

/** Default per-ion objective weights. Values unchanged from the current private ION_WEIGHTS:
 *  sulfate 1.0, chloride 1.0, calcium 0.8, magnesium 0.5, sodium 0.4, bicarbonate 0.3 */
export const DEFAULT_ION_WEIGHTS: IonWeights;

/** 0–100 weighted closeness of `finished` to `target`. Per-ion closeness =
 *  max(0, 1 − |finished − target| / max(1, |target|)); weighted mean × 100, round2.
 *  Pure, deterministic, no clamping beyond the per-ion max(0, …). */
export function calculateProfileFitScore(
  finished: IonConcentrations,
  target: IonConcentrations,
  weights?: IonWeights,
): number;
```

**Refactoring / legacy cleanup (binding):** the private `const ION_WEIGHTS` and the private `function fitScore` must be **replaced**, not shadowed or aliased. After this pass there is exactly one weights constant and one fit-score implementation in the file; every internal reference (`objective`, `optimizeWaterProfile`) resolves to the exported symbols. A leftover private duplicate kept "for compatibility" fails AC-23.

`OptimizeWaterProfileOptions.weights?: IonWeights` (added by RA-3) is **retained unchanged** and is now formally part of the contract — optional, defaulting to `DEFAULT_ION_WEIGHTS`.

Both symbols reach the web app through the existing `packages/calculations/src/index.ts` barrel (`export * from './waterOptimization'`) — **no barrel edit is required or authorized.**

### 1.2 `packages/calculations/src/water.ts` — SO₄:Cl descriptor contract

```ts
export type SulfateChlorideDescriptor =
  | 'Very Bitter / Dry'
  | 'Crisp / Hop-Forward'
  | 'Balanced'
  | 'Full / Malty / Soft'
  | 'None';

export interface SulfateToChlorideRatio {
  ratio: number | null;
  descriptor: SulfateChlorideDescriptor;   // was: string
}

export function calculateSulfateToChlorideRatio(
  sulfate: number,
  chloride: number,
): SulfateToChlorideRatio;
```

**Binding band table** (exact operators; `ratio` is `parseFloat((sulfate/chloride).toFixed(2))`, i.e. banding is applied to the 2-decimal value, so band selection and displayed value are the same number):

| Condition | `ratio` | `descriptor` |
|---|---|---|
| `chloride <= 0 && sulfate <= 0` | `null` | `'None'` |
| `chloride <= 0 && sulfate > 0` | `99.9` | `'Very Bitter / Dry'` |
| `ratio > 2.0` | as computed | `'Very Bitter / Dry'` |
| `1.3 <= ratio && ratio <= 2.0` | as computed | `'Crisp / Hop-Forward'` |
| `0.8 <= ratio && ratio < 1.3` | as computed | `'Balanced'` |
| `ratio < 0.8` | as computed | `'Full / Malty / Soft'` |

**Legacy cleanup (binding):** the descriptor strings `'Bitter / Crisp'`, `'Malty / Full'`, and `'Very Malty'` are **purged from the codebase** — the 5-band table collapses to the 4 bands above plus `'None'`. Zero occurrences of those three strings may remain in `packages/calculations/src/` or `apps/web/src/` after this pass.

### 1.3 `apps/web/src/components/designSystem.ts` — one new token

```ts
/** Inner tile used by the WaterCalculatorModal ion target-match grid. */
export const ION_TILE_CLASS = 'p-2 rounded-lg bg-slate-950/50 border border-slate-800/70';
```

Export count moves 36 → 37. `designSystem.test.ts`'s existing "length is at least 35" assertion still holds; a positive pin for the new token is added (AC-30). No existing token's value changes.

### 1.4 `apps/web/src/components/WaterCalculatorModal.tsx` — symbol inventory

**Purged (must not exist in the file after this pass):**
- local `interface IonWeights`
- local `const DEFAULT_ION_WEIGHTS`
- the local inline fit-score closeness loop inside the `fitScorePct` `useMemo`
- the raw ion-tile class literal `p-2 rounded-lg bg-slate-950/50 border border-slate-800/70`
- the 4 raw pseudo-badge `<span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">` elements (lines ~863, ~867, ~938, ~941)

**Added / changed:**
- imports `DEFAULT_ION_WEIGHTS`, `calculateProfileFitScore`, `type IonWeights` from `@truchabrew/calculations`
- imports `ION_TILE_CLASS` from `./designSystem`
- `STRATEGY_WEIGHTS: Record<BalanceStrategy, IonWeights>` now spreads the **imported** `DEFAULT_ION_WEIGHTS`
- `fitScorePct` memo delegates to `calculateProfileFitScore(finishedIons, targetIons, STRATEGY_WEIGHTS[balanceStrategy])`
- mash/sparge split denominator (RA-8)

**Untouched (existing behavior preserved):** `handleSave`, `handleReset`, `calculateAcidAdditions`/`calculateSpargeAcid` wiring, `suggestSaltAdditions` reference column, all salt `NumberInput`s, the `Table`/`colgroup` minerals table, all existing `data-testid`s.

---

## 2. Transformations & Pure Logic

### 2.1 Pure logic (no React state)

- `calculateProfileFitScore(finished, target, weights?) → number` — §1.1. Degenerate: a target whose every ion is `0` yields `denom = max(1, 0) = 1` per ion; a finished water also all-zero returns `100`. `totalWeight <= 0` (impossible with the fixed 6-key weights, but defensive) returns `100`.
- `calculateSulfateToChlorideRatio(sulfate, chloride) → SulfateToChlorideRatio` — §1.2, total function, no throws.

### 2.2 Stateful integration (React, `WaterCalculatorModal.tsx`)

- **Fit score:** derived state via `useMemo` on `[finishedIons, targetIons, balanceStrategy]`. **No-match contract:** when no target profile is selected (`targetIons == null`), the badge is **not rendered at all** — the component must not fall back to a placeholder `0` score reaching the DOM. (This is the existing, correct behavior; it is now pinned by AC-24.)
- **Band selection vs display precision (RA-5):** the band (`emerald`/`amber`/`slate`) and label (`Optimal`/`Good`/`Approx`) are selected on the **unrounded** score returned by `calculateProfileFitScore`; the badge **displays `toFixed(1)`** of that same value. A displayed percentage may therefore never sit on the wrong side of a band boundary.
- **Per-ion deltas (RA-7):** in-range classification uses the **unrounded** delta (`Math.abs(delta) <= 5`). In-range renders the literal text `Target Matched` with **no number**. Out-of-range renders a signed value rounded **away from zero to 1 decimal** — `sign * Math.ceil(Math.abs(delta) * 10) / 10`, printed `toFixed(1)` — so any displayed magnitude is strictly greater than `5.0` whenever the true delta is out of range.
- **Mash/sparge split (RA-8):** the split denominator is `effectiveMashL + effectiveSpargeL`, independent of `waterVolumeL`. Solver dose is still computed on `totalVolumeL` (the concentration basis); only the mash:sparge *distribution* changes.

---

## 3. Acceptance Criteria Matrix (34 ACs)

`[AMENDED]` = text changed by Amendment 1. `[NEW]` = added by Amendment 1. Unmarked rows are unchanged from the originally approved spec.

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Auto-Optimize Button | Clicking "Auto-Optimize" (`data-testid="water-calc-auto-dose-btn"`) executes `optimizeWaterProfile` and populates salt inputs. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-2** | Multi-Salt Population | Auto-optimize populates Gypsum, Calcium Chloride, Epsom Salt, Table Salt, and Baking Soda fields without manual calculations. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-3** `[AMENDED]` | Proportional Mash/Sparge Split | With `treatSpargeWater` on, per-salt grams split as `g_mash = round2(g_total × V_mash/(V_mash+V_sparge))` and `g_sparge = round2(g_total × V_sparge/(V_mash+V_sparge))` — the denominator is the **sum of the two volume props**, never `waterVolumeL` (RA-8). | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-4** | Live Fit Score Badge | Modal renders a live Profile Fit Score badge (`data-testid="water-calc-fit-score"`) showing percentage match ($0-100\%$). | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-5** `[AMENDED]` | Fit Score Semantic Colors | Badge variant is `emerald` for `score >= 90`, `amber` for `75 <= score < 90`, `slate` for `score < 75`, **selected on the unrounded score**; the badge text prints that same score at `toFixed(1)` (RA-5). Test must assert the **specific** variant class per band, not `/emerald\|amber\|slate/`. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-6** `[AMENDED]` | Sulfate/Chloride Ratio Display | The badge (`data-testid="water-calc-so4-cl-ratio"`) renders the live ratio **and the exact descriptor** from §1.2's 4-band table. Test asserts an actual descriptor string, not just the `SO₄²⁻ : Cl⁻` label prefix. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-7** `[AMENDED]` | Per-Ion Target Match Badges | Each of the 6 core ions shows a badge reading the literal text **`Target Matched`** when `|delta| <= 5` (unrounded), else a signed delta rounded away from zero to 1 decimal (RA-7). | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-8** | Interactive Salt Adjustment | Manually typing in salt inputs immediately updates ion concentrations, deltas, ratio, and fit score live. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-9** | Calcium Overshoot Guardrail | Auto-optimizing on a target with 150 ppm Cl and 150 ppm SO4 yields Calcium $\le 185\text{ ppm}$ on screen. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-10** | Reset Action | Clicking Reset (`data-testid="water-calc-reset-btn"`) clears all salts and acids to 0.00g and recalculates base score. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-11** | Save to Recipe Action | Clicking "Save to Recipe" (`data-testid="water-calc-save-btn"`) commits salt/acid additions to recipe miscs and closes modal. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-12** | Acid Volume Calculation | Mash and sparge acid additions calculate required mL (Lactic 88% / Phosphoric 75%) based on target mash pH. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-13** | Soft Water Preservation | Auto-optimizing against a soft Pilsen profile applies minimal salt additions without salt over-dosing. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-14** `[AMENDED]` | Responsive Modal Grid | jsdom cannot measure layout, so this AC's evidence is **the AC-32 screenshot** (modal at ≤1280px wide, no clipped text, no horizontal page scroll), plus the existing jsdom assertion that the minerals table sits in an `overflow-x-auto` wrapper. The jsdom half alone no longer satisfies AC-14 (RA-12). | AC-32 screenshot + `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-15** `[AMENDED]` | Primitive Adherence | Every button, select, number input, and **badge** in `WaterCalculatorModal.tsx` uses a `components/ui/` primitive (0 raw equivalents; the 3 pre-existing checkboxes stay exempt per M34_P3). **"Cards"** is satisfied by the `designSystem.ts` `ION_TILE_CLASS` token — **no new `ui/` Card primitive is created in this phase** (RA-10). | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-16** `[AMENDED]` | Scope Guardrail | A SHA-256 content manifest is taken **before the executor's first edit of this corrective pass** and again at the end; the diff contains only files on the Amendment-1 Authorized Files list (plus `.gsd/` framework files). 0 deleted, 0 created outside that list. `git diff --name-only` against a base commit is **not** a valid substitute here — this phase's work is uncommitted and the tree carries unrelated pre-existing modifications (see RA-14). | Pre/post SHA-256 manifest comparison |
| **AC-17** `[AMENDED]` | Bug Closure Invariant | `BUG-024`'s `.gsd/BUGS.md` entry is verified resolved by an **actual** end-to-end workflow, evidenced by AC-32's screenshot, and its wording claims no more than what was done (AC-33). | `.gsd/BUGS.md` inspection + AC-32 artifact |
| **AC-18** `[AMENDED]` | Layer 1 Gate: Tests | Full test suite passes with **no reduction against the 2,388-passing / 126-file post-execution baseline**; new ACs below add tests, so the count must rise. Any failure must be green, not explained. | `npm test` (exit 0) |
| **AC-19** | Layer 1 Gate: Typecheck | All 4 workspaces pass typecheck with 0 errors. | `npm run typecheck` (exit 0) |
| **AC-20** `[AMENDED]` | Layer 1 Gate: Build | `npm run build` exits 0. The previous "<1.2s" wall-clock criterion is **removed** as machine-dependent (RA-11). If the sandbox's rolldown native-binding defect blocks the gate, it is reported as **UNVERIFIED with the reason**, never claimed as a pass. | `npm run build` (exit 0) |
| **AC-21** | Layer 1 Gate: Lint | Monorepo linter passes with 0 errors. | `npm run lint` (exit 0) |
| **AC-22** `[AMENDED]` | Design Token Guarantee | `uiPrimitives.test.tsx` gains an M37_P2 static sweep over `WaterCalculatorModal.tsx` asserting **0** occurrences of the raw pseudo-badge class literal `px-2 py-0.5 rounded bg-slate-900` and **0** occurrences of the raw ion-tile class literal, alongside the pre-existing M34_P3 AC-18 button/select/input sweep. | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-23** `[NEW]` | Shared Weights & Fit Formula — Exports | `waterOptimization.ts` exports `IonWeights`, `DEFAULT_ION_WEIGHTS`, and `calculateProfileFitScore` per §1.1; the private `ION_WEIGHTS` const and private `fitScore` function are **gone** (0 occurrences of a second definition in the file); all 3 symbols resolve through the `@truchabrew/calculations` barrel. | `packages/calculations/test/waterOptimization.test.ts` |
| **AC-24** `[NEW]` | Shared Weights & Fit Formula — No Duplication | `WaterCalculatorModal.tsx` contains **0** local `DEFAULT_ION_WEIGHTS` definitions, **0** local `interface IonWeights`, and no inline closeness loop; it imports all three from `@truchabrew/calculations`. Static source scan. | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-25** `[SUPERSEDED — see AC-39]` | ~~Fit Score Tracks Selected Strategy~~ | The Balance Strategy selector was removed by FEAT-044, so "fit score tracks the selected strategy" is obsolete. Replaced by **AC-39** (fit score grades against the chosen target profile with default weights). | — |
| **AC-26** `[SUPERSEDED — see AC-35]` | ~~Strategy Weight Table Pinned~~ | `STRATEGY_WEIGHTS` no longer exists in the modal. The strategy→ratio table now lives in `packages/calculations` as `BALANCE_STRATEGY_RATIO`, pinned by **AC-35**. | — |
| **AC-27** `[NEW]` | SO₄:Cl Band Boundaries | `calculateSulfateToChlorideRatio` returns the exact §1.2 descriptor at every boundary: ratio `2.01`→`Very Bitter / Dry`; `2.00`→`Crisp / Hop-Forward`; `1.30`→`Crisp / Hop-Forward`; `1.29`→`Balanced`; `0.80`→`Balanced`; `1.30` vs `1.2999` distinguished; `0.79`→`Full / Malty / Soft`; `0.30`→`Full / Malty / Soft` (**not** `Very Malty`); `0.60`→`Full / Malty / Soft` (**not** `Malty / Full`). | `packages/calculations/test/water.test.ts` |
| **AC-28** `[NEW]` | SO₄:Cl Degenerate Inputs | `(0, 0)` → `{ ratio: null, descriptor: 'None' }`; `(150, 0)` → `{ ratio: 99.9, descriptor: 'Very Bitter / Dry' }`; negative inputs treated by the same `<= 0` guards, no throw, no `NaN` and no `Infinity` ever returned. | `packages/calculations/test/water.test.ts` |
| **AC-29** `[NEW]` | Legacy Descriptor Purge | Zero occurrences of the strings `Bitter / Crisp`, `Malty / Full`, or `Very Malty` remain anywhere in `packages/calculations/src/` or `apps/web/src/`. | `packages/calculations/test/water.test.ts` (static scan) |
| **AC-30** `[AMENDED]` | Ion Tile & Pseudo-Badge Primitive Adoption | The 6 ion tiles render with `ION_TILE_CLASS` from `designSystem.ts` (token pinned by value in `designSystem.test.ts`); the 4 acid-section pseudo-badges render as `<Badge variant="neutral" size="sm">`; **the 2 formerly-raw pH/alkalinity readout spans render as `<Badge variant="amber|emerald" size="xs">`** (BUG-041). Existing `data-testid="water-calc-ion-*"` and `water-calc-ion-delta-*` hooks are preserved unchanged. | `apps/web/test/designSystem.test.ts` + `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-31** `[NEW]` | Modal-Through-Section Integration | `WaterSection.test.tsx` asserts, rendering `WaterSection` (not the modal directly): opening the calculator, clicking Auto-Optimize, and finding a non-empty fit-score badge, an SO₄:Cl badge carrying one of the 4 §1.2 descriptors, and all 6 `water-calc-ion-*` tiles. Also asserts `WaterSection`'s own inline SO₄:Cl readout shows the **same** descriptor as the modal's badge for the same water (single-source-of-truth check). | `apps/web/test/WaterSection.test.tsx` |
| **AC-32** `[AMENDED]` | Manual Verification Evidence | `.gsd/active/manual_verification/` contains **at least one real screenshot** of the running app for this pass, showing in a single frame: the Auto-Optimize flow having been run (non-zero salt amounts), the fit-score badge, the SO₄:Cl badge with descriptor, the 6 per-ion delta tiles — **and the absence of any Balance Strategy selector** (FEAT-044). The Amendment 2 screenshot is `M37_P2_amendment2_auto_optimize.png`. A jsdom assertion is **not** acceptable evidence for this AC. | File presence + visual inspection |
| **AC-33** `[NEW]` | BUG-024 Note Accuracy | BUG-024's "End-to-end verification (M37_P2)" note is rewritten to (a) cite the AC-32 screenshot filename as the manual evidence, (b) describe the jsdom tests as *component tests*, not as "verified by user workflow", and (c) carry a `Status:` value that reflects M37_P2's closure rather than the stale `RESOLVED_M37_P1`. No other BUGS.md entry is edited. | `.gsd/BUGS.md` inspection |
| **AC-34** `[AMENDED]` | Scope Guardrail — Untouched Files | These files are **byte-identical** (SHA-256) before and after this pass: `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/Table.tsx`, `apps/web/src/components/ui/NumberInput.tsx`, `apps/web/src/components/ui/Select.tsx`, `apps/web/src/components/ui/index.ts`, `apps/web/test/setup.ts`, `apps/web/test/BatchDetail.test.tsx`, `apps/web/test/accessibilityAndPolish.test.tsx`, `packages/calculations/src/index.ts`. (`ui/Badge.tsx` is **removed** from this list — it is now on the Authorized Files list, gaining the `xs` size. **`WaterSection.tsx` is also removed by Amendment 4** — it is now on the Authorized Files list, changing for AC-47.) Every other file in the repository is byte-identical. | Pre/post SHA-256 manifest comparison |
| **AC-35** `[NEW]` | `applyBalanceStrategy` Contract | `applyBalanceStrategy(ions, strategy)` adjusts **only** chloride/sulfate to `BALANCE_STRATEGY_RATIO[strategy]` (Balanced 1.0, Crisp Hop-Forward 2.0, Malty/Full 0.5); Ca/Mg/Na/HCO₃ returned deep-equal to input; returns a new object (input never mutated); negative inputs clamped to 0; both-zero seed = chloride 50, sulfate 50×ratio (RA-15). `BalanceStrategy` type + `BALANCE_STRATEGY_RATIO` exported through the calculations barrel. | `packages/calculations/test/water.test.ts` |
| **AC-36** `[NEW]` | Badge `xs` Size | `Badge` accepts `size="xs"` rendering `px-1.5 py-0.5 text-[10px] rounded-full border …` (pill radius preserved). The modal's ion-tile and readout badges render `size="xs"` with **zero** `className` overrides (static sweep: 0 `<Badge … className=>` in the modal); `xs` has ≥1 consumer. | `apps/web/test/uiPrimitives.test.tsx` |
| **AC-37** `[NEW]` | WaterProfileForm Balance Strategy Control | `WaterProfileForm` renders a Balance Strategy `<Select>` + "Apply to Ion Targets" action; applying Crisp Hop-Forward sets SO₄:Cl ≈ 2:1, Malty/Full Cl:SO₄ ≈ 2:1, Balanced ≈ 1:1, other ion fields untouched; the strategy is **not persisted** (no schema/API change). | `apps/web/test/WaterProfileForm.test.tsx` |
| **AC-38** `[NEW]` | Calculator Has No Strategy | Static sweep: 0 occurrences of `balanceStrategy`, `STRATEGY_WEIGHTS`, `BALANCE_STRATEGIES`, or the "Balance Strategy" control in `WaterCalculatorModal.tsx`; `optimizeWaterProfile`/`calculateProfileFitScore` are called **without** a weights argument. | `apps/web/test/uiPrimitives.test.tsx` + `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-39** `[NEW]` | Fit Score Tracks Target Profile (default weights) | The fit-score badge is computed with `calculateProfileFitScore(finishedIons, targetIons)` (default weights); the pre-existing 82.77 fixture still pins to `Fit: 82.8% (Good)` after Auto-Optimize. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-40** `[NEW]` | BUG-041 Closure | `.gsd/BUGS.md` BUG-041 entry status is updated to resolved-by-this-pass, citing the AC-32 Amendment 2 screenshot (`M37_P2_amendment2_auto_optimize.png`). | `.gsd/BUGS.md` inspection |
| **AC-41** `[NEW]` | `Sparge` in `MiscUse` union + API validator | `MiscUse` (`packages/shared-types/src/misc.ts:2`) gains `'Sparge'`; `miscUseEnum` (`apps/api/src/routes/schemas.ts:11`) gains `'Sparge'`. Additive — no migration (plain `text('use')` column, no CHECK). | `packages/shared-types` typecheck + `apps/api` typecheck/tests |
| **AC-42** `[NEW]` | Save uses `use: 'Sparge'`, plain name | `WaterCalculatorModal.handleSave` writes sparge salt and acid miscs with `use: 'Sparge'` and the plain ingredient name — **no** `" (Sparge)"` suffix. Mash miscs stay `use: 'Mash'`. | `apps/web/test/WaterCalculatorModal.test.tsx` |
| **AC-43** `[NEW]` | Load recognizes `use: 'Sparge'` (legacy shim) | The load-side effect classifies a misc as sparge when `m.use === 'Sparge'`, with a legacy fallback to `m.name.includes('(Sparge)')` so already-saved recipes still load correctly (RA-20). | `apps/web/test/WaterCalculatorModal.test.tsx` (round-trip) |
| **AC-44** `[NEW]` | MiscSection "use" select includes `Sparge` | `MiscSection.tsx`'s "use" `<select>` offers `'Sparge'` so a misc with that use has a matching dropdown option. | `apps/web/test/MiscSection.test.tsx` |
| **AC-45** `[NEW]` | Test reconciliation + round-trip | `WaterCalculatorModal.test.tsx` and `WaterSection.test.tsx` move from `name === 'X (Sparge)'` assertions to `use === 'Sparge'`; a save→reload round-trip preserves sparge categorization. | `apps/web/test/WaterCalculatorModal.test.tsx` + `apps/web/test/WaterSection.test.tsx` |
| **AC-46** `[NEW]` | Layer 1 + scope guardrail | All four Layer 1 gates green with no reduction vs 2,433/126; pre/post SHA-256 manifest diff contains only the Amendment-3 authorized files. | Layer 1 + manifest comparison |
| **AC-47** `[NEW]` | Recipe mash pH excludes sparge acid | `WaterSection.tsx`'s acid aggregation filters to `use === 'Mash'` only (sparge additions excluded), so the recipe's `liveMashPh` equals the modal's "Adjusted Mash pH". Legacy `(Sparge)`-suffixed entries remain excluded by name (never matched `ACID_AGENT_NAMES`). | `apps/web/test/WaterSection.test.tsx` |
| **AC-48** `[NEW]` | Cross-surface save→recipe pH round-trip | Save adjustments from the modal with mash + sparge acid, then render `WaterSection` with the saved miscs and assert its `liveMashPh` equals the modal's adjusted mash pH (shared fixture: 5.35). | `apps/web/test/WaterSection.test.tsx` |

---

## 4. Resolved Ambiguities (Binding)

**RA-1 — Auto-Dosing Mash vs Sparge Proportions.** *(tightened by Amendment 1 — see RA-8 for the denominator.)*
When both Mash Volume ($V_{\text{mash}}$) and Sparge Volume ($V_{\text{sparge}}$) are defined:
- $V_{\text{split}} = V_{\text{mash}} + V_{\text{sparge}}$
- Total optimal salt $g_{\text{total}}$ is computed on the batch concentration basis `totalVolumeL`.
- $g_{\text{mash}} = g_{\text{total}} \times \frac{V_{\text{mash}}}{V_{\text{split}}}$
- $g_{\text{sparge}} = g_{\text{total}} \times \frac{V_{\text{sparge}}}{V_{\text{split}}}$
- Both amounts are rounded to 2 decimal places ($0.01\text{ g}$).

**RA-2 — Visual Fit Score Classification.** *(display precision amended by RA-5.)*
- Percentage $\ge 90.0\%$: `<Badge variant="emerald">` with text `Fit: {score}% (Optimal)`.
- Percentage $75.0\% - 89.9\%$: `<Badge variant="amber">` with text `Fit: {score}% (Good)`.
- Percentage $< 75.0\%$: `<Badge variant="slate">` with text `Fit: {score}% (Approx)`.

**RA-3 — Spec-gap amendments (executor, 2026-08-31).** *(**Retroactively authorized by Amendment 1 — see RA-13.** Original text preserved verbatim below.)* Two reconciliations were required that the Authorized-Files list did not name:
1. **`packages/calculations/src/waterOptimization.ts` gained an optional `weights` override** on `optimizeWaterProfile`/`solveOptimalSalts` (and threaded through `objective`/`fitScore`). This is how the balance-strategy presets (Balanced / Crisp Hop-Forward / Malty/Full) bias the solver — the spec's Phase Summary mandates the presets but its Authorized list omits the solver file. The change is backward-compatible: `weights` is optional, defaults to the existing `ION_WEIGHTS`, and all M37_P1 tests pass unmodified (54/54).
2. **`apps/web/test/WaterSection.test.tsx` testid references reconciled** to the spec's new testids (`water-auto-btn`→`water-calc-auto-dose-btn`, `water-reset-btn`→`water-calc-reset-btn`, `save-water-adjustments-btn`→`water-calc-save-btn`) and the SO4:Cl ratio label moved to the `water-calc-so4-cl-ratio` badge. This file routes through the modal and pinned the old testids; the spec's AC-1..AC-3 mandate the new ones, so the old pins were stale. No behavioral assertion changed — only testid/label references. Same consequence-pin class as M37_P1 RA-3.

**RA-4 — SO₄:Cl descriptor fix goes in the shared helper, not a local modal map.** *(new, Amendment 1)*
Call-site survey performed: `calculateSulfateToChlorideRatio` has exactly **two** production call sites — `WaterSection.tsx:77` and `WaterCalculatorModal.tsx:259` — plus one test file (`packages/calculations/test/water.test.ts:370-376`) and one comment reference (`waterOptimization.ts:446`, describing the `99.9`/null semantics, which this change preserves). **No API, no persisted data, and no other package depends on the descriptor wording.**
Decision: **correct the shared helper in `packages/calculations/src/water.ts`** to emit exactly the 4 bands (§1.2) rather than mapping locally in the modal. Rationale: a local map would make `WaterSection`'s inline readout and the modal's badge disagree on the same water — a worse defect than the one being fixed. `water.ts` and `water.test.ts` are added to Authorized Files.
**Accepted user-visible consequence:** `WaterSection.tsx`'s inline SO₄:Cl readout changes wording for the `1.3–2.0` and `<0.8` bands (`Bitter / Crisp`→`Crisp / Hop-Forward`; `Malty / Full`/`Very Malty`→`Full / Malty / Soft`). This is intended, and `WaterSection.tsx` itself needs **no edit** — it renders `descriptor` verbatim.
**Compatibility flag:** `packages/calculations/test/water.test.ts:371-376` pins the old 5-band wording and **must** be updated in lockstep; that update is authorized and is the only permitted change to that file beyond AC-27/AC-28/AC-29 additions.

**RA-5 — Fit-score band vs displayed precision.** *(new, Amendment 1)*
Band and label are chosen on the **unrounded** score (as returned by `calculateProfileFitScore`, i.e. `round2`). The badge **displays `toFixed(1)`**, not `toFixed(0)`. Both halves are required: banding on the unrounded value is what makes the colour truthful, and 1-decimal display is what stops `89.6` from *printing* `90%` beside an amber `(Good)` label. Boundary pins: `89.6` → `Fit: 89.6% (Good)` amber; `90.0` → `Fit: 90.0% (Optimal)` emerald; `74.9` → `Fit: 74.9% (Approx)` slate; `75.0` → `Fit: 75.0% (Good)` amber.

**RA-6 — The displayed fit score uses the selected strategy's weights.** *(new, Amendment 1)*
The solver optimizes against `STRATEGY_WEIGHTS[balanceStrategy]`; the badge must grade against the **same** weights, otherwise switching to "Crisp Hop-Forward" can *lower* a score for a dose that is better by the chosen strategy (critic finding 9). The modal imports `calculateProfileFitScore` and passes the selected strategy's weights. The default (`Balanced`) case is numerically identical to today's behavior, so no existing assertion changes meaning.

**RA-7 — Per-ion delta rounding must not contradict the ±5 ppm caption.** *(new, Amendment 1)*
- In-range test: `Math.abs(delta) <= 5` on the **unrounded** delta. Inclusive at exactly `5.0`.
- In-range badge text: the literal `Target Matched` (spec text), with **no numeric delta** rendered — so an in-range tile cannot display a contradictory number at all.
- Out-of-range badge: signed value rounded **away from zero** to 1 decimal — `sign(delta) * Math.ceil(Math.abs(delta) * 10) / 10`, printed `toFixed(1)`, suffixed ` ppm`. `+5.04` renders `+5.1 ppm`; `+5.4` renders `+5.4 ppm`; `-8.02` renders `-8.1 ppm`. No out-of-range tile can ever print a magnitude `<= 5.0`.
- Variant stays `amber` for positive (overshoot) and `slate` for negative (shortfall); `emerald` for in-range.

**RA-8 — Mash/sparge split denominator.** *(new, Amendment 1)*
`WaterSection` derives and forwards `effectiveMashL`, `effectiveSpargeL`, and `totalWaterL` **independently**; nothing guarantees the first two sum to the third. The split therefore uses `splitTotal = effectiveMashL + effectiveSpargeL` as its denominator, and `spargeRatio` is computed as `effectiveSpargeL / splitTotal` — **not** as the residual `1 - mashRatio` against `waterVolumeL`.
Fallbacks: `treatSpargeWater === false` → `mashRatio = 1`, `spargeRatio = 0`. `splitTotal <= 0` → `mashRatio = 0.6`, `spargeRatio = 0.4` (preserves today's fallback). The solver's dose basis remains `totalVolumeL` — this RA changes distribution only, never total grams.
AC-3's test must include an explicitly **out-of-sync** fixture (e.g. `waterVolumeL = 30`, `mashWaterL = 15`, `spargeWaterL = 10`) and assert `g_mash : g_sparge == 15 : 10` and `g_mash + g_sparge == g_total` to 0.02 g of rounding slack.

**RA-9 — `WaterCalculatorIntegration.test.tsx` is removed from the spec, not created.** *(new, Amendment 1)*
The original Phase Summary §5 promised this file; no AC pinned it and it was never created (critic finding 10). Decision: **remove the promise.** Creating a third suite that renders the same modal duplicates `WaterCalculatorModal.test.tsx` for no new coverage. The one genuinely different level — the modal reached *through* `WaterSection`, with the section's own SO₄:Cl readout in the same render — is pinned instead by **AC-31** in the already-authorized `WaterSection.test.tsx`.

**RA-10 — "Cards" in AC-15 resolves to a `designSystem` token, not a new `ui/` primitive.** *(new, Amendment 1)*
`apps/web/src/components/ui/` contains Badge, Button, FormField, Input, NumberInput, Select, Table — **no `Card` primitive exists**, so AC-15's "cards" half was literally unsatisfiable as written (critic finding 7). Introducing a `Card` primitive is a design-system milestone's work, not a corrective pass's. Decision:
- Acid-section pseudo-badges → the existing `<Badge variant="neutral" size="sm">` primitive.
- Ion tiles → the new `designSystem.ts` `ION_TILE_CLASS` token (§1.3), matching how `SUBPANEL_CLASS`/`CARD_CLASS` already serve this role app-wide.
- **No file under `apps/web/src/components/ui/` is modified or added in this phase** (pinned by AC-34).

**RA-11 — AC-20's wall-clock criterion is dropped.** *(new, Amendment 1)*
"<1.2 s" is machine-dependent and unverifiable across environments (critic: non-portable). AC-20 is now exit-code-only. Separately, this sandbox's `npm run build` currently fails on a missing `@rolldown/binding-linux-x64-gnu` native binding — an npm optional-dependency defect, not a source defect. If it still fails at Layer 1, AC-20 is reported **UNVERIFIED with that reason stated**; it may not be recorded as a pass, and `tsc -b` passing is not a substitute.

**RA-12 — AC-14's verification method changes to visual evidence.** *(new, Amendment 1)*
jsdom performs no layout, so "renders without horizontal overflow" is not assertable there; the existing test asserts the *presence of a scroll container*, which is evidence a scroller exists, not that overflow is absent. AC-14 now takes its evidence from AC-32's screenshot, with the jsdom wrapper assertion retained as a secondary structural check.

**RA-13 — RA-3 is retroactively authorized as of this amendment.** *(new, Amendment 1)*
`packages/calculations/src/waterOptimization.ts` and `apps/web/test/WaterSection.test.tsx` were edited by the executor under a self-written, post-`SPEC_APPROVED` RA-3 with no logged re-approval — a **process** violation (critic finding 1, AC-16 `NO`). The critic independently verified both edits are substantively benign (`weights` optional and defaulting; the WaterSection diff testid/label-only, no behavioral assertion changed). Both files are now on the Authorized Files list below, and this amendment's `SPEC_APPROVED` is the missing approval. **No revert of RA-3's edits is required or permitted.** Going forward, a spec-gap discovered mid-execution halts for an amendment; it is never self-authorized in the spec text.

**RA-14 — Manifest baseline for this corrective pass.** *(new, Amendment 1)*
The pre-manifest is taken from the **current** working tree — i.e. *after* the first M37_P2 execution and *after* the `/steer` session's rule-7 `apps/web/test/setup.ts` localStorage-polyfill repair — as the executor's literal first action, before any edit. `git diff --name-only` against a base commit is explicitly **not** a valid scope check for this phase: M37_P2's work is uncommitted and the tree already carries many unrelated modified files (the whole `.gsd/` framework tree among them), so a commit-relative diff cannot distinguish this pass's writes from pre-existing ones. Command: `git ls-files -co --exclude-standard -z | xargs -0 sha256sum`, saved pre and post, diffed at the end.

**RA-15 — `applyBalanceStrategy` degenerate seed rule.** *(new, Amendment 2)*
Adjusts ONLY chloride/sulfate (the ratio-defining pair); Ca/Mg/Na/HCO₃ returned unchanged. Anchor rule: both zero → seed chloride 50, sulfate = 50×ratio; chloride ≤ 0 → derive chloride = sulfate/ratio; otherwise derive sulfate = chloride×ratio. Negative inputs clamped to 0 (total function, no NaN/Infinity). Adjusted values rounded to 2 decimals.

**RA-16 — Solver `weights` params remain optional but unused in-app.** *(new, Amendment 2)*
`optimizeWaterProfile`/`calculateProfileFitScore` keep their optional `weights` params (backward compatible, unchanged defaults). After this pass there are **zero in-app callers** that pass `weights`. AC-23's exports (`DEFAULT_ION_WEIGHTS`, `calculateProfileFitScore`, `IonWeights`) remain unchanged.

**RA-17 — Strategy symbols live in calculations, deleted (not moved) from the modal.** *(new, Amendment 2)*
`BalanceStrategy` + `applyBalanceStrategy` + `BALANCE_STRATEGY_RATIO` are exported from `packages/calculations` (reused by `WaterProfileForm`). The modal's `BALANCE_STRATEGIES`/`STRATEGY_WEIGHTS`/`balanceStrategy` are **deleted**, not relocated — the solver's per-strategy weights are no longer needed once the profile carries the target ions.

**RA-18 — `Badge` `xs` class string.** *(new, Amendment 2)*
`xs` = `px-1.5 py-0.5 text-[10px] font-medium rounded-full border inline-flex items-center gap-1`. Pill radius (`rounded-full`) is preserved so the compact dense-tile badges still conform to the primitive's shape. No per-call-site `className` override is permitted on any `Badge` in the modal (static sweep).

**RA-19 — Fit score is no longer strategy-weighted.** *(new, Amendment 2, FEAT-044 decision)*
The score grades the finished water against the chosen target profile's exact ions with `DEFAULT_ION_WEIGHTS`; strategy weighting was deliberately removed with the selector. This is the documented, intended behavior — the critic must not flag the absence of strategy weighting as a regression.

**RA-20 — Legacy `(Sparge)` suffix is load-time-shimmed, not migrated.** *(new, Amendment 3)*
Existing saved recipes carry sparge miscs with `use: 'Mash'` and a `" (Sparge)"` name suffix. The load-side effect must keep recognizing those (fallback to `name.includes('(Sparge)')`) while NEW saves emit `use: 'Sparge'` with a plain name. No DB migration. **Out of scope for this amendment (noted, not built):** `InventoryForm.tsx:80`'s `DEFAULT_USE_OPTIONS` and the `brewfatherImport.ts`/`beerXmlImport.ts` `mapMiscUse` mappings (which currently collapse `sparge` → `'Mash'`) are deliberately not touched — they are a future phase.

**RA-21 — Consumers must discriminate mash vs sparge by `use`, not name.** *(new, Amendment 4)*
Any consumer that needs to distinguish mash from sparge additions reads the `use` field (`'Mash'` vs `'Sparge'`) — the plain name is no longer a discriminator for NEW saves. The `(Sparge)` name suffix remains valid **only** as the read-side legacy shim for pre-Amendment-3 recipes (RA-20) and is never written. `WaterSection.tsx`'s mash-pH acid aggregation is the first consumer fixed under this rule (AC-47); it must not sum sparge acid into the mash pH. This was a spec gap in Amendment 3 (BUG-042): the save-side contract changed without reconciling this read-side consumer, which relied on the old name-suffix convention to exclude sparge acid.

---

## 5. Authorized Files to Modify

*(Amendment 4 list — supersedes the Amendment 3 list. `[+]` marks entries added by Amendment 1; `[A2]` marks entries added by Amendment 2; `[A3]` marks entries added by Amendment 3; `[A4]` marks entries added by Amendment 4.)*

**Source:**
- `apps/web/src/components/WaterCalculatorModal.tsx`
- `[A4]` `apps/web/src/components/WaterSection.tsx` — AC-47 acid aggregation filters to `use === 'Mash'` (was byte-identical NOT-authorized under AC-34; BUG-042)
- `[A2]` `apps/web/src/components/WaterProfileForm.tsx` — Balance Strategy preset control (FEAT-044)
- `[A2]` `apps/web/src/components/ui/Badge.tsx` — `xs` size variant (BUG-041; was AC-34 untouched-pinned)
- `[A3]` `packages/shared-types/src/misc.ts` — `MiscUse` gains `'Sparge'` (FEAT-043)
- `[A3]` `apps/api/src/routes/schemas.ts` — `miscUseEnum` gains `'Sparge'` (FEAT-043)
- `[A3]` `apps/web/src/components/MiscSection.tsx` — "use" select gains `'Sparge'` (FEAT-043)
- `[+]` `apps/web/src/components/designSystem.ts` — adds `ION_TILE_CLASS` only (RA-10)
- `[+]` `packages/calculations/src/waterOptimization.ts` — retroactive per RA-13, plus §1.1 exports
- `[+]` `packages/calculations/src/water.ts` — SO₄:Cl 4-band table (RA-4); `[A2]` `applyBalanceStrategy` + `BalanceStrategy` + `BALANCE_STRATEGY_RATIO`

**Test:**
- `apps/web/test/WaterCalculatorModal.test.tsx`
- `apps/web/test/uiPrimitives.test.tsx`
- `[A2]` `apps/web/test/WaterProfileForm.test.tsx` — AC-37 strategy preset tests
- `[A3]` `apps/web/test/MiscSection.test.tsx` — AC-44 'Sparge' option test
- `[+]` `apps/web/test/WaterSection.test.tsx` — retroactive per RA-13, plus AC-31; `[A3]` AC-45 reconciliation; `[A4]` AC-47/AC-48 recipe-pH tests
- `[+]` `apps/web/test/designSystem.test.ts` — AC-30 token pin only
- `[+]` `packages/calculations/test/water.test.ts` — AC-27/AC-28/AC-29 + RA-4 lockstep update; `[A2]` AC-35 applyBalanceStrategy tests
- `[+]` `packages/calculations/test/waterOptimization.test.ts` — AC-23

**Framework:**
- `.gsd/STATE.json`
- `.gsd/BUGS.md`
- `[A2]` `.gsd/FEATURES.md` — FEAT-044 status; `[A3]` FEAT-043 status
- `[+]` `.gsd/active/manual_verification/` — AC-32 screenshot (new file; A2 adds `M37_P2_amendment2_auto_optimize.png`)

**Explicitly NOT authorized** (byte-identical, AC-34): `apps/web/src/components/ui/` **except `Badge.tsx`** (Button, Table, NumberInput, Select, index are untouched), `packages/calculations/src/index.ts`, `apps/web/test/setup.ts`, and every other file in the repository — **including, per RA-20, `apps/web/src/components/InventoryForm.tsx`, `packages/calculations/src/brewfatherImport.ts`, and `packages/calculations/src/beerXmlImport.ts`**. *(`apps/web/src/components/WaterSection.tsx` was removed from this list by Amendment 4 — see Authorized Files above, `[A4]`.)*

---

## 6. Halt Gate (State 2)

Review the revised feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
