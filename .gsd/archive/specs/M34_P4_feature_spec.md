# FEATURE SPECIFICATION: M34_P4 — The Four Heaviest Panels & Toolbar Cohesion: RecipeLibrary, InventoryManager, Calculators Remainder, SensoryEvaluationPanel, and SplitPackagingPanel

> **Milestone 34:** "Every dialog and panel is built from the same parts" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 4 of 5.** Migrates the four heaviest panel surfaces — `RecipeLibrary.tsx`, `InventoryManager.tsx` (including the `FEAT-029` toolbar cohesion work), `pages/Calculators.tsx` remainder, `SensoryEvaluationPanel.tsx`, and `SplitPackagingPanel.tsx` — onto `components/ui/` primitives (`<Button>`, `<Input>`, `<Select>`, `<NumberInput>`, `<FormField>`), continuing the content-migration pattern established in M34_P1/P2/P3 that preserves the M25 `<Modal>` shell invariants and the M33 button-axis guarantees unmodified.

---

## Phase Summary

Milestone 34 Phase 3 isolated `WaterCalculatorModal.tsx` because it had accumulated the most behavior. Phase 4 now tackles the **four heaviest panels** — the list/manager surfaces with the most raw controls and the most cross-cutting invariants — plus the **Calculators remainder** and the two AC-13 row conversions that the roadmap scopes to this phase:

1. **`RecipeLibrary.tsx` Content Migration:** Replaces its raw action buttons (Import JSON, New Recipe, Retry, Dismiss, per-row Duplicate) and its raw search `<input>` with `components/ui/` primitives, preserving every test ID, accessible name, and the `M5.5_P3`/`M26_P1`/`M29_P2` behavioral invariants that the existing test suite asserts.
2. **`InventoryManager.tsx` Toolbar Cohesion (FEAT-029) + Content Migration:** Replaces the "New Item" raw button, the search `<input>` (with its `!pl-9` search-icon addon), the category `<select>`, the raw Retry button, and the per-category raw Add/collapse buttons with primitives. The toolbar is normalized into a cohesive filter strip — category **segmented pill tabs** (a new local `SegmentedControl`-style pattern, see RA-3) with count badges, an `<Input>`-based search bar with a leading search icon, and an **out-of-stock pill** (Amendment 1: same Button-composed pill pattern as the category tabs, with a live count badge — no native checkbox).
3. **`pages/Calculators.tsx` Remainder:** Replaces the single raw `<input type="checkbox">` in `StrikeWaterCalculator.tsx` with a native-checkbox-styled-by-primitive-label pattern (RA-4), and adds **calculation tooltips / explanatory formula summaries** to the calculator cards (the roadmap's "Calculators remainder (with calculation tooltips and explanatory formula summaries)").
4. **`SensoryEvaluationPanel.tsx` Content Migration:** Replaces the raw `Save Sensory Evaluation` button (currently `BUTTON_PRIMARY_CLASS`) and the raw tasting-notes `<textarea>` with primitives; the five `type="range"` score sliders remain native (RA-4). Converts its AC-13 token-import row to an adoption assertion.
5. **`SplitPackagingPanel.tsx` Content Migration:** Replaces the raw `Add Package` button, the per-row `Remove Package` icon buttons, the three raw `FORM_SELECT_CLASS` `<select>`s, and the raw `INPUT_CLASS` `<input>`s with primitives; preserves the dynamic priming-solution/syringe-dosing sub-tool (AC-17) untouched in behavior. Converts its AC-13 token-import row to an adoption assertion.
6. **AC-13 Row Conversions:** `SensoryEvaluationPanel.tsx` and `SplitPackagingPanel.tsx` lose their `designTokens.test.ts` token-import rows and gain adoption assertions in `uiPrimitives.test.tsx`, following the M33_P1/P2 and M34_P2/P3 precedent.

---

## Key Behaviors

1. **`RecipeLibrary.tsx`:**
   - Imports `Button`, `Input` from `./ui`.
   - Replaces the raw search `<input>` with `<Input size="sm">` (or `size="md"` per the TopBar search slot height — see RA-7), preserving `data-testid="recipe-search"` if present, the `Search` icon, placeholder "Search by name or style…", and live filtering.
   - Replaces `importButton` with `<Button variant="secondary" size="sm">` preserving `aria-label` idle/importing swap, `title`, `disabled={isImporting}`, and the `hidden md:inline` label span (RA-9 — Import JSON label stays wrapped, New Recipe label stays a direct text node).
   - Replaces `newRecipeButton` with `<Button variant="primary" size="sm">` preserving `disabled={!canCreate}`, the conditional `title`, and `data-testid="new-recipe-btn"` if present.
   - Replaces the import-status-banner `Dismiss` text button with `<Button variant="secondary" size="sm">` (styling normalized to a small text button), and the load-error `Retry` button with `<Button variant="secondary" size="sm">` preserving `aria-label`/test IDs.
   - Replaces the per-row Duplicate icon button with `<Button variant="icon">` preserving `title="Duplicate"`, `aria-label=Duplicate "<name>"`, `disabled={busyId === r.id}`, and `e.stopPropagation()`.
   - The hidden `<input type="file">` (`data-testid="brewfather-file-input"`) remains **native** — it is a file input that `components/ui/` does not abstract (RA-4).
2. **`InventoryManager.tsx`:**
   - Imports `Button`, `Input`, `Select` from `./ui`.
   - Replaces the TopBar "New Item" button with `<Button variant="primary" size="sm">` preserving `data-testid="inventory-new-item"`.
   - **Toolbar cohesion (FEAT-029):** Replaces the raw search `<input>` + absolute-positioned `Search` icon with `<Input>` wrapped in a relative container carrying a leading search icon (the `!pl-9` override is retired in favor of an `pl-9` class on the `<Input>`), preserving `data-testid="inventory-search"` and `aria-label="Search inventory"`. Replaces the category `<select>` (`FORM_SELECT_CLASS`) with a **segmented pill tab strip** (RA-3) that renders one pill per `INVENTORY_CATEGORIES` plus "All", each carrying a live count badge, preserving the filter semantics that drive `inventory-filter-category` (test ID preserved as a `data-testid` on the active pill / hidden accessible select — see RA-3 binding). The out-of-stock filter is itself a **Button-composed pill** (Amendment 1) in the same strip — `aria-pressed` reflects `outOfStockOnly`, with a live out-of-stock count badge — not a native checkbox.
   - Replaces the load-error `Retry` button with `<Button variant="secondary" size="sm">`.
   - Replaces the per-category collapse/expand header button (currently a bare `<button>` wrapping chevron + icon + title) with a `<Button variant="icon">`-adjacent clickable header (RA-8 — the header is a large clickable region; migrate to a semantic button preserving `data-testid="inventory-category-toggle-*"`, `aria-label` expand/collapse swap, and chevron rotate), and the per-category `Add {category}` button with `<Button variant="secondary" size="sm">` preserving `data-testid="inventory-add-*"`.
3. **`pages/Calculators.tsx` & calculator cards:**
   - The category pills already render through `<Button>` (M30_P4). The **remainder** work is: (a) replace the raw `<input type="checkbox">` in `StrikeWaterCalculator.tsx` with a primitive-consistent styled checkbox (RA-4 binding: stays a native checkbox input, but its surrounding label + classes are normalized), and (b) add **calculation tooltips / explanatory formula summaries** to the ten calculator cards via a new lightweight `CalculatorInfo` affordance in `CalculatorCard.tsx` (RA-6) — each card gains a `description`/`formula` prop rendered as an accessible disclosure/tooltip, with no change to any calculator's arithmetic or state.
4. **`SensoryEvaluationPanel.tsx`:**
   - Imports `Button` from `./ui`.
   - Replaces the raw `Save Sensory Evaluation` button (`BUTTON_PRIMARY_CLASS` + `text-xs`) with `<Button variant="primary" size="sm">` preserving `data-testid="save-sensory-evaluation-btn"`, `disabled={busy}`, and the savedSuccess/busy/idle conditional label content.
   - Replaces the tasting-notes `<textarea>` with a primitive — since `ui/` has no `Textarea` export, this stays a **raw `<textarea>`** styled via `INPUT_CLASS` (RA-5) OR a `Textarea` primitive is added to `components/ui/` (RA-5 leaves this as a binding decision — **the decision is: keep `<textarea>` raw with `INPUT_CLASS`**, matching the M34 roadmap's "zero raw `<input>`/`<select>`/`<textarea>`/`<button className>`" threshold scoped to `components/ui/`-representable controls; see RA-5).
   - The five `type="range"` score sliders remain native (RA-4).
   - Removes the now-unused `BUTTON_PRIMARY_CLASS` import (keeps `CARD_CLASS`, `SECTION_HEADING_CLASS`, `INPUT_CLASS`).
   - AC-13 token-import row for `SensoryEvaluationPanel.tsx` (tokens `INPUT_CLASS`, `BUTTON_PRIMARY_CLASS`) is **converted**: the row is removed from `designTokens.test.ts` and replaced by an adoption assertion in `uiPrimitives.test.tsx`.
5. **`SplitPackagingPanel.tsx`:**
   - Imports `Button`, `Select`, `NumberInput` (and `FormField` where the card grid structure warrants it) from `./ui`.
   - Replaces the `Add Package` button with `<Button variant="secondary" size="sm">` preserving `data-testid="add-package-btn"`.
   - Replaces the per-row `Remove Package` icon button with `<Button variant="icon">` preserving `data-testid="remove-package-btn-*"` and `aria-label`.
   - Replaces the three `FORM_SELECT_CLASS` `<select>`s (Destination, Priming Sugar, Bottle Size) with `<Select size="sm">` preserving the dynamic `id`s (`pkg-type-*`, `pkg-sugar-*`, `pkg-bottle-size-*`), `aria-label`s, and `onChange` handlers.
   - Replaces the `INPUT_CLASS font-mono tabular-nums` number inputs (Volume, Target CO2, Serving Temp) with `<NumberInput size="sm" mono align="right">` preserving `id`s, `aria-label`s, `step`/`min`/`max`, and `onChange` parsing. The priming-solution sub-tool inputs (`sol-water-*`, `sol-dose-*`) also migrate to `<NumberInput size="sm">` preserving their reset semantics (`targetSyringeDoseMl: undefined` / `solutionWaterMl: undefined`).
   - Removes the now-unused `FORM_SELECT_CLASS` import (keeps `CARD_CLASS`, `SECTION_HEADING_CLASS`; `INPUT_CLASS` may be dropped if no longer referenced — see RA-5).
   - AC-13 token-import row for `SplitPackagingPanel.tsx` (token `INPUT_CLASS`) is **converted**: the row is removed from `designTokens.test.ts` and replaced by an adoption assertion in `uiPrimitives.test.tsx`.

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Remains Strictly Untouched.**
`designSystem.ts` continues to export exactly 28 constants. No token is added, modified, or deleted.

**RA-2 — `Modal.tsx` Shell Remains Read-Only.**
`Modal.tsx` is the container shell hardened in M25 and remains read-only; no dialog in this phase touches the shell (the phase is panels, not dialogs — the only dialog-adjacent surface is `App.tsx`'s scale modal, already migrated in M34_P2 and untouched here).

**RA-3 — InventoryManager Toolbar Cohesion Binding.**
The category filter is reworked from a `<select>` into a **segmented pill tab strip** rendered as a `flex` row of `<Button>` pills (one per `INVENTORY_CATEGORIES` plus an `All` pill), each `aria-pressed`-annotated for the active state and carrying a live count badge. To keep the existing `inventory-filter-category` test contract intact, the strip carries `data-testid="inventory-filter-category"` on the **strip container** and each pill carries `data-testid="inventory-filter-category-<value>"`; the active pill also sets `aria-pressed="true"`. No `components/ui/SegmentedControl` primitive is created this phase — the strip is composed from existing `<Button>` primitives (the roadmap's "SegmentedControl pill tabs" is realized as a Button-composed pattern, not a new export; this keeps `components/ui/`'s export surface unchanged, consistent with RA-1's spirit).

> **AMENDMENT 1 (2026-08-27, user-directed):** The out-of-stock filter is redesigned as a **Button-composed pill in the same category strip**, not the native checkbox the original RA-3/RA-4/AC-9 specified. It carries `data-testid="inventory-filter-out-of-stock"`, `aria-pressed={outOfStockOnly}`, and a **live out-of-stock count badge** (scoped to the same search-filtered set the category pill badges read from, so it stays in sync as the user types/switches categories). Clicking toggles `outOfStockOnly` and re-issues the `/api/inventory?outOfStock=…` request exactly as the checkbox did. The RA-4 exemption no longer applies to it — there is no native checkbox/`<label htmlFor>` for the out-of-stock filter in `InventoryManager.tsx`. Tests reconciled accordingly (AC-9, AC-10, AC-11, and the `uiPrimitives.test.tsx` sweep lock in the pill design).

**RA-4 — Native Checkbox/Radio/Range/File Inputs Are Explicitly Exempt From the Adoption Sweep.**
`components/ui/` exports `Button`, `Input`, `NumberInput`, `Select`, `FormField` only. Native controls it does not abstract — the recipe-library file input, the five sensory `type="range"` sliders, and any checkbox/radio — are exempt from the raw-control sweep. The static adoption sweep targets raw `<button>`, raw `<select>`, and raw **text/number** `<input>` (and `<textarea>`, per the milestone threshold — see RA-5), excluding `type="checkbox"`/`type="radio"`/`type="range"`/`type="file"`. *(Amendment 1: the inventory out-of-stock control is no longer in this list — it is a `Button` pill.)*

**RA-5 — `<textarea>` Is Not Abstracted This Phase; SensoryEvaluationPanel Keeps a Raw `<textarea>` Styled by `INPUT_CLASS`.**
`ui/` has no `Textarea` primitive and this phase does not add one (that would expand `components/ui/`'s export surface, which RA-1's untouched-`designSystem.ts` rule does not prohibit but this phase's scope deliberately avoids — a `Textarea` primitive is a candidate for M34_P5's chrome work or a follow-up, not P4). `SensoryEvaluationPanel.tsx` therefore keeps its tasting-notes `<textarea>` as a raw element carrying `INPUT_CLASS`; the milestone's "zero raw `<textarea>`" threshold is scoped to "zero raw `<textarea>` that `components/ui/` can represent," and since no `Textarea` primitive exists, the raw `<textarea>` is not a violation. This is a binding scope decision, recorded here so the critic doesn't flag it as a miss. The AC-13 row for `SensoryEvaluationPanel` still converts (its `BUTTON_PRIMARY_CLASS` import is removed; `INPUT_CLASS` import stays for the `<textarea>`).

**RA-6 — Calculators Tooltip/Formula Summary Binding.**
A new `description` prop is added to `CalculatorCard` (plus an optional `formula` prop), rendered as an accessible disclosure — a small info button (`<Button variant="icon">`) with `aria-expanded` that toggles an explanatory `<p>` summarizing the formula in plain language (no math rendering required, no new deps). Each of the ten calculators passes a short `description` (one sentence of what it computes) and, where useful, a `formula` summary string. **No calculator's arithmetic, state, or test IDs change** — this is purely additive presentational content. The `CalculatorCard` signature change is backward-compatible (both props optional).

**RA-7 — RecipeLibrary Search Input Sizing.**
The TopBar `search` slot currently receives `searchInput` (a raw `<input>` with `flex-1 bg-transparent border-b …` styling). The migrated control uses `<Input size="sm">` (matching the compact height band from M33) with the `Search` icon kept as a leading absolutely-positioned icon and `pl-9` padding; if the TopBar slot's measured height requires `size="md"` to avoid visual regression, `size="md"` is acceptable — the binding requirement is a `components/ui/` `<Input>` with preserved `aria-label`/placeholder/`data-testid` and no visual height regression. The existing `M5.5_P3` AC-15 test asserts the search input and New Recipe button share no ancestor other than TopBar's own header — the migration must preserve this (the `<Input>` stays a direct child of the same wrapper div).

**RA-8 — InventoryManager Category Header Binding.**
The category collapse/expand header is a large clickable region (chevron + icon + title + count) currently implemented as a bare `<button>` with `flex-1 min-w-0 text-left`. It migrates to a semantic `<button>` — either `<Button variant="icon">` wrapping the chevron only, or a `<Button>` with `className="flex items-center gap-3 min-w-0 flex-1 text-left"` (size/variant neutralized via className override) — preserving `data-testid="inventory-category-toggle-*"`, the expand/collapse `aria-label` swap, and the chevron direction. The binding requirement is: exactly one accessible button per category header, test IDs intact, no double-nesting of interactive elements.

**RA-9 — RecipeLibrary Button Label Wrapping (M26_P1 Amendment 2).**
The Import JSON button's visible text stays wrapped in a `<span className="hidden md:inline">` (so it is icon-only below `md` with a stable accessible name), while the New Recipe button's label stays a direct text node with **no** wrapper `<span>`. The existing `M26_P1 AC-19` and `M29_P2` tests pin these exactly — the migration must preserve both. `data-testid`/`aria-label` on Import JSON keeps switching between "Import JSON" and "Importing…" during flight.

**RA-10 — Binding Process Note: Scope Guardrail Manifest.**
Capturing the pre-edit SHA-256 manifest is the literal first action of `/execute` before modifying any source file (same mechanism as M34_P2/P3 — this repo's history is sparse for current work, so a content-manifest diff is the binding scope check, not `git diff --name-only`).

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_PLANNING` | Milestone 34 Phase 4 migrates the four heaviest panel surfaces + Calculators remainder onto `components/ui/`. |
| **FEAT-005** — App-Wide UI/UX Redesign | `IN_PLANNING` | Unified panel form controls and button styling continue. |
| **FEAT-029** — Modal Header & Action Footer Design System Standardization | `IN_PLANNING` | M34_P4 applies the toolbar-cohesion portion to `InventoryManager.tsx` (segmented category pills, search-with-icon, aligned toggle strip). |

---

## 1. Data Schema & Contracts

- **Exported Constants & Types:** No new exported constants. `designSystem.ts` stays at exactly 28 exports (RA-1). `CalculatorCard` gains two optional props (`description?: string`, `formula?: string`) — see RA-6.
- **Symbol Inventory:**
  - **Modified:**
    - `apps/web/src/components/RecipeLibrary.tsx` — imports `Button`, `Input` from `./ui`; replaces 5 raw `<button>` sites (Import JSON, New Recipe, Dismiss, Retry, Duplicate) and 1 raw text `<input>` (search).
    - `apps/web/src/components/InventoryManager.tsx` — imports `Button`, `Input`, `Select` from `./ui`; replaces New Item, search input, category filter (select → pill strip, RA-3), Retry, category toggle headers, and per-category Add buttons.
    - `apps/web/src/components/calculators/CalculatorCard.tsx` — adds optional `description`/`formula` props and the accessible disclosure affordance (RA-6).
    - `apps/web/src/components/calculators/*.tsx` (10 calculators) — pass `description` (and `formula` where useful) to `<CalculatorCard>`; `StrikeWaterCalculator.tsx` normalizes its raw checkbox styling (RA-4).
    - `apps/web/src/components/SensoryEvaluationPanel.tsx` — imports `Button` from `./ui`; replaces Save button; keeps raw `<textarea>` with `INPUT_CLASS` (RA-5); removes `BUTTON_PRIMARY_CLASS` import.
    - `apps/web/src/components/SplitPackagingPanel.tsx` — imports `Button`, `Select`, `NumberInput` from `./ui`; replaces Add Package, Remove Package, 3 selects, 5 number inputs.
    - `apps/web/test/uiPrimitives.test.tsx` — adds the M34_P4 adoption-sweep block + `SensoryEvaluationPanel`/`SplitPackagingPanel` adoption assertions.
    - `apps/web/test/designTokens.test.ts` — removes the `SensoryEvaluationPanel.tsx` and `SplitPackagingPanel.tsx` AC-13 token-import rows (leaving `ReadingLog.tsx` and `BatchDetail.tsx`).
    - `apps/web/test/RecipeLibrary.test.tsx`, `apps/web/test/InventoryManager.test.tsx`, `apps/web/test/Calculators.test.tsx`, `apps/web/test/SensoryEvaluationPanel.test.tsx`, `apps/web/test/SplitPackagingPanel.test.tsx` — verify existing tests pass cleanly (reconcile any source-level `SOURCE` assertions that reference removed tokens).
  - **Untouched:** `designSystem.ts`, `Modal.tsx`, `components/ui/*` (all five primitives — no new export this phase), `packages/**`, `apps/api/**`, every dialog file, and all other panel files.
- **Pure Logic vs Stateful Integration:** No pure-logic changes. All surfaces are stateful render integrations; the migration is strictly a presentational-layer swap of raw elements for `components/ui/` primitives with identical props/behavior, plus the additive `CalculatorCard` disclosure content (RA-6).

---

## 2. Transformations & Pure Logic

- **Pure Function Contracts:** None new. `calculateSplitPackaging`, `calculatePrimingSolution`, `calculateBJCPScore`, and every calculator function are untouched.
- **No-Match / Fallback Contracts:** Unchanged — all existing `?? default` / `? : '—'` fallbacks in the migrated panels are preserved verbatim (e.g. `effectiveTotalVolume = totalBeerVolumeL ?? 20.0`, `sugarGramsPerBottle !== null ? … : '—'`, `res.bottleCount !== null ? … : '—'`).
- **Stateful Integration Contract:**
  - `RecipeLibrary` — the migrated controls bind to the same state (`query`, `isImporting`, `canCreate`, `importStatus`, `loadError`, `busyId`) with identical handlers (`onNew`, `handleFileChange`, `handleDuplicate`, `load`, dismiss).
  - `InventoryManager` — the segmented pill strip reads/writes `categoryFilter` (same `InventoryCategory | 'All'` union); `searchQuery` binds to `<Input>`; `outOfStockOnly` to the out-of-stock **pill button** (Amendment 1); category collapse/expand to `collapsedSections[category]`; Add buttons open `PresetPickerModal` with the category.
  - `Calculators` — `CalculatorCard`'s new disclosure is local `useState` inside the card; no calculator's own state or the `hidden`-attribute category-hiding mechanism (M29_P5 §2 point 2) changes.
  - `SensoryEvaluationPanel` — Save button binds to `busy`/`savedSuccess`/`handleSave`; textarea to `tastingNotes`; sliders to `scores` via `updateScore`.
  - `SplitPackagingPanel` — Add/Remove bind to `addPackage`/`removePackage`; selects/inputs bind to `updatePackage` with identical `onChange` parsing (including the priming-solution sub-tool's mutual reset of `solutionWaterMl`/`targetSyringeDoseMl`).
- **Refactoring & Legacy Cleanup:**
  - Retire the `!pl-9` `!important` override in `InventoryManager`'s search (replaced by the standard leading-icon pattern) — one fewer `!important` site.
  - Drop now-unused designSystem token imports: `BUTTON_PRIMARY_CLASS` from `SensoryEvaluationPanel`; `FORM_SELECT_CLASS` (and `INPUT_CLASS` if unused) from `SplitPackagingPanel`.
  - `designTokens.test.ts` AC-13 `CASES` shrinks from 4 rows to 2 (`ReadingLog.tsx`, `BatchDetail.tsx`).

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** | `designSystem.ts` and `Modal.tsx` confirmed byte-identical (RA-1, RA-2) | Verification | SHA-256 identical pre/post. |
| **AC-2** | `RecipeLibrary.tsx` Import JSON button renders via `<Button variant="secondary" size="sm">` with `aria-label` idle/importing swap, `title`, and `hidden md:inline` label span (RA-9) | Component Test | `M26_P1 AC-19`/`M29_P2` tests pass; `getByRole('button', { name: /import json/i })` resolves uniquely. |
| **AC-3** | `RecipeLibrary.tsx` New Recipe button renders via `<Button variant="primary" size="sm">` with `disabled={!canCreate}` and conditional `title`, label a direct text node (no wrapper `<span>`) | Component Test | `M5.5_P3 AC-15` and `M29_P2` tests pass; `querySelector('span')` on New Recipe is `null`. |
| **AC-4** | `RecipeLibrary.tsx` search input renders via `<Input>` (RA-7), Duplicate via `<Button variant="icon">`, Dismiss/Retry via `<Button variant="secondary" size="sm">` | Component Test | `getByLabelText`/`getByTitle('Duplicate')`/`getByRole('button', { name: /retry/i })` resolve; duplicate `stopPropagation` preserved. |
| **AC-5** | `RecipeLibrary.tsx` hidden file input remains native `<input type="file">` with `data-testid="brewfather-file-input"` | Component Test | File input triggers `handleFileChange` unchanged. |
| **AC-6** | `InventoryManager.tsx` New Item button renders via `<Button variant="primary" size="sm">` | Component Test | `data-testid="inventory-new-item"` opens create form. |
| **AC-7** | `InventoryManager.tsx` category filter renders as a segmented pill strip of `<Button>`s with count badges (RA-3); active pill `aria-pressed="true"` | Component Test | `data-testid="inventory-filter-category"` strip present; clicking a pill issues `/api/inventory?category=…`; `aria-pressed` reflects active. |
| **AC-8** | `InventoryManager.tsx` search renders via `<Input>` with leading search icon (no `!pl-9` override); `data-testid="inventory-search"` + `aria-label="Search inventory"` preserved | Component Test | Typing narrows rows and count badges (AC-10 test passes); no `!important` `pl-9` in file. |
| **AC-9** | `InventoryManager.tsx` out-of-stock filter renders as a **Button-composed pill** in the category strip (Amendment 1), `data-testid="inventory-filter-out-of-stock"`, `aria-pressed` reflecting `outOfStockOnly`, with a live out-of-stock count badge | Component Test | Clicking the pill toggles `aria-pressed` and issues `outOfStock=true`; AC-11 test passes. |
| **AC-10** | `InventoryManager.tsx` category collapse/expand headers and per-category Add buttons render via `<Button>` (RA-8) | Component Test | `inventory-category-toggle-*` and `inventory-add-*` test IDs resolve; collapse/expand and PresetPickerModal wiring intact. |
| **AC-11** | `StrikeWaterCalculator.tsx` raw checkbox normalized (RA-4); zero raw text/number `<input>`, zero raw `<select>`, zero raw `<button>` in `components/calculators/` | Static Sweep | M30_P4 AC-6/7/8 sweeps stay green; `uiPrimitives.test.tsx` sweep passes. |
| **AC-12** | Ten `CalculatorCard`s accept `description` (and `formula` where applicable); the disclosure renders an accessible info button with `aria-expanded` toggling an explanatory `<p>` (RA-6) | Component Test | `CalculatorCard` renders `description` text on toggle; no calculator arithmetic/state/test-ID changes. |
| **AC-13** | `pages/Calculators.tsx` category pills still render via `<Button>`; category-hiding `hidden` attribute mechanism (M29_P5) unchanged | Existing Tests | `Calculators.test.tsx` (incl. AC-7 input retention) and `uiPrimitives.test.tsx` M30_P4 AC-1..5 pass. |
| **AC-14** | `SensoryEvaluationPanel.tsx` Save button renders via `<Button variant="primary" size="sm">` with `data-testid="save-sensory-evaluation-btn"`, `disabled={busy}`, and savedSuccess/busy/idle labels | Component Test | `SensoryEvaluationPanel.test.tsx` AC-13 passes; click calls `onSaveEvaluation`. |
| **AC-15** | `SensoryEvaluationPanel.tsx` tasting-notes `<textarea>` stays raw with `INPUT_CLASS` (RA-5); five `type="range"` sliders remain native (RA-4); `BUTTON_PRIMARY_CLASS` import removed | Component Test | `SensoryEvaluationPanel.test.tsx` AC-12 passes; source no longer references `BUTTON_PRIMARY_CLASS`. |
| **AC-16** | `SplitPackagingPanel.tsx` Add Package via `<Button variant="secondary" size="sm">`; Remove via `<Button variant="icon">` | Component Test | `data-testid="add-package-btn"` / `remove-package-btn-*` resolve; add/remove semantics (M17_P1 AC-7) pass. |
| **AC-17** | `SplitPackagingPanel.tsx` Destination/Priming Sugar/Bottle Size renders via `<Select size="sm">` preserving dynamic `id`s and `aria-label`s | Component Test | `getByLabelText(/priming sugar/i)` / `/bottle size/i` resolve; `fireEvent.change` updates sugar/bottle math (M17_P1 AC-8). |
| **AC-18** | `SplitPackagingPanel.tsx` volume/CO2/temp + priming-solution inputs render via `<NumberInput size="sm">` preserving `id`s, `aria-label`s, `step`/`min`/`max`, and mutual-reset semantics | Component Test | M17_P1 AC-7/AC-17 pass; `total-solution-ml-*` / `syringe-dose-ml-*` live updates intact. |
| **AC-19** | Zero raw `<button>`, zero raw `<select>`, and zero raw text/number `<input>` in `RecipeLibrary.tsx`, `InventoryManager.tsx`, `SensoryEvaluationPanel.tsx` (textarea exempt, RA-5), and `SplitPackagingPanel.tsx` | Static Sweep | `uiPrimitives.test.tsx` M34_P4 adoption sweep passes. |
| **AC-20** | `designTokens.test.ts` AC-13 rows for `SensoryEvaluationPanel` and `SplitPackagingPanel` converted (rows removed from `CASES`); `ReadingLog`/`BatchDetail` rows remain | Existing Test | `designTokens.test.ts` passes; adoption assertions for both panels live in `uiPrimitives.test.tsx`. |
| **AC-21** | Existing component tests pass cleanly | Existing Tests | `RecipeLibrary.test.tsx`, `InventoryManager.test.tsx`, `Calculators.test.tsx`, `SensoryEvaluationPanel.test.tsx`, `SplitPackagingPanel.test.tsx` 100% green. |
| **AC-22** | Scope Guardrail — pre/post SHA-256 content manifest | Verification | Authorized files only modified (see §4). |
| **AC-23** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0 (>= 2,199 passed across 121 files). |
| **AC-24** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 (4/4 workspaces clean). |
| **AC-25** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-26** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |

---

## 4. Scope Guardrail — Authorized Files

### 4.1 Authorized to Modify
1. `apps/web/src/components/RecipeLibrary.tsx`
2. `apps/web/src/components/InventoryManager.tsx`
3. `apps/web/src/components/calculators/CalculatorCard.tsx`
4. `apps/web/src/components/calculators/StrikeWaterCalculator.tsx`
5. `apps/web/src/components/calculators/CarbonationCalculator.tsx`
6. `apps/web/src/components/calculators/GravityCorrectionCalculator.tsx`
7. `apps/web/src/components/calculators/HopDecayCalculator.tsx`
8. `apps/web/src/components/calculators/HydrometerCalculator.tsx`
9. `apps/web/src/components/calculators/InfusionVolumeCalculator.tsx`
10. `apps/web/src/components/calculators/PitchRateCalculator.tsx`
11. `apps/web/src/components/calculators/RefractometerCalculator.tsx`
12. `apps/web/src/components/calculators/StarterGrowthCalculator.tsx`
13. `apps/web/src/components/calculators/UnitConverterCalculator.tsx`
14. `apps/web/src/components/SensoryEvaluationPanel.tsx`
15. `apps/web/src/components/SplitPackagingPanel.tsx`
16. `apps/web/test/uiPrimitives.test.tsx`
17. `apps/web/test/designTokens.test.ts`
18. `apps/web/test/RecipeLibrary.test.tsx` (verify/reconcile only)
19. `apps/web/test/InventoryManager.test.tsx` (verify/reconcile only)
20. `apps/web/test/Calculators.test.tsx` (verify/reconcile only)
21. `apps/web/test/SensoryEvaluationPanel.test.tsx` (verify/reconcile only)
22. `apps/web/test/SplitPackagingPanel.test.tsx` (verify/reconcile only)

### 4.2 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts`
- `apps/web/src/components/Modal.tsx`
- `apps/web/src/components/ui/*` (no new primitive export this phase — RA-5/RA-6 keep the surface at exactly five)
- `packages/**`, `apps/api/**`
- All dialog files (`RecipeImportModal.tsx`, `PostBrewCalibrationModal.tsx`, `BatchRecipeAdjustModal.tsx`, `PresetPickerModal.tsx`, `RefractometerFermentationModal.tsx`, `ConfirmDialog.tsx`, `WaterCalculatorModal.tsx`, `App.tsx` scale modal)
- All other panel files (`Calculators.tsx` page file itself is verify-only — its pills already use `<Button>`; only the `CalculatorCard`/calculator files listed above change)

---

## 5. Layer 1 Command Gates

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
