# FEATURE SPECIFICATION: M23_P2 — A water calculator that shows you what to weigh out

## Phase Summary

Milestone 23 Phase 1 fixed `WaterCalculatorModal.tsx`'s *presentation* — dialog semantics and palette — with a deliberate zero-behavior-change constraint. Phase 2 is the behavioral half of the same file: the modal currently makes a brewer treat sparge water and dose both mash and sparge acid whether or not their process involves any of it, and its headline panel is a six-row ion-chemistry table rather than the one thing they act on — how many grams of each salt to put on the scale.

This phase is scoped to **two files**: `apps/web/src/components/WaterCalculatorModal.tsx` and its own suite `apps/web/test/WaterCalculatorModal.test.tsx`. Nothing else in the repo changes — see §3, AC-24.

**User-visible outcome:** A brewer who does not treat sparge water, or who does not acidify one or both of mash and sparge, turns that section off and it disappears — from the screen and from what gets written into the recipe. With sparge treatment off, AUTO puts the whole mineral dose in the mash rather than splitting it. The panel at the top of the modal now reads as a weigh-out list — five salts, total grams each — instead of a source/added/finished/target/delta ion table.

### Accepted capability loss — stated up front, not in a footnote

**The "RO / Distilled Dilution" slider is deleted, and with it the ability to model cutting a hard source water with RO/distilled water before dosing salts.** This is a real, deliberate, user-approved capability removal, not an oversight and not a refactor casualty. Brewers on hard tap water currently use that slider to bring a high-mineral source profile down before the salt calculation runs; after this phase, the only way to model that is to create a separate, pre-diluted source `WaterProfile` by hand. `calculateDilutedWaterProfile` remains exported and tested in `packages/calculations/src/water.ts` (RA-1), so restoring the control later is a UI change, not an engine change. Anyone reading this file later and finding no dilution control should read this paragraph as the answer, not file a regression.

### Key Behaviors

1. A **"Treat sparge water"** checkbox, default ON, sits directly above the Sparge Water Minerals panel. OFF unmounts that panel, zeroes `spargeSalts`, and makes AUTO dose 100% of the suggested salts into the mash.
2. Independent **"Add mash acid"** and **"Add sparge acid"** checkboxes, each default ON, sit directly above their respective acid panels. OFF unmounts the panel and zeroes that section's acid amount.
3. `handleSave` writes no sparge-tagged salt misc and no acid misc for any section whose toggle is off — guarded on the toggle itself, not only on the (already-zeroed) amount.
4. The dilution slider, `dilutionPct` state, and the `calculateDilutedWaterProfile` call are removed from this component. `source` is the selected profile unmodified.
5. The "Finished Water Ions (ppm)" table is replaced by a **"Minerals Needed"** summary: five rows, one per salt, each showing total grams to weigh out — mash + sparge when sparge treatment is on, mash only when it is off.
6. The SO₄²⁻:Cl⁻ ratio badge and the header "Mash pH X.XX" badge are unchanged in computation, text, and placement semantics.
7. `WaterCalculatorModalProps`, the `onSaveAdjustments` contract, and `WaterSection.tsx`'s call site are untouched.

### Resolved Ambiguities (Binding)

These resolutions are binding on the executor.

- **RA-1 — `calculateDilutedWaterProfile` stays in `water.ts`; only this component stops calling it.** The brief asked to confirm before deleting. It **is** relied on elsewhere: `packages/calculations/test/water.test.ts` imports it (line 9) and exercises it at lines 352–367 (50%, 100%, and 0% dilution). Removing the export would break that suite and violate this phase's hard constraint against touching `water.ts`. **`packages/calculations/src/water.ts` and `packages/calculations/test/water.test.ts` are both hash-identical after this phase** (AC-24). The only change is dropping the named import from `WaterCalculatorModal.tsx:10`.
- **RA-2 — `source` becomes the selected profile object itself, and the `rawSource`/`source` pair collapses to one memo.** Today `rawSource` (line 160) is the found profile and `source` (line 161) is `calculateDilutedWaterProfile(rawSource, dilutionPct)`. After this phase there is exactly one memo named `source`, identical in body to today's `rawSource`. The identifier `rawSource` disappears from the file entirely. **Numeric consequence, accepted:** `calculateDilutedWaterProfile` rounds every ion to one decimal (`parseFloat(x.toFixed(1))`) even at 0% dilution, so a stored profile value of e.g. `100.06` ppm currently reaches the calculations as `100.1`. After this phase the stored value is used unrounded. This is a sub-0.05 ppm difference on user-entered ppm integers and is not compensated for — do **not** add a rounding shim to preserve it.
- **RA-3 — All three toggles reset to `true` every time the modal opens.** They are appended to the existing `useEffect(..., [isOpen, waterSourceId, waterTargetId, initialTargetPh, miscs])` hydration block (lines 102–157), which already re-derives every other piece of state from props on open. They are **not** derived from the incoming `miscs` array. Deriving them would turn the sparge panel off for every recipe that simply has no sparge salts yet — the common case — which contradicts "default ON preserves current behavior". The toggles are session-scoped view state, not persisted recipe data; nothing in `MiscItem` or `WaterCalculatorModalProps` records them.
- **RA-4 — Toggling off clears immediately *and* `handleSave` guards on the toggle.** Both, not either. The toggle's `onChange` zeroes the relevant state the moment it is unchecked, and `handleSave` additionally gates each write on the toggle boolean. The redundancy is deliberate: the clear-on-off is what makes the live Mash pH badge and the Minerals Needed totals correct without any further branching (RA-8), and the save guard is what makes "never writes a sparge-tagged misc while off" true by construction rather than by trusting that no future code path can reintroduce a stale value.
- **RA-5 — Toggling back ON restores nothing.** No `useRef` snapshot, no shadow state, no undo buffer. Because the values were genuinely set to zero on toggle-off, there is nothing to restore; re-enabling reveals a zeroed panel and the brewer re-runs AUTO or types values in. An executor that implements value preservation has failed AC-6/AC-10.
- **RA-6 — With sparge treatment off, AUTO keeps `totalVolumeL` as the suggestion volume and sets `mashRatio = 1`.** `suggestSaltAdditions(source, target, totalVolumeL)` is called with the **same total batch volume** as today — the argument does **not** change to `effectiveMashL`. Only the split ratio changes: `mashRatio` is `1` (and `spargeRatio` therefore `0`) when `treatSpargeWater` is false, instead of `effectiveMashL / totalVolumeL`. **Brewing consequence, intended and accepted:** the finished-wort ion totals still hit the target profile, but the mash water itself now carries the whole batch's mineral load at a higher concentration than the "finished" figures shown. This is what "dose 100% of the total into the mash" means and is the explicit instruction; do not silently re-scale to mash volume to "fix" the concentration.
- **RA-7 — `handleReset` does not touch the three toggles.** Its title is "Reset all salt and acid additions"; the toggles are section scope, not an addition. Reset zeroes `mashSalts`, `spargeSalts`, `mashAcidAmount`, `spargeAcidAmount` exactly as today, minus the `setDilutionPct(0)` line, which is deleted with the state.
- **RA-8 — `currentMiscs` gets no toggle branching.** The virtual-misc memo (lines 165–178) that feeds `calculateFinishedIons` reads `mashSalts`/`spargeSalts` and is left structurally unchanged. Because RA-4 guarantees `spargeSalts` is all-zero whenever the toggle is off, and the memo already skips any salt at `0` grams, no stale sparge minerals can reach the ion calculation. Adding a redundant `treatSpargeWater &&` guard here is out of scope drift.
- **RA-9 — Turning "Add mash acid" off raises the displayed Mash pH badge, and that is correct.** `liveMashPh` is `calculatePostAcidMashPh(preAcidPredictedPh, …)` with the acid amount folded in; zeroing `mashAcidAmount` therefore moves the badge back to the pre-acid prediction. The badge's markup, testid (`modal-predicted-mash-ph`), colour thresholds (`>= 5.2 && <= 5.6` → emerald, else amber) and `toFixed(2)` formatting are all **unchanged** — the value moves only because its input did.
- **RA-10 — The SO₄²⁻:Cl⁻ badge relocates into the new card's header with its markup and text preserved byte-for-byte.** It currently lives in the header row of the panel being replaced (lines 451–456). It moves into the "Minerals Needed" card's header row in the same position (right-aligned, opposite the `<h4>`). The label string stays exactly `SO₄²⁻ : Cl⁻ Ratio:` — U+2084 subscript four, U+00B2 superscript two, U+207B superscript minus, spaces around the colon as written. `apps/web/test/WaterSection.test.tsx:134` asserts `getByText(/SO₄²⁻ : Cl⁻ Ratio:/)` against this modal and is pinned hash-identical (AC-24), so any drift in this string is a phase failure. Its value expression (`so4ClRatio.ratio !== null ? \`${so4ClRatio.ratio} (${so4ClRatio.descriptor})\` : '—'`) and the `calculateSulfateToChlorideRatio` memo are unchanged.
- **RA-11 — `calculateFinishedIons` and the `finishedIons` memo survive the table's deletion.** Only the *markup* of the ion table (lines 459–508) is removed. `finishedIons` still feeds `ra` → `preAcidPredictedPh` → the Mash pH badge, `so4ClRatio`, and `autoMashAcid`'s alkalinity argument. The `calculateFinishedIons` import stays. Deleting the memo along with the table breaks the header badge and is the single most likely over-deletion in this phase.
- **RA-12 — `target` survives too.** The Delta column disappears, but `target` still gates AUTO (`if (!target) return`, and the AUTO button's `disabled={!target}`) and backs the Target Water Profile select. `targetProfiles`, `selectedTargetId`, and the select are unchanged.
- **RA-13 — Minerals Needed always renders all five rows, including zeros.** No filtering, no "nothing to add" empty state. A brewer scanning for "did I need Epsom?" gets a stable five-row list in `SALT_NAMES` order (Gypsum, Calcium Chloride, Epsom Salt, Table Salt, Baking Soda). Zero rows display `0.00 g`.
- **RA-14 — Split rounding may differ from the un-split suggestion by up to ±0.01 g per salt.** `handleAutoAdjustSalts` rounds mash and sparge independently (`parseFloat((amount * ratio).toFixed(2))`), so `round2(a·r) + round2(a·(1−r))` is not universally equal to `a`. It *is* exactly equal for the fixture values AC-8/AC-9 assert (verified arithmetically at spec time: `mashRatio` is exactly `0.6` for 13.8 L of 23 L, and all five salts sum exactly). The ACs assert those specific values; they must **not** be written as a general invariance law, and the executor must **not** add compensation logic to force the sum.
- **RA-15 — Hidden panels are unmounted, not CSS-hidden.** Conditional rendering (`{flag && <panel/>}`), never a `hidden` class or `display:none`. A visually hidden input is still in the accessibility tree and still focusable, which would defeat the point of the toggle and contradicts Milestone 23's stated direction. AC-4/AC-11 assert the inputs are absent from the DOM, not merely invisible.
- **RA-16 — Each toggle is a real `<input type="checkbox">` with an associated `<label htmlFor>`.** Not a div-based faux switch. Precedent: `BatchRecipeAdjustModal.tsx:160-171` (checkbox + `id` + `htmlFor` label + `data-testid`). This is a content-level control inside the modal body and does **not** intrude on Milestone 25's shared-Modal-wrapper scope.
- **RA-17 — The two grid containers keep their existing class strings; the toggle lives inside the grid cell, above its panel.** Section 3's `grid grid-cols-1 md:grid-cols-2 gap-4` and Section 4's identical string are **unchanged**. Each toggled area becomes a wrapper `<div className="space-y-2">` occupying its grid cell, containing the always-rendered toggle row followed by the conditionally-rendered panel. Consequence: when a panel is off, its grid cell still exists (holding just the toggle row), so the sibling panel does not restretch and the two-column layout stays stable. Do **not** implement conditional `grid-cols-*` juggling.
- **RA-18 — Section 1's grid drops from three columns to two.** With the dilution cell gone, `md:grid-cols-3` would leave the Target select stranded in column 2 with an empty column 3. Exact change in §1.2. This is an inline layout `className` inside the scroll body — not a class-string constant (so it is not M24's `designSystem.ts` hoist scope) and not modal chrome/backdrop/dialog-wrapper markup (so it is not M25's scope).
- **RA-19 — Toggling an acid section off zeroes the amount only, not the acid *type*.** `mashAcidType` / `spargeAcidType` and the two target-pH inputs (`targetMashPh`, `targetSpargePh`) keep their values; they are re-derived on the next open by the hydration effect anyway. Only `mashAcidAmount` / `spargeAcidAmount` are zeroed.
- **RA-20 — The "Auto-fill target" buttons and the acid `useMemo`s get no toggle guards.** `handleApplyMashAcid` / `handleApplySpargeAcid` live inside the panels and unmount with them, so they are unreachable while off; adding a defensive guard to an unreachable handler is dead code. Likewise `autoMashAcid` / `autoSpargeAcid` / `liveMashPh` remain unconditional `useMemo` calls — React hooks cannot be conditional, and an executor that tries to skip them conditionally has introduced a hooks-order bug.
- **RA-21 — Saving with sparge treatment off removes previously-saved sparge salt miscs from the recipe.** `handleSave` already drops **all** `WaterAgent` miscs (`miscs.filter((m) => m.type !== 'WaterAgent')`) and rewrites the set from local state. So a recipe that had `Gypsum (Sparge)` saved, reopened with the toggle switched off and saved again, loses that misc. This is the correct reading of "never writes sparge-tagged miscs while off" and is intended; it is called out so it is not later mistaken for data loss caused by a bug.
- **RA-22 — Every M23_P1 assertion in `WaterCalculatorModal.test.tsx` survives unmodified.** The existing AC-2/AC-3/AC-5/AC-6/AC-7 blocks (dialog semantics, closed-state, palette source sweeps) are **extended around**, never edited or deleted. Note in particular AC-7's second test, `expect(SOURCE).toMatch(/bg-slate-950\/60/)` — that string lives on the Section 5 grist cards (line 719), which this phase does not touch, so it stays green. New checkbox markup must not introduce `bg-amber-500 hover:bg-amber-400` or `text-slate-950` (AC-5 asserts their absence); `accent-amber-500` is a different string and is permitted (it is already the app's checkbox/accent convention — `RecipeImportModal.tsx:277`).
- **RA-23 — `apps/web/test/WaterSection.test.tsx:134`'s test name is stale after this phase, and that is accepted.** It reads "AC-5 & AC-6: dilution slider updates source profile and target profile displays SO4/Cl ratio", but its body never touches the slider — it asserts only the two select values and the ratio label. It therefore still passes after the slider is deleted. Renaming it would modify a file this phase pins hash-identical; the stale name is left alone and recorded here so the critic does not read it as a missed update.
- **RA-24 — `git diff` is not a viable scope guardrail in this repo.** This repo has exactly one commit and `apps/web/` does not exist in `HEAD`, so `git diff --name-only <base>` cannot distinguish "the executor changed this" from "this was never committed". AC-24 specifies a pre/post SHA-256 content-manifest diff instead, the same mechanism M23_P1's AC-25 used. This is stated in the AC text itself, not only here.
- **RA-25 — The `suggestSaltAdditions` greedy-order overshoot is out of scope for code changes and is logged as `BUG-024`.** Per explicit instruction, no fix in this phase. Logged with corrected, empirically-reproduced numbers — the informal report of "Calcium/Sodium/Sulfate overshoot by 30–40 ppm" is right about the mechanism but not the distribution: against a 0 ppm source at 23 L targeting Ca 100 / Mg 10 / Na 10 / Cl 60 / SO₄ 150 / HCO₃ 40, the actual result is **sulfate +39.6 ppm, sodium +6.8 ppm, and calcium −3.4 ppm (an *under*shoot)**. See `.gsd/BUGS.md` `BUG-024`.

---

## 1. Data Schema & Contracts

### 1.1 Exported Constants & Types

**No exported symbol in this repo changes.** No new module-level export is created, no existing export changes type, and no `.d.ts`-visible surface moves.

Unchanged and explicitly re-asserted (AC-22):

```ts
// apps/web/src/components/WaterCalculatorModal.tsx — UNCHANGED
export interface WaterCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  waterProfiles: WaterProfile[];
  waterSourceId: string | null;
  waterTargetId: string | null;
  waterVolumeL: number;
  mashWaterL?: number;
  spargeWaterL?: number;
  fermentables: FermentableItem[];
  miscs: MiscItem[];
  initialTargetPh?: number;
  onSaveAdjustments: (params: {
    waterSourceId: string | null;
    waterTargetId: string | null;
    miscs: MiscItem[];
  }) => void;
}
```

Module-local, unchanged: `SALT_NAMES` (5 entries, order significant — it drives both the existing panels and the new summary), `SaltName`, `ACID_TYPES`, `AcidType`, `MODAL_BACKDROP_CLASS`, `MODAL_CONTAINER_CLASS`, `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `INPUT_CLASS`, `SELECT_CLASS`. **No class-string constant in this file is edited, added, or hoisted** — M23_P1 RA-3 reserved hoisting for Milestone 24, and the `w-full` in `INPUT_CLASS` is a post-M23_P1 layout fix that must survive untouched.

### 1.2 Symbol Inventory

**Imports — removed (one named import, one line):**

| File:line | Change |
|---|---|
| `WaterCalculatorModal.tsx:10` | Remove `calculateDilutedWaterProfile,` from the `@truchabrew/calculations` import list. Every other named import on lines 4–13 is retained: `calculateResidualAlkalinity`, `calculateFinishedIons`, `predictMashPh`, `suggestSaltAdditions`, `calculateAcidAdditions`, `calculatePostAcidMashPh`, `calculateSulfateToChlorideRatio`, `calculateSpargeAcid` (RA-11). |

**React state — added (3):**

| State | Type | Initial | Reset on open (RA-3) |
|---|---|---|---|
| `treatSpargeWater` | `boolean` | `true` | `setTreatSpargeWater(true)` |
| `addMashAcid` | `boolean` | `true` | `setAddMashAcid(true)` |
| `addSpargeAcid` | `boolean` | `true` | `setAddSpargeAcid(true)` |

**React state — removed (1):** `dilutionPct` / `setDilutionPct` (line 74), together with its `useState<number>(0)` and its only two other references (line 161's memo argument, line 223's reset call).

**React state — unchanged (10):** `selectedSourceId`, `selectedTargetId`, `targetMashPh`, `targetSpargePh`, `mashSalts`, `spargeSalts`, `mashAcidType`, `mashAcidAmount`, `spargeAcidType`, `spargeAcidAmount`.

**Memos — changed (1), removed (0), unchanged (9):**

| Memo | Change |
|---|---|
| `source` (lines 160–161) | The two memos `rawSource` and `source` collapse into a single `source` memo whose body is today's `rawSource` body: `useMemo(() => waterProfiles.find((p) => p.id === selectedSourceId) ?? null, [waterProfiles, selectedSourceId])`. Type stays `WaterProfile \| null`. The identifier `rawSource` no longer appears in the file. |

Unchanged: `sourceProfiles`, `targetProfiles`, `totalGrainKg`, `target`, `currentMiscs` (RA-8), `finishedIons` (RA-11), `ra`, `preAcidPredictedPh`, `liveMashPh`, `autoMashAcid`, `autoSpargeAcid`, `so4ClRatio`, `gristBreakdown`.

**New DOM contract — toggles.** Values exact; the executor must not paraphrase the labels.

| State | `id` | `data-testid` | Visible label text | Placement |
|---|---|---|---|---|
| `treatSpargeWater` | `treat-sparge-water` | `treat-sparge-water-toggle` | `Treat sparge water` | Section 3, grid cell 2, above the Sparge Water Minerals panel |
| `addMashAcid` | `add-mash-acid` | `add-mash-acid-toggle` | `Add mash acid` | Section 4, grid cell 1, above the Mash Acid Adjustment panel |
| `addSpargeAcid` | `add-sparge-acid` | `add-sparge-acid-toggle` | `Add sparge acid` | Section 4, grid cell 2, above the Sparge Water Acid panel |

Each toggle row: `<div className="flex items-center gap-2">` containing `<input type="checkbox" id={…} data-testid={…} checked={…} onChange={…} className="w-4 h-4 accent-amber-500 cursor-pointer" />` and `<label htmlFor={…} className="text-xs font-medium text-slate-300">{label}</label>`. `data-testid` goes on the `input`, so `fireEvent.click(getByTestId('treat-sparge-water-toggle'))` toggles it directly. Each checkbox resolves to its label as accessible name, so `getByLabelText('Treat sparge water')` also returns it.

**New DOM contract — Minerals Needed card.** Replaces the Section 2 card's `<h4>` text and its entire `<div className="overflow-x-auto">` table block (lines 459–508). The card's own container div, the header flex row, and the SO₄:Cl badge markup are retained (RA-10).

| Element | Contract |
|---|---|
| Card container | `data-testid="minerals-needed"`; keeps its existing `className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80"` |
| `<h4>` primary text | `Minerals Needed` (was `Finished Water Ions (ppm)`) |
| `<h4>` secondary text | `Total batch volume: {totalVolumeL.toFixed(1)} L` — **unchanged**, same `<span className="text-xs font-normal text-slate-400">` |
| Row (×5, `SALT_NAMES` order) | `data-testid={`mineral-needed-${slug(name)}`}` where `slug` is `name.toLowerCase().replace(/\s+/g, '-')` — the same slug shape `handleSave` already uses for misc ids |
| Row label | The salt name verbatim (`Gypsum`, `Calcium Chloride`, `Epsom Salt`, `Table Salt`, `Baking Soda`) |
| Row amount element | `data-testid={`mineral-needed-amount-${slug(name)}`}`; `textContent` is exactly `` `${total.toFixed(2)} g` `` — two decimals, one U+0020 space, lowercase `g`, nothing else inside the element |

Row amount styling (specified for determinism, **not** asserted by any AC so a later visual pass is free): `font-mono` with `text-slate-500` when `total === 0` and `text-slate-100` otherwise.

**Layout class strings — changed (1):**

| File | Element | Current value (exact) | Required value (exact) |
|---|---|---|---|
| `WaterCalculatorModal.tsx:395` | Section 1 grid container | `'grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80'` | `'grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80'` |

**Layout class strings — explicitly NOT changed:** Section 3's and Section 4's `grid grid-cols-1 md:grid-cols-2 gap-4` containers (RA-17); every panel's `bg-slate-900/50 p-4 rounded-xl border border-slate-800/80`; the modal backdrop, container, header, and footer markup in full (Milestone 25's reserved scope).

**Markup — removed:**

1. Lines 411–425 — the entire dilution grid cell: its `<div>`, the `RO / Distilled Dilution` label, the `{dilutionPct}%` readout span, and the `<input type="range" … className="w-full mt-2 accent-amber-500 cursor-pointer" />`.
2. Lines 459–508 — the ion table: the `overflow-x-auto` wrapper, the `<table>`, its six-column `<thead>`, and the six-entry `[{key,label}]` array with its `srcVal`/`finVal`/`addedVal`/`tgtVal`/`delta` row computation.

**Files modified (2):** `apps/web/src/components/WaterCalculatorModal.tsx`, `apps/web/test/WaterCalculatorModal.test.tsx`.
**Files created (0). Files deleted (0).**

---

## 2. Transformations & Pure Logic

### 2.1 Pure derivation — Minerals Needed total

The only new pure logic in this phase. It may be written inline in the render or as a module-local helper; if extracted, it stays module-local and is **not** exported (`designSystem.ts`-style export discipline does not apply here, but adding a new public export to a component module is out of scope).

```
mineralTotalGrams(
  name: SaltName,
  mashSalts: Record<SaltName, number>,
  spargeSalts: Record<SaltName, number>,
  treatSpargeWater: boolean,
): number
  → treatSpargeWater ? mashSalts[name] + spargeSalts[name]
                     : mashSalts[name]
```

- Never reads `spargeSalts` when `treatSpargeWater` is false, even though RA-4 guarantees it is zeroed — the display must be correct from the toggle alone, independent of the clearing behaviour, so that AC-9 and AC-10 are testing two separate mechanisms rather than one.
- No clamping, no `Math.max(0, …)`: both maps are already guarded at their input handlers (`Math.max(0, parseFloat(...) || 0)`) and by AUTO's non-negative output.
- Degenerate input: with both maps at their initial all-zero state, every row returns `0` and renders `0.00 g`.
- Rendered as `total.toFixed(2)`. `toFixed` handles float residue (`14.05 + 9.36 → 23.409999999999997 → "23.41"`), which is why the contract is defined on the rendered string, not on the float.

### 2.2 Pure logic — AUTO split ratio

`handleAutoAdjustSalts`'s only change is the ratio derivation (lines 232–233):

```
mashRatio   = treatSpargeWater
                ? (totalVolumeL > 0 ? effectiveMashL / totalVolumeL : 0.6)
                : 1
spargeRatio = 1 - mashRatio
```

- The existing `totalVolumeL > 0 ? … : 0.6` fallback is retained **inside** the sparge-on branch, unchanged.
- The `suggestSaltAdditions(source, target, totalVolumeL)` call is unchanged (RA-6).
- The `if (!target) return` early exit is unchanged: with no target profile, AUTO does nothing at all and neither salt map is written. `newSparge` is still built and still passed to `setSpargeSalts` when the function runs — with `spargeRatio === 0` it is an all-zero map, which is the correct state to write.
- Per-salt rounding is unchanged: `parseFloat((s.amountGrams * ratio).toFixed(2))` (see RA-14).

### 2.3 Stateful integration contract — toggle handlers

Three handlers, each synchronous, each doing exactly two things: set the flag, and zero what the flag governs when it goes false.

```
handleToggleTreatSparge(next: boolean): void
  → setTreatSpargeWater(next)
  → if (!next) setSpargeSalts({ Gypsum: 0, 'Calcium Chloride': 0, 'Epsom Salt': 0, 'Table Salt': 0, 'Baking Soda': 0 })
  → if (next)  do nothing else            // RA-5: no restore

handleToggleMashAcid(next: boolean): void
  → setAddMashAcid(next)
  → if (!next) setMashAcidAmount(0)       // mashAcidType untouched (RA-19)

handleToggleSpargeAcid(next: boolean): void
  → setAddSpargeAcid(next)
  → if (!next) setSpargeAcidAmount(0)     // spargeAcidType untouched (RA-19)
```

The zeroing object literal for `spargeSalts` is the same five-key shape already written twice in this file (lines 87–93, 220) — reuse the literal form, do not introduce a shared mutable default object (a shared object reference would alias across `setState` calls).

### 2.4 Stateful integration contract — conditional rendering

```
Section 1 (profiles):        grid cell 1 = Source select      (unchanged)
                             grid cell 2 = Target select      (unchanged markup, now column 2 of 2)

Section 3 (minerals grid, class string unchanged):
  cell 1: Mash Water Minerals panel                            — always rendered, unchanged
  cell 2: <div className="space-y-2">
            [treat-sparge-water toggle row]                    — ALWAYS rendered
            {treatSpargeWater && <Sparge Water Minerals panel/>}
          </div>

Section 4 (acids grid, class string unchanged):
  cell 1: <div className="space-y-2">
            [add-mash-acid toggle row]                         — ALWAYS rendered
            {addMashAcid && <Mash Acid Adjustment panel/>}
          </div>
  cell 2: <div className="space-y-2">
            [add-sparge-acid toggle row]                       — ALWAYS rendered
            {addSpargeAcid && <Sparge Water Acid panel/>}
          </div>
```

Panels are unmounted, never CSS-hidden (RA-15). Panel *internals* — every input, label, `id`, `aria-label`, `data-testid`, and class string inside the three panels — are unchanged; the panels are relocated into a wrapper div and gated, nothing more. In particular `aria-label={`Mash ${name}`}` / `aria-label={`Sparge ${name}`}`, `Mash Acid Dosage`, `Sparge Acid Dosage`, `targetMashPhInput`, `mashAcidTypeSelect`, `targetSpargePhInput`, `spargeAcidTypeSelect` all keep their current values.

Section 5 (Grist Distilled Water pH Baseline), the header (title, volumes line, Mash pH badge, Reset, AUTO, Close), and the footer (Cancel, Save Adjustments to Recipe) are untouched.

### 2.5 Stateful integration contract — `handleSave` guards

Three guard points, all additive. Everything else in `handleSave` — the `nonWaterMiscs` filter, the mash-salt write, both id templates, `use: 'Mash'`, `timeMinutes: 0`, the unit selection, the `onSaveAdjustments(...)` payload shape, and the trailing `onClose()` — is unchanged.

```
sparge salts:   if (treatSpargeWater && sGrams > 0)  { push `${name} (Sparge)` misc }
                (was: if (sGrams > 0))

mash acid:      if (addMashAcid && mashAcidAmount > 0)     { push mashAcidType misc }
                (was: if (mashAcidAmount > 0))

sparge acid:    if (addSpargeAcid && spargeAcidAmount > 0) { push `${spargeAcidType} (Sparge)` misc }
                (was: if (spargeAcidAmount > 0))
```

The mash-salt write is **not** guarded — mash minerals have no toggle and are always in scope.

### 2.6 No-match / fallback contracts

| Condition | Required behaviour |
|---|---|
| `target === null` (no target profile) | AUTO returns before writing anything; both salt maps keep their current values; the AUTO button is `disabled` (unchanged). Minerals Needed renders whatever is in state — five rows, `0.00 g` each on a fresh modal. |
| `source === null` (None / RO Water) | Unchanged behaviour: `calculateFinishedIons` and `suggestSaltAdditions` both treat a null source as 0 ppm on every ion via their own `source?.x ?? 0` guards. No component-level null handling is added. |
| All three toggles off | Section 3 renders the mash panel plus a lone toggle row in cell 2; Section 4 renders two lone toggle rows and no panels. The Section 4 grid container is **still rendered** (RA-17) — do not conditionally drop it. Saving writes mash salts only. |
| Every salt at 0 g | Minerals Needed still renders five rows at `0.00 g` (RA-13). No empty state, no row filtering. |
| `totalVolumeL === 0` | Unchanged: `calculateFinishedIons` early-returns the source ions, `suggestSaltAdditions` returns all-zero amounts, and AUTO's `mashRatio` falls back to `0.6` when sparge treatment is on / `1` when off. |

### 2.7 Refactoring & Legacy Cleanup

Leaving any of these behind is a phase failure, not a cosmetic leftover:

1. **`dilutionPct` is gone from the file entirely** — the `useState` declaration, the `setDilutionPct(0)` line in `handleReset`, the memo dependency, and the two JSX references. A source sweep for `dilutionPct` and for `dilution` (case-insensitive) must return zero matches (AC-13).
2. **`calculateDilutedWaterProfile` is gone from this file's import list** and is not called anywhere in `apps/web/src`. It remains exported from `water.ts` (RA-1). No re-export shim, no local wrapper.
3. **`rawSource` no longer exists** — one `source` memo, not two chained ones (RA-2).
4. **The ion table markup is deleted, not commented out or left behind a flag.** No `Finished Water Ions` string, no `<table>` element, and no `Added`/`Finished`/`Delta` column header text remains in the file. The six-entry ion label array (`Calcium (Ca²⁺)` … `Bicarbonate (HCO₃⁻)`) is deleted with it.
5. **`accent-amber-500` on a `type="range"` input no longer exists in this file** — the only range input is deleted. The string itself may legitimately reappear on the three new checkboxes (RA-22).
6. **No new class-string constant** is declared at module scope, and none of the five existing ones is edited — M24's reserved scope (M23_P1 RA-3), and `INPUT_CLASS`'s `w-full` layout fix must survive verbatim.
7. **No modal chrome change** — backdrop, container, `role`/`aria-modal`/`aria-labelledby`, header, and footer markup are all Milestone 25's scope and are untouched here.
8. **`packages/calculations/src/water.ts` is not opened.** If the executor finds itself editing it, that is the signal it has strayed out of scope — stop and re-read RA-1.

---

## 3. Acceptance Criteria & Test Matrix

Tests extend the existing `apps/web/test/WaterCalculatorModal.test.tsx` (created by M23_P1). Its five existing describe blocks are preserved verbatim (RA-22); new blocks are appended. No other test file is created or edited.

**Shared fixture for AC-1…AC-21** unless stated otherwise: `waterVolumeL={23}`, `mashWaterL={13.8}`, `spargeWaterL={9.2}`, `waterProfiles` = the file's existing `WATER_PROFILES` (`wp-source-1` RO at 0 ppm on every ion; `wp-target-1` Balanced IPA at Ca 100 / Mg 10 / Na 10 / Cl 60 / SO₄ 150 / HCO₃ 40), `waterTargetId="wp-target-1"`, `fermentables` = the file's existing single 5 kg Pale 2-Row, `miscs={[]}`. `waterSourceId` may be `null` or `"wp-source-1"` — both yield identical numbers, since `suggestSaltAdditions` reads a null source as 0 ppm.

**Verified AUTO reference values** at this fixture (computed at spec time from `suggestSaltAdditions` + the §2.2 ratio, `mashRatio` exactly `0.6`):

| Salt | Suggested (23 L) | Mash (×0.6) | Sparge (×0.4) | Needed, sparge ON | Needed, sparge OFF |
|---|---|---|---|---|---|
| Gypsum | 23.41 | 14.05 | 9.36 | `23.41 g` | `23.41 g` |
| Calcium Chloride | 10.87 | 6.52 | 4.35 | `10.87 g` | `10.87 g` |
| Epsom Salt | 8.85 | 5.31 | 3.54 | `8.85 g` | `8.85 g` |
| Table Salt | 0 | 0 | 0 | `0.00 g` | `0.00 g` |
| Baking Soda | 4.82 | 2.89 | 1.93 | `4.82 g` | `4.82 g` |

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | Three toggles render, default ON | Unit (RTL) | On open, each of `treat-sparge-water-toggle`, `add-mash-acid-toggle`, `add-sparge-acid-toggle` resolves to exactly one element, each is `type="checkbox"`, each `toBeChecked()`. `getByLabelText('Treat sparge water')`, `getByLabelText('Add mash acid')`, `getByLabelText('Add sparge acid')` each return that same checkbox (proving the `htmlFor`/`id` pairing) |
| AC-2 | Default-ON preserves the M23_P1 surface | Unit (RTL) | With no toggle interaction: `getByLabelText('Sparge Gypsum')`, `getByLabelText('Mash Gypsum')`, `getByLabelText('Mash Acid Dosage')`, `getByLabelText('Sparge Acid Dosage')` all resolve; `getByText('Sparge Water Minerals')`, `getByText('Mash Acid Adjustment')`, `getByText('Sparge Water Acid')` all present |
| AC-3 | Toggles reset to ON when the modal reopens (RA-3) | Integration (RTL) | Render open, click all three toggles off, rerender with `isOpen={false}`, then rerender with `isOpen={true}`: all three checkboxes are `checked` again and all three panels are back |
| AC-4 | Sparge OFF unmounts the panel, not just hides it (RA-15) | Integration (RTL) | Click `treat-sparge-water-toggle`: `queryByText('Sparge Water Minerals')` is `null`, and `queryByLabelText('Sparge Gypsum')` … `queryByLabelText('Sparge Baking Soda')` are all `null` (all five). The `treat-sparge-water-toggle` checkbox itself is still in the document and now unchecked. `getByLabelText('Mash Gypsum')` still resolves — the mash panel is unaffected |
| AC-5 | Each acid toggle OFF unmounts only its own panel | Integration (RTL) | Click `add-mash-acid-toggle`: `queryByText('Mash Acid Adjustment')` is `null`, `queryByLabelText('Mash Acid Dosage')` is `null`, `queryByLabelText('targetMashPhInput')`-bound input gone; **`getByText('Sparge Water Acid')` and `getByLabelText('Sparge Acid Dosage')` still resolve**. Symmetrically for `add-sparge-acid-toggle` with the two roles swapped. Both toggle checkboxes remain in the document throughout |
| AC-6 | Toggling sparge OFF zeroes `spargeSalts`; toggling back ON does not restore (RA-4, RA-5) | Integration (RTL) | Click AUTO (sparge salts populate — `Sparge Gypsum` input has value `9.36`), click `treat-sparge-water-toggle` off, click it on again: `getByLabelText('Sparge Gypsum')` renders empty (the component displays `''` for `0`) and every other sparge salt input is empty too. `getByLabelText('Mash Gypsum')` still shows `14.05` — the mash side was not disturbed |
| AC-7 | Toggling an acid section OFF zeroes only its own amount (RA-19) | Integration (RTL) | Type `3.5` into `Mash Acid Dosage` and `2.1` into `Sparge Acid Dosage`. Click `add-mash-acid-toggle` off then on: `Mash Acid Dosage` is empty, **`Sparge Acid Dosage` still reads `2.1`**. The Acid Type select, on re-enable, still shows its previously selected type (assert `mashAcidTypeSelect` value is unchanged from what was set before the toggle) |
| AC-8 | AUTO splits mash/sparge proportionally when sparge is ON | Integration (RTL) | Click `water-auto-btn`. Mash inputs read `14.05` / `6.52` / `5.31` / empty / `2.89` and sparge inputs read `9.36` / `4.35` / `3.54` / empty / `1.93` for Gypsum / Calcium Chloride / Epsom Salt / Table Salt / Baking Soda respectively (Table Salt is `0` → rendered as empty by the existing `=== 0 ? '' :` display rule) |
| AC-9 | AUTO doses 100% into mash when sparge is OFF (RA-6) | Integration (RTL) | Click `treat-sparge-water-toggle` off, then `water-auto-btn`. Mash inputs read `23.41` / `10.87` / `8.85` / empty / `4.82`. Toggle sparge back on: all five sparge inputs are empty — AUTO wrote zeros there, and re-enabling restores nothing (RA-5) |
| AC-10 | Minerals Needed sums mash+sparge when ON, mash-only when OFF | Integration (RTL) | Sparge ON + AUTO: `mineral-needed-amount-gypsum` textContent is exactly `23.41 g`, `-calcium-chloride` `10.87 g`, `-epsom-salt` `8.85 g`, `-table-salt` `0.00 g`, `-baking-soda` `4.82 g`. Then, **without re-running AUTO**, toggle sparge off: gypsum becomes `14.05 g` (mash only) — proving the summary reads the toggle, not just the zeroed state. Then AUTO again: back to `23.41 g` |
| AC-11 | Minerals Needed replaces the ion table | Unit (RTL) | `getByTestId('minerals-needed')` present; its `<h4>` contains `Minerals Needed`. `queryByText('Finished Water Ions (ppm)')` is `null`. `container.querySelector('table')` is `null` for the whole modal. `queryByText('Bicarbonate (HCO₃⁻)')` is `null` |
| AC-12 | Five rows always, in `SALT_NAMES` order, including zeros (RA-13) | Unit (RTL) | On a fresh modal with no AUTO: all five `mineral-needed-<slug>` rows present, each amount exactly `0.00 g`. Their document order is Gypsum, Calcium Chloride, Epsom Salt, Table Salt, Baking Soda (asserted via `getAllByTestId(/^mineral-needed-[a-z-]+$/)`-style ordered collection or an explicit ordered testid array) |
| AC-13 | Dilution is fully gone (RA-24 cleanup item 1) | Unit (RTL) + source sweep | `queryByText('RO / Distilled Dilution')` is `null`; `container.querySelector('input[type="range"]')` is `null`. Source sweep of `WaterCalculatorModal.tsx`: zero matches for `/dilution/i` and zero for `calculateDilutedWaterProfile` |
| AC-14 | `source` is the raw profile — no rounding shim (RA-2) | Source sweep | The file contains exactly one `const source = useMemo(` and zero occurrences of `rawSource`. The `source` memo body contains `waterProfiles.find` (i.e. it is the finder, not a wrapper around one) |
| AC-15 | `calculateDilutedWaterProfile` survives in the engine (RA-1) | Verification | `packages/calculations/src/water.ts` still exports `calculateDilutedWaterProfile`; `packages/calculations/test/water.test.ts` still imports and exercises it; the calculations workspace test suite passes with an unchanged test count. Both files hash-identical per AC-24 |
| AC-16 | Save with sparge OFF writes no sparge-tagged salt misc (RA-4, RA-21) | Integration (RTL) | AUTO, toggle sparge off, click `save-water-adjustments-btn`: the `onSaveAdjustments` payload's `miscs` array contains **zero** items whose `name` includes `(Sparge)`, and contains a `Gypsum` mash item. Assert on the whole array (`miscs.filter(m => m.name.includes('(Sparge)'))` has length `0`), not on a single index |
| AC-17 | Save with sparge ON still writes sparge-tagged salt miscs | Integration (RTL) | AUTO then save with no toggling: the payload contains both a `Gypsum` item at `9.36`-worth mash/sparge split — specifically one item named `Gypsum` (amount `14.05`) and one named `Gypsum (Sparge)` (amount `9.36`). This pins that the guard did not over-fire |
| AC-18 | Save with an acid toggle OFF writes no acid misc for that section, even with a stale amount (RA-4) | Integration (RTL) | Type `3.5` into `Mash Acid Dosage` and `2.1` into `Sparge Acid Dosage`, toggle `add-mash-acid` off, save: payload contains **no** item named `Lactic Acid 88%` and **does** contain one named `Lactic Acid 88% (Sparge)` at `2.1`. Symmetric case: toggle `add-sparge-acid` off instead → payload has the mash acid and no `(Sparge)` acid |
| AC-19 | Save with all three toggles OFF writes mash salts only | Integration (RTL) | AUTO, type both acid dosages, toggle all three off, save: every item in the payload's `miscs` is either a non-`WaterAgent` item or a mash salt whose `name` is in `SALT_NAMES`; zero items contain `(Sparge)`; zero items are named any of the three `ACID_TYPES` |
| AC-20 | SO₄:Cl badge and Mash pH badge are unchanged (RA-9, RA-10) | Integration (RTL) | `getByText(/SO₄²⁻ : Cl⁻ Ratio:/)` resolves and lives inside `getByTestId('minerals-needed')`. `getByTestId('modal-predicted-mash-ph')` present, text matches `/Mash pH/` and a `\d\.\d\d` value. After toggling `add-mash-acid` off with a non-zero dosage entered, the badge's numeric value **changes** (acid no longer applied) while the badge element and testid remain — asserted as "value before ≠ value after", not against a hardcoded pH |
| AC-21 | Layout guardrails (RA-17, RA-18) | Source sweep | `WaterCalculatorModal.tsx` contains zero occurrences of `md:grid-cols-3`; it contains at least two occurrences of `md:grid-cols-2` (Sections 3 and 4) plus the converted Section 1. No conditional expression appears inside any `grid-cols` class string (asserted as: no `grid-cols` occurrence on a line also containing `?` or `&&`) |
| AC-22 | Prop contract and call site unchanged | Typecheck + source sweep | `tsc -b` passes with no edit to `WaterSection.tsx`. `WaterCalculatorModalProps` still declares exactly the 12 members listed in §1.1, and `onSaveAdjustments`'s parameter object still has exactly `waterSourceId`, `waterTargetId`, `miscs`. `apps/web/test/WaterSection.test.tsx` passes unmodified — including its `SO₄²⁻ : Cl⁻ Ratio:` assertion at line 134 (RA-10, RA-23) |
| AC-23 | M23_P1's assertions still hold (RA-22) | Unit (RTL) + source sweep | The five pre-existing describe blocks in `WaterCalculatorModal.test.tsx` (AC-2 dialog semantics, AC-3 closed state, AC-5 palette, AC-6 no `red-*`, AC-7 form backgrounds incl. the `bg-slate-950/60` survival check) pass **unmodified** — their source text is byte-identical to the pre-phase file. `INPUT_CLASS` still contains `w-full`. `apps/web/test/ScopeGuardrail.test.tsx` passes unmodified, including its `role="dialog"` + `aria-modal="true"` sweep over this file |
| AC-24 | **Scope Guardrail** (RA-24 — `git diff` is NOT viable here) | Verification | This repo has **1 commit** and `apps/web/` is absent from `HEAD`, so `git diff --name-only <base>` cannot distinguish executor changes from pre-existing uncommitted state and **must not** be used for this criterion. Instead: **before the first edit**, run `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum \| sort -k2 > <scratch>/manifest_pre.txt`; **after the last edit**, the same command into `manifest_post.txt`; `diff manifest_pre.txt manifest_post.txt` shows changed hashes for **exactly two** repo files: `apps/web/src/components/WaterCalculatorModal.tsx` and `apps/web/test/WaterCalculatorModal.test.tsx` (plus `.gsd/STATE.json`, `.gsd/BUGS.md`, `.gsd/ROADMAP.md`, and this spec, which are framework bookkeeping). **Hash-identical, asserted explicitly:** `packages/calculations/src/water.ts`, `packages/calculations/test/water.test.ts`, `apps/web/src/components/WaterSection.tsx`, `apps/web/test/WaterSection.test.tsx`, `apps/web/src/components/designSystem.ts`, `apps/web/test/designSystem.test.ts`, `apps/web/test/ScopeGuardrail.test.tsx`, `apps/web/test/calculatorImportGraph.test.ts`, `apps/web/src/App.tsx`, `apps/web/src/pages/BatchDetail.tsx`, `apps/web/src/components/RecipeImportModal.tsx`, and everything else under `apps/api/`, `packages/`, and `apps/web/` |
| AC-25 | Test count moves by exactly the new tests | Verification | No existing test is deleted or rewritten. The executor **reports `T_new` explicitly** in its Layer 1 output, and the post-phase `apps/web` total equals the pre-phase total + `T_new`. `packages/calculations`' total is **unchanged** (AC-15). Any other delta means a pre-existing test broke or was silently dropped |
| AC-26 | All four Layer 1 gates green (HARD_RULES rule 13) | Verification | `test` **and** `typecheck` **and** `build` **and** `lint` each exit `0` across all four workspaces (`shared-types`, `calculations`, `web`, `api`). Lint's pre-existing `react/only-export-components` warnings are the accepted baseline — exit code `0`, and **no new** warning classes introduced |

---

## Notes on backlog linkage

- **`.gsd/BUGS.md` — `BUG-024` created by this `/plan` pass** (RA-25): *"`suggestSaltAdditions` greedy fixed-order dosing overshoots later ions in the priority chain"*. Status `DEFERRED_TO_MILESTONE` — explicitly **out of scope** for M23_P2's code changes per user instruction; logged so the finding is not lost. Its entry carries the empirically reproduced deltas (SO₄ +39.6 ppm, Na +6.8 ppm, Ca −3.4 ppm at the 23 L / 0 ppm-source / Balanced-IPA-target case), which correct the informally reported "30–40 ppm on Calcium/Sodium/Sulfate".
- **`.gsd/FEATURES.md` — nothing set to `IN_PLANNING`.** The only related item is **`FEAT-012`** (the Brewfather-style water chemistry modal itself), whose status is `CLOSED` (delivered and verified in Milestone 21 Phase 1). This phase amends delivered behaviour rather than continuing unfinished feature work, so reopening a closed backlog item would misrepresent it. No other FEAT item covers sparge/acid toggles, dilution, or the minerals summary. Highest existing ids at spec time: `FEAT-020`, `BUG-024` (this one).
- **`.gsd/ROADMAP.md` — Milestone 23's "Estimated phases" updated from `1` to `2`** in the same pass, since M23_P1's line explicitly stated no Phase 2 was expected.

---
> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
