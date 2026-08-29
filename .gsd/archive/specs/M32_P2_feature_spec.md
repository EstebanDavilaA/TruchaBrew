# FEATURE SPECIFICATION: M32_P2 — The Grain Bill and the Water Agents, Migrated Against a Settled API

**Milestone 32** (*The recipe designer's numbers line up*) — **Phase 2 of 4**
**Planner:** claude-code · **Date:** 2026-08-25 · **State:** 2 (awaiting SPEC_APPROVED)

---

## Phase Summary

M32_P1 settled the `NumberInput` API — it grew the `width` axis over a closed seven-value scale, and proved it on `HopSection.tsx`'s 13 raw numeric inputs. Phase 2 is the **pure migration** the roadmap promised: `FermentableSection.tsx` (2 raw numeric inputs) and `MiscSection.tsx` (3 raw numeric inputs) move onto `<NumberInput>` against an API that is already decided, already exported, and already pinned by tests.

**No `components/ui/` file is modified by this phase.** `NumberInput.tsx` and `ui/index.ts` are on the forbidden-paths list (§4.3). Every prop these five call sites need — `size`, `align`, `width` (including `lg`→`w-20` and `xl`→`w-24`, which had no P1 consumer and become live here), `type`, `inputMode` — already exists and is already asserted by `uiPrimitives.test.tsx` AC-1..AC-7. If this phase turns out to need a primitive change, that is a signal the API is wrong and must be routed through `/diagnose`, not patched inline.

Phase 2 also retires `FermentableSection.tsx`'s single remaining statically-unnamed control and its single remaining `focus:outline-none`, which moves two app-wide pins that other test files own.

### Grounded reconciliation against ROADMAP.md's Milestone 32 P2 bullet (BINDING)

The roadmap's P2 bullet ("`FermentableSection.tsx` and `MiscSection.tsx`. ~4 files. Pure migration against an API that P1 already settled") was written on 2026-08-24, before M30_P3 shipped `NumberInput` and before M31_P4 corrected the app-wide unnamed-control counting methodology. It has been re-verified against actual current source rather than trusted, per the M30/M31/M32_P1 precedent:

| Roadmap claim | Ground truth (verified 2026-08-25 against current source) | Resolution |
|---|---|---|
| "Pure migration against an API that P1 already settled" | **Confirmed.** `NumberInput.tsx` already exports `NumberInputWidth` with all 7 values; `ui/index.ts` already re-exports it; `uiPrimitives.test.tsx:555-556` already pins `lg`→`w-20` and `xl`→`w-24`. Zero primitive changes required. | Confirmed, and hardened into a forbidden-paths entry. |
| "~4 files" | **6 files.** 2 source + 2 own test suites + 2 pre-existing cross-file pins this migration necessarily invalidates (`ScopeGuardrail.test.tsx`, `designTokens.test.ts`). Same +2 pattern P1 hit. | Corrected to 6. |
| (implied) count of raw numeric inputs | `FermentableSection.tsx`: **2** (`grep -c '<input'` = 2, all `type="number"`). `MiscSection.tsx`: **3**. Total **5**. | Pinned as exact counts in AC-6/AC-7. |
| (implied) unnamed controls | `FermentableSection.tsx`: **1** (the add-form amount input, line 134 — the only one; `ScopeGuardrail.test.tsx` AC-15 pins `'components/FermentableSection.tsx': 1`). `MiscSection.tsx`: **0** — all 3 of its numeric inputs already carry `aria-label`, matching M31_P4's corrected breakdown, which lists MiscSection at 0. | Exactly **one** new `aria-label` in this phase, not a sweep. |
| (implied) `focus:outline-none` residue | `FermentableSection.tsx`: **1**, on the row amount input's drifted class string. `MiscSection.tsx`: **0**. App-wide today: **7** (App.tsx 4, FermentableSection 1, HopSection 1, RecipeLibrary 1). | This phase takes app-wide 7 → **6**, and **shrinks `designTokens.test.ts` AC-15(c)'s file array from four entries to three** — the opposite of P1's RA-8, where the array was deliberately left alone. See RA-8. |

**`.gsd/ROADMAP.md`'s "Estimated phases: 4" line for Milestone 32 is correct and is not changed by this phase.** Its stale "not yet started" parenthetical was refreshed at this `/plan` to record that P1 is delivered; no phase was added or removed.

### Key Behaviors

1. All 5 raw `<input type="number">` elements across the two section files render through `<NumberInput>`. Both files contain zero raw `<input>` elements afterward.
2. `FermentableSection.tsx`'s add-form amount input gains the exact accessible name `New fermentable amount (kg)`. `components/FermentableSection.tsx` drops from 1 to 0 in `ScopeGuardrail.test.tsx`'s per-file map; the app-wide total goes 11 → 10.
3. All 5 migrated inputs render `MONO_VALUE_CLASS` in full — `font-mono tabular-nums tracking-tight`. All 5 lack `tracking-tight` today; that is the assertion that fails against pre-phase source.
4. `FermentableSection.tsx`'s drifted local class string (`bg-slate-950 border border-slate-700/80 … focus:ring-1 …`) is deleted, taking the file's last `focus:outline-none` with it.
5. M14's `scope="col"` assertions, M14's AC-7 fermentable accessible-name/`type="number"` assertion, M23's MiscSection accessible-name suite, and `BatchRecipeAdjustModal.test.tsx`'s behavioural assertions (which render `FermentableSection` through the modal) all pass **unmodified**.

### Resolved Ambiguities (Binding)

- **RA-1 — No `components/ui/` file is modified. `designSystem.ts` is not modified either.**
  The `width` scale, the `size`/`align` axes, `MONO_VALUE_CLASS` consumption, and the `type`/`inputMode` defaults are all already correct in `NumberInput.tsx` as M32_P1 left it. `lg` and `xl` were defined in P1 with no consumer precisely so P2 would not have to re-open the primitive; P2 is their first consumer, which is the intended outcome, not a trigger to edit the scale. `designSystem.ts` remains the highest-blast-radius file in this initiative (M30_P1 precedent) and stays byte-identical. Both are in §4.3.

- **RA-2 — Size selection is derived from the call site's *current* base token, not re-litigated.**
  A call site whose current class string contains `INPUT_COMPACT_CLASS` or the hand-written compact shape (`px-2.5 py-1 text-xs`) migrates to `size="sm"`. A call site whose current string contains `INPUT_CLASS` migrates to `size="md"` (the default — which may be written explicitly or omitted; both are acceptable, since `md` is the parameter default). No call site changes size band in this phase.

- **RA-3 — The one control that changes height does so deliberately: F-2 gains `h-10`.**
  `FermentableSection.tsx`'s add-form amount input currently renders `${INPUT_CLASS}` with **no** height class. `NumberInput` at `size="md"` renders `` `${INPUT_CLASS} ${CONTROL_HEIGHT_CLASS}` `` — so this control gains `h-10` (40px). This is **intended**: it is BUG-040 §1's universal 40px control plane arriving on this control, and it aligns the input with the `FORM_SELECT_CLASS` select and the `BUTTON_PRIMARY_CLASS` button sitting beside it in the same flex row. It is recorded here so a reviewer sees a deliberate 40px control rather than an accident. It is the **only** height change in this phase.

- **RA-4 — `className` must be absent entirely on all 5 migrated call sites.**
  `NumberInput` still supports `className` as a last-wins pass-through, but expressing width, alignment, height, font, or numeric typography through it would reintroduce exactly the improvised-suffix pattern this milestone exists to remove. Zero `<NumberInput …>` tags in either file may contain `className`. This is asserted by source sweep (AC-10), not by inspection.

- **RA-5 — `type="number"` is passed explicitly at every one of the 5 call sites; `NumberInput`'s `type="text"` default is overridden.**
  Three existing tests depend on it and are byte-frozen: `accessibilityAndPolish.test.tsx:188-189` asserts the fermentable row input's `getAttribute('type') === 'number'`; `MiscSection.test.tsx:65` resolves controls via `getAllByRole('spinbutton')`, a role only `type="number"` produces; and both files' handlers depend on native numeric semantics (`step="0.05"`, `step="0.1"`, `min="0"`, `min="0.1"`). Every existing `step` and `min` attribute is carried through verbatim per §2.2.

- **RA-6 — The migrated row input in `FermentableSection.tsx` adopts token styling; this is an intended visual change, and the local `focus:ring-1` / `transition-colors` treatment is dropped, not carried over.**
  F-1 currently renders `bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors`. After migration it renders `INPUT_COMPACT_CLASS`: `bg-slate-800`, `border-slate-700`, `rounded` (not `rounded-lg`), `px-2.5 py-1 text-xs text-slate-100`, `focus:border-amber-500`, plus M30_P1's `focus-visible` amber outline trio. The `focus:outline-none` / `focus:ring-1` pair is **deliberately not preserved** — M30_P1 removed exactly that pattern from the tokens because it out-specified the global focus-visible ring. Restoring it in any form is forbidden. `transition-colors` is likewise dropped, matching the P1 precedent for HopSection's seven table inputs.

- **RA-7 — `MiscSection.tsx`'s three inputs change only by gaining `tracking-tight`.**
  All three already use `INPUT_COMPACT_CLASS` + `font-mono tabular-nums` + `text-right` + `w-16`, which maps exactly onto `size="sm" align="right" width="md"`. The rendered class set is otherwise equivalent; the sole delta is `tracking-tight` arriving via `MONO_VALUE_CLASS`. This file is the low-risk half of the phase and its three existing `aria-label`s are preserved **verbatim** — `MiscSection.test.tsx`'s AC-8/AC-9/AC-10/AC-13 suites resolve every one of them by exact string.

- **RA-8 — `focus:outline-none` reconciliation: `designTokens.test.ts` M30_P2 AC-15(b) drops 7 → 6, AND AC-15(c)'s file array drops from four entries to three.**
  This is the **opposite** of M32_P1's RA-8 handling. In P1, `HopSection.tsx` retained one occurrence (on an out-of-scope `<select>`), so AC-15(c)'s array was deliberately left unedited. Here, `FermentableSection.tsx`'s only occurrence is on the migrated input, so the file drops to **zero** and must leave the array or AC-15(c) fails. The post-phase array is exactly, and in this sorted order:
  `['App.tsx', 'components/HopSection.tsx', 'components/RecipeLibrary.tsx']`
  The `it()` title for AC-15(c) currently reads "…the four deferred component files" and must be corrected to say three. AC-15(b)'s integer and its title parenthetical change from 7 to 6. **No other line in `designTokens.test.ts` may change.**

- **RA-9 — `ScopeGuardrail.test.tsx` reconciliation is exactly one deleted key. The AC-14 ceiling is NOT tightened.**
  Remove `'components/FermentableSection.tsx': 1` from AC-15's object literal, leaving 7 entries summing to **10** (App.tsx 1, BrewDayTracker 1, PresetPickerModal 1, ReadingLog 1, RecipeImportModal 3, RecipeLibrary 2, SettingsManager 1). AC-14's `toBeLessThanOrEqual(21)` ceiling and its `MILESTONE_31_FILES` loop are **left exactly as they are** — a ceiling remains satisfied by a lower total, and tightening it would collide with M31_P4's re-SPEC_APPROVED figure and with M32_P1's identical decision. No other line changes.

- **RA-10 — The new `aria-label` is the exact string `New fermentable amount (kg)`, and the theoretical collision is accepted and named.**
  It parallels M32_P1's `New hop amount (g)` and is distinct from the per-row interpolated `` `${item.name} amount (kg)` ``, so `getByLabelText` is unambiguous with fermentables present. The one theoretical collision is a fermentable literally named `New fermentable` — no catalog item is, and no test fixture is (`Maris Otter`, `Pilsner Malt`, `2-Row Pale`, `Pale Malt`). This is the same accepted residual risk M32_P1 carried for HopSection. Test fixtures added by this phase must **not** introduce an item named `New fermentable`.

- **RA-11 — `MiscSection.tsx`'s `<th>` elements lack `scope="col"`, and this phase deliberately does NOT add it.**
  Verified: `MiscSection.tsx:66-72` renders seven `<th className="…">` with no `scope` attribute, and `accessibilityAndPolish.test.tsx`'s AC-6 covers `FermentableSection`, `HopSection` and `YeastSection` only — MiscSection was never in M14's scope. Adding `scope="col"` here would be an unrequested accessibility change to table markup, and Milestone 35 owns tables. The gap is recorded here so it is not lost, and it is out of scope for this phase. The `<table>`/`<thead>`/`<th>`/`<tbody>` structure of **both** files is byte-unchanged.

- **RA-12 — `<select>` elements, `<button>` elements, unit `<span>`s, and their wrapper `<div>`s are out of scope and untouched.**
  `FermentableSection.tsx` keeps its 1 `<select>` and 2 `<button>`s (including the hand-rolled catalog-error span and the `BUTTON_PRIMARY_CLASS` Add Malt button). `MiscSection.tsx` keeps its 3 `<select>`s and 2 `<button>`s (including the hand-rolled `bg-sky-600 …` Add Misc button — Milestone 33 owns that). Selects move in Milestone 34; buttons in Milestone 33.

- **RA-13 — `addonRight` is NOT used in this migration.**
  `FermentableSection.tsx` renders its `kg` unit as an adjacent `<span className="text-xs text-slate-400">kg</span>` sibling inside `<div className="flex items-center gap-1">`, which is layout-load-bearing and not equivalent to `addonRight`'s absolutely-positioned overlay (which would also add `pr-10` and a wrapper `<div className="relative w-full …">`, breaking the flex row's width). That span and both wrapper `<div>`s stay exactly as they are. `MiscSection.tsx`'s add-form wrapper `<div className="flex items-center gap-1">` — which today wraps a single input with no unit span — is likewise left exactly as it is; removing it is a layout change this phase does not make.

- **RA-14 — Degenerate case: both empty-list branches are untouched and must be re-asserted.**
  `fermentables.length === 0` and `miscs.length === 0` each render a single `colSpan={7}` empty-state row and no numeric inputs. Both must continue to render exactly that, and each file's add-form input must still render and still be resolvable by its label when the list is empty.

- **RA-15 — `BatchRecipeAdjustModal.tsx` renders `<FermentableSection>` and is a byte-frozen cross-file consumer.**
  `BatchRecipeAdjustModal.tsx:149` mounts `FermentableSection`, and `BatchRecipeAdjustModal.test.tsx:165-183` drives it by `getByLabelText('Pale Malt amount (kg)')`, calling `fireEvent.change` and asserting `.value` plus a no-mutation invariant on `batch.recipeSnapshot`. Those assertions are behavioural (no class assertions exist in that file), so they must pass with **`BatchRecipeAdjustModal.tsx` and `BatchRecipeAdjustModal.test.tsx` both byte-unchanged**. `NumberInput` spreads `...props` onto the `<input>`, so `value`/`onChange`/`aria-label` pass through intact — but this is the phase's likeliest silent-regression surface and is pinned by AC-25.

- **RA-16 — Existing behaviour of both `onUpdate` paths is preserved exactly, including parser choice.**
  `handleAmountChange` in `FermentableSection` clamps with `Math.max(0, newAmount)` and parses with `parseFloat(e.target.value) || 0`. `MiscSection`'s `handleTimeChange` parses with **`parseInt(e.target.value, 10) || 0`** (not `parseFloat`) and clamps with `Math.max(0, …)`; `handleAmountChange` uses `parseFloat`. These parser choices, the `|| 0` fallbacks, and the clamps are carried through **verbatim** — the migration moves markup, not arithmetic. Likewise `handleAddFromCatalog`'s `parseFloat(amountKgInput) || 1.0` and `parseFloat(amountInput) || 1` fallbacks are unchanged.

---

## 1. Data Schema & Contracts

### 1.1 Exported constants, types and interfaces

**This phase adds, removes and modifies zero exported symbols.**

It **consumes** the following, all of which already exist and must be byte-identical afterward:

```
// apps/web/src/components/ui/NumberInput.tsx  — READ ONLY this phase
export type NumberInputWidth = 'full' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';        // default 'md'
  align?: 'left' | 'right';  // default 'left'
  width?: NumberInputWidth;  // default 'full'
  addonRight?: string;
}
```

Width mapping consumed by this phase (already pinned by `uiPrimitives.test.tsx` AC-4):

| `width` | emitted class | consumed by |
|---|---|---|
| `'md'` | `w-16` | M-1, M-2, M-3 |
| `'lg'` | `w-20` | F-2 — **first consumer in the codebase** |
| `'xl'` | `w-24` | F-1 — **first consumer in the codebase** |
| `'full'`, `'xs'`, `'sm'`, `'2xl'` | — | not consumed by this phase |

### 1.2 Symbol inventory

**Modified:** `FermentableSection` (JSX + import list only), `MiscSection` (JSX + import list only).

**Explicitly untouched:**
- Every export in `designSystem.ts` (28 constants) — RA-1.
- `NumberInput`, `NumberInputProps`, `NumberInputWidth`, `WIDTH_CLASS`, `FormField`, `Input`, `Select`, `Button`, and `ui/index.ts`'s export list — RA-1.
- `FermentableSectionProps` and `MiscSectionProps` — no prop-interface change.
- `handleAddFromCatalog`, `handleAmountChange`, `handleRemove` (FermentableSection); `handleAddFromCatalog`, `handleAmountChange`, `handleTimeChange`, `handleUseChange`, `handleRemove` (MiscSection) — no signature or body change (RA-16).
- Every `useState` hook and its initial value in both files (`selectedCatalogId ''`, `amountKgInput '1.0'`, `amountInput '1'`, `useInput 'Boil'`).
- `useCatalog` / `useConfig` usage, the `catalogError` branch, and `formatMass(totalGrainKg, config.unitSystem)`.

### 1.3 Files

**Authorized to MODIFY (4):**

| Path | Reason |
|---|---|
| `apps/web/src/components/FermentableSection.tsx` | Migrate 2 raw numeric inputs; add 1 `aria-label`; drop `INPUT_CLASS` import. |
| `apps/web/src/components/MiscSection.tsx` | Migrate 3 raw numeric inputs; drop `INPUT_COMPACT_CLASS` import. |
| `apps/web/test/FermentableSection.test.tsx` | Extend with this phase's FermentableSection ACs. |
| `apps/web/test/MiscSection.test.tsx` | Extend with this phase's MiscSection ACs. |

**Authorized to MODIFY — pin reconciliation only, no new assertions (2):**

| Path | Exact permitted edit |
|---|---|
| `apps/web/test/ScopeGuardrail.test.tsx` | AC-15's object literal: **remove the `'components/FermentableSection.tsx': 1` key entirely.** AC-14's `<= 21` ceiling and its `MILESTONE_31_FILES` loop are left as-is (RA-9). No other line changes. |
| `apps/web/test/designTokens.test.ts` | M30_P2 AC-15(b): the literal `7` → `6`, plus its `it()` title parenthetical. AC-15(c): remove `'components/FermentableSection.tsx'` from the expected array (leaving 3 entries) and correct its `it()` title from "four" to "three" (RA-8). No other line changes. |

**Authorized to CREATE: 0 files.** (`.gsd/active/manual_verification/M32_P2_*.png` per §4.4 is bookkeeping, not a source file.)

---

## 2. Transformations & Pure Logic

### 2.1 Pure-logic contract

This phase introduces **no new pure function, no new derived value, and no new state**. `NumberInput`'s class-derivation contract — a deterministic, prop-only, side-effect-free join of `[widthClass, baseClasses, MONO_VALUE_CLASS, alignClass, addonPad, className].filter(Boolean).join(' ')` — is consumed unchanged from M32_P1 and is not re-specified here.

**No-match / fallback contract:** not applicable — there is no lookup, no matching pass, and no zero-match branch anywhere in this phase. `width` is a closed type-level union with a parameter default (`'full'`), not a runtime `??` over a wider type; no runtime fallback branch exists or may be added. The only "empty input" behaviour in scope is the empty-list render branch, specified in RA-14 and asserted by AC-16.

**Stateful integration contract:** the two components remain controlled-input containers. Each migrated `<NumberInput>` keeps its exact `value={…}` binding and its exact `onChange={(e) => handler(…)}` closure, so the render → change → `onUpdate` → re-render cycle is byte-for-byte the behaviour it is today (RA-16). `onUpdate` must fire **exactly once** per `fireEvent.change`, with the same mutated array shape as before — asserted per handler by AC-13/AC-14.

### 2.2 Migration map (binding, 5 rows)

Every row: existing `value`, `onChange`, `step`, `min` and `aria-label` passed through **verbatim** unless the table says otherwise; `className` **absent** (RA-4); `addonRight` **absent** (RA-13); surrounding wrapper `<div>`s, unit `<span>`s, `<td>`s and `<th>`s **unchanged** (RA-12, RA-11).

**`FermentableSection.tsx` (2):**

| # | Current line | Control | Current width class | Current base | `width` | `size` | `align` | `aria-label` | Preserved attrs |
|---|---|---|---|---|---|---|---|---|---|
| F-1 | 78–86 | Per-row amount (kg) | `w-24` | hand-written drifted string (RA-6) | `xl` | `sm` | `right` | `` `${item.name} amount (kg)` `` — **unchanged** | `type="number"`, `step="0.05"`, `min="0"` |
| F-2 | 134–141 | Add-form amount (kg) | `w-20` | `${INPUT_CLASS}` | `lg` | `md` | `right` | **NEW, exact:** `New fermentable amount (kg)` | `type="number"`, `step="0.1"`, `min="0.1"` |

F-1's entire hand-written `className` string is deleted (RA-6). F-2's `` className={`w-20 ${INPUT_CLASS} font-mono tabular-nums text-right`} `` is deleted; `size="md"` supplies `INPUT_CLASS` + `CONTROL_HEIGHT_CLASS` (RA-3), `MONO_VALUE_CLASS` supplies `font-mono tabular-nums tracking-tight`, `align="right"` supplies `text-right`, `width="lg"` supplies `w-20`. Neither input has a `placeholder` today and neither gains one.

**`MiscSection.tsx` (3):**

| # | Current line | Control | Current width class | Current base | `width` | `size` | `align` | `aria-label` | Preserved attrs |
|---|---|---|---|---|---|---|---|---|---|
| M-1 | 95–102 | Per-row time (min) | `w-16` | `${INPUT_COMPACT_CLASS}` | `md` | `sm` | `right` | `` `Time in minutes for ${item.name}` `` — **unchanged** | `type="number"`, `min="0"` (no `step`) |
| M-2 | 105–113 | Per-row amount | `w-16` | `${INPUT_COMPACT_CLASS}` | `md` | `sm` | `right` | `` `Amount of ${item.name}` `` — **unchanged** | `type="number"`, `step="0.1"`, `min="0"` |
| M-3 | 171–179 | Add-form amount | `w-16` | `${INPUT_COMPACT_CLASS}` | `md` | `sm` | `right` | `Amount for new misc` — **unchanged** | `type="number"`, `step="0.1"`, `min="0.1"` |

M-1 and M-2 currently write `` className={`w-16 text-right ${INPUT_COMPACT_CLASS} font-mono tabular-nums`} `` (alignment *before* the base token); M-3 writes `` className={`w-16 ${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right`} `` (alignment *after*). Both orderings collapse to the same three props — the inconsistency in source order is itself an instance of the improvised-suffix drift this milestone removes. M-1 has **no** `step` attribute today and must not gain one (its handler uses `parseInt`, RA-16).

### 2.3 Refactoring & legacy cleanup (explicit purge list)

- F-1's drifted class string is **deleted, not adapted**. After this phase `FermentableSection.tsx` contains **0** occurrences of `bg-slate-950`, **0** of `border-slate-700/80`, **0** of `focus:ring-1`, and **0** of `focus:outline-none`.
- **`INPUT_CLASS` must no longer be imported by `FermentableSection.tsx`** — F-2 is its only consumer in that file. Its post-phase `designSystem` import list is exactly `CARD_CLASS`, `SECTION_HEADING_CLASS`, `SUBPANEL_CLASS`, `FORM_SELECT_CLASS`, `BUTTON_PRIMARY_CLASS`, plus `NumberInput` from `./ui`.
- **`INPUT_COMPACT_CLASS` must no longer be imported by `MiscSection.tsx`** — M-1/M-2/M-3 are its only consumers in that file. Its post-phase `designSystem` import list is exactly `CARD_CLASS`, `SECTION_HEADING_CLASS`, `SUBPANEL_CLASS`, `FORM_SELECT_CLASS`, `FORM_SELECT_COMPACT_CLASS`, plus `NumberInput` from `./ui`.
  A lingering unused import is a lint failure under Layer 1 gate 4 and is pinned by AC-11.
- App-wide template-literal residue after this phase (verified pre-phase counts in parentheses): `${INPUT_CLASS} font-mono tabular-nums` **16** (17); `${INPUT_COMPACT_CLASS} font-mono tabular-nums` **2** (5), surviving only in `BrewDayTracker.tsx` (Milestone 33) and `YeastSection.tsx` (M32_P3); `${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right` **0** (1).
- No obsolete registration loop, legacy alias map, module-level side effect, or dead export exists on this surface. Nothing else is purged — in particular, no `designSystem.ts` token becomes consumer-less as a result of this phase (`INPUT_CLASS` and `INPUT_COMPACT_CLASS` both retain many other consumers).

---

## 3. Acceptance Criteria & Test Matrix

30 criteria. Every one is answerable as a yes/no against the built code.

| ID | Requirement | Test Type | Expected Outcome |
|----|---|---|---|
| AC-1 | `components/ui/` untouched (RA-1) | Verification | SHA-256 of `apps/web/src/components/ui/NumberInput.tsx` and `apps/web/src/components/ui/index.ts` are identical pre- and post-phase. `uiPrimitives.test.tsx` is byte-unchanged and passes, including its M32_P1 AC-1..AC-7 width block. |
| AC-2 | `designSystem.ts` byte-unchanged (RA-1) | Verification | SHA-256 of `apps/web/src/components/designSystem.ts` identical pre/post. `designSystem.test.ts` byte-unchanged and passing, including its `MONO_VALUE_CLASS === 'font-mono tabular-nums tracking-tight'` pin. `designSystem.ts` still exports exactly 28 constants. |
| AC-3 | `lg` and `xl` now have real consumers | Source sweep | `width="lg"` appears exactly **1×** across `apps/web/src` (F-2) and `width="xl"` exactly **1×** (F-1). Neither appeared anywhere before this phase. |
| AC-4 | Zero raw `<input>` in `FermentableSection.tsx` | Source sweep (`FermentableSection.test.tsx`) | Reading `src/components/FermentableSection.tsx`, `/<input[\s>]/g` matches **0** (down from 2). |
| AC-5 | Zero raw `<input>` in `MiscSection.tsx` | Source sweep (`MiscSection.test.tsx`) | Reading `src/components/MiscSection.tsx`, `/<input[\s>]/g` matches **0** (down from 3). |
| AC-6 | Exactly 2 `<NumberInput>` in `FermentableSection.tsx` | Source sweep | `/<NumberInput[\s>]/g` matches exactly **2**. |
| AC-7 | Exactly 3 `<NumberInput>` in `MiscSection.tsx` | Source sweep | `/<NumberInput[\s>]/g` matches exactly **3**. |
| AC-8 | Every call site passes `type="number"` (RA-5) | Source sweep + rendered | Every `<NumberInput` occurrence in both files is followed, before its tag close, by `type="number"`. In a rendered `FermentableSection` with one fermentable, `getByLabelText('<name> amount (kg)').getAttribute('type') === 'number'`; in a rendered `MiscSection` with two miscs, `getAllByRole('spinbutton')` has length **5** (2 per-row inputs × 2 miscs + 1 add-form input; corrected 2026-08-25 — the original **3** was an arithmetic slip against this document's own §2.2 migration map, caught by the executor and confirmed by direct render). |
| AC-9 | `step`/`min` preserved exactly (RA-5, §2.2) | Rendered | F-1 `step="0.05" min="0"`; F-2 `step="0.1" min="0.1"`; M-1 has `min="0"` and **no `step` attribute at all** (`hasAttribute('step') === false`); M-2 `step="0.1" min="0"`; M-3 `step="0.1" min="0.1"`. |
| AC-10 | No `className` on migrated call sites (RA-4) | Source sweep | Zero `<NumberInput …>` tags in either file contain `className`. |
| AC-11 | Unused base-token imports removed (§2.3) | Source sweep + lint | `FermentableSection.tsx` does not import `INPUT_CLASS`; `MiscSection.tsx` does not import `INPUT_COMPACT_CLASS`; both still import `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem` (required by `accessibilityAndPolish.test.tsx` AC-1..AC-5); `npm run lint` reports no new unused-import warning. |
| AC-12 | Exact rendered widths (§2.2) | Rendered | FermentableSection with one fermentable: `<name> amount (kg)` → has `w-24`, not `w-full`; `New fermentable amount (kg)` → has `w-20`, not `w-full`. MiscSection with two miscs: all of `Time in minutes for <name>`, `Amount of <name>`, `Amount for new misc` → have `w-16`, not `w-full`. |
| AC-13 | FermentableSection editing behaviour — lockstep with `onUpdate` (RA-16) | Rendered | `fireEvent.change` on `<name> amount (kg)` with `'3.75'` fires `onUpdate` **exactly once** with an array where that item's `amountKg === 3.75` and every other field is identical; a negative input (`'-2'`) yields `amountKg === 0` (the `Math.max(0, …)` clamp); a non-numeric input (`'abc'`) yields `amountKg === 0` (the `parseFloat(…) \|\| 0` fallback). No other item in the array is mutated. |
| AC-14 | MiscSection editing behaviour — lockstep, including the `parseInt` path (RA-16) | Rendered | `fireEvent.change` on `Time in minutes for <name>` with `'45'` → `onUpdate` once, `timeMinutes === 45`; with `'12.7'` → `timeMinutes === 12` (`parseInt`, **not** `parseFloat` — this is the assertion that would catch a parser swap); with `'-5'` → `0`. `fireEvent.change` on `Amount of <name>` with `'2.5'` → `amount === 2.5`; with `'-1'` → `0`. Sibling rows unmutated in every case. |
| AC-15 | Add-flows preserved | Rendered | FermentableSection: selecting a catalog malt, typing `'2.25'` into `New fermentable amount (kg)`, and clicking `Add Malt` calls `onUpdate` with an array of length `fermentables.length + 1` whose new item has `amountKg === 2.25` and carries `name`/`type`/`colorSrm`/`potentialSg` from the catalog item. MiscSection: selecting a catalog misc, typing `'3'` into `Amount for new misc`, and clicking `Add Misc` calls `onUpdate` with length + 1 and `amount === 3`, `use` from the use-select, `timeMinutes === 0`, `unit` from the catalog item's `defaultUnit`. |
| AC-16 | Degenerate: empty lists (RA-14) | Rendered | With `fermentables={[]}`: exactly one `colSpan={7}` empty-state row containing the text `No fermentables added yet.`, zero `<NumberInput>`-rendered inputs inside `<tbody>`, and `New fermentable amount (kg)` still resolves to exactly one element. With `miscs={[]}`: exactly one `colSpan={7}` row containing `No misc additions yet.`, zero inputs in `<tbody>`, and `Amount for new misc` still resolves. |
| AC-17 | The new accessible name is exact and unique (RA-10) | Rendered | With two fermentables present, `getByLabelText('New fermentable amount (kg)')` resolves to exactly one element (does not throw), and `getAllByLabelText(/amount \(kg\)$/)` has length **3** (two rows + the add form), all distinct elements. |
| AC-18 | MiscSection's three existing names preserved verbatim (RA-7) | Existing test | `MiscSection.test.tsx`'s AC-8 block resolves all seven of its named controls with **its assertions unmodified**, including `Amount of Irish Moss`, `Time in minutes for Gypsum`, `Amount for new misc`. |
| AC-19 | All 5 migrated inputs carry `MONO_VALUE_CLASS` in full | Rendered | Every element resolved in AC-12 has all three of `font-mono`, `tabular-nums`, **`tracking-tight`**. This is the assertion that fails against pre-phase source, where `tracking-tight` is absent from all 5. |
| AC-20 | F-1 adopts token styling and sheds the drift (RA-6) | Rendered | `<name> amount (kg)` has `bg-slate-800`, `border-slate-700`, `rounded`, `px-2.5`, `py-1`, `text-xs`, `focus:border-amber-500`, `text-right`; and does **not** have `bg-slate-950`, `rounded-lg`, `focus:ring-1`, `focus:outline-none`, `transition-colors`, or `h-10`. |
| AC-21 | F-2 gains the 40px control plane, deliberately (RA-3) | Rendered | `New fermentable amount (kg)` has `h-10`, `px-3`, `py-2`, `text-sm`, `rounded-lg`, `text-right`, `w-20`; and does **not** have `text-xs` or `w-full`. It is the only control in either file that gains `h-10`. |
| AC-22 | Drifted strings purged from source (§2.3) | Source sweep | `FermentableSection.tsx` contains **0** occurrences each of `bg-slate-950`, `border-slate-700/80`, `focus:ring-1`, `focus:outline-none`, and `transition-colors` **on an input** (the `<tr>` and `<button>` `transition-colors` occurrences are out of scope and remain). App-wide: `${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right` is **0**; `${INPUT_COMPACT_CLASS} font-mono tabular-nums` is **2**; `${INPUT_CLASS} font-mono tabular-nums` is **16**. |
| AC-23 | Out-of-scope elements untouched (RA-11, RA-12, RA-13) | Source sweep | `FermentableSection.tsx` still contains exactly 1 `<select` and 2 `<button`; `MiscSection.tsx` exactly 3 `<select` and 2 `<button`. Both files contain **0** `addonRight` occurrences. Both files' `<thead>`/`<tr>`/`<th>` blocks are byte-unchanged, and `MiscSection.tsx` still has **0** `scope="col"` occurrences (RA-11 — not added by this phase). |
| AC-24 | M14 guarantees pass unmodified | Existing test | `accessibilityAndPolish.test.tsx` is **byte-unchanged** and passes in full: AC-1..AC-5's `CARD_CLASS`/`SECTION_HEADING_CLASS` import assertions for both files; AC-6's `FermentableSection sets scope="col" on all <th> elements` (7 columnheaders); AC-7's `Pilsner Malt amount (kg)` accessible name, `type === 'number'`, and the remove button's `p-2`. |
| AC-25 | `BatchRecipeAdjustModal` cross-file consumer unaffected (RA-15) | Existing test | `BatchRecipeAdjustModal.tsx` and `BatchRecipeAdjustModal.test.tsx` are **byte-unchanged**, and the suite passes — specifically `getByLabelText('Pale Malt amount (kg)')`, `fireEvent.change` to `'7'` yielding `.value === '7'`, the `batch.recipeSnapshot` no-mutation invariant, and the AC-5 live-vitals OG recalculation on change to `'9'`. |
| AC-26 | Other cross-file consumers unaffected | Existing tests | `App.test.tsx`, `BatchDetail.test.tsx`, `StatsHeader.test.tsx`, `HopSection.test.tsx`, `YeastSection.test.tsx` (if present), `calculatorImportGraph.test.ts` pass **byte-unchanged**. |
| AC-27 | `ScopeGuardrail` unnamed-control reconciliation (RA-9) | Existing test, reconciled | `ScopeGuardrail.test.tsx` AC-15's map no longer contains a `components/FermentableSection.tsx` key and equals exactly `{ 'App.tsx': 1, 'components/BrewDayTracker.tsx': 1, 'components/PresetPickerModal.tsx': 1, 'components/ReadingLog.tsx': 1, 'components/RecipeImportModal.tsx': 3, 'components/RecipeLibrary.tsx': 2, 'components/SettingsManager.tsx': 1 }` — 7 entries, total **10** (was 11). AC-14's `<= 21` ceiling and `MILESTONE_31_FILES` loop are unedited and still pass. |
| AC-28 | `focus:outline-none` reconciliation (RA-8) | Existing test, reconciled | `designTokens.test.ts` M30_P2 AC-15(b) asserts **6** (was 7) and passes; AC-15(c)'s expected array is exactly `['App.tsx', 'components/HopSection.tsx', 'components/RecipeLibrary.tsx']` (three entries, was four) with its `it()` title corrected to say three; AC-15(a)'s `designSystem.ts`-is-zero assertion is unedited. No other line in the file changed. |
| AC-29 | Test-count monotonicity and four Layer 1 gates | Layer 1 | All four commands in §4.1 exit 0. Total passing ≥ the M32_P1 closing baseline of **2126 passed / 2 skipped across 120 files**, with **no previously-passing test removed, renamed away, or `.skip`ped**. Lint shows exactly the 4 pre-existing `only-export-components` warnings and 0 new. Where a test selector must change from a removed class string to a label/testid, the assertion's *meaning* must be unchanged and the executor must enumerate each such edit in its report. |
| AC-30 | **Scope guardrail — SHA-256 content manifest** | Verification | See §4.2. Exactly the 6 authorized paths show changed hashes; zero files created, zero deleted. **The pre-edit manifest must have been captured before the first source edit** — see §4.2's binding process note. |

---

## 4. Verification

### 4.1 Layer 1 command block

Run from the repo root, `C:\Dev\Workspaces\TruchaBrew`. All four gates required (HARD_RULES rule 13); each is judged by exit code.

```bash
npm test
npm run typecheck
npm run build
npm run lint
```

Expected: `npm test` exit 0 with ≥ 2126 passed / 2 skipped; `npm run typecheck` exit 0 across 4/4 workspaces; `npm run build` exit 0; `npm run lint` exit 0 with exactly the 4 known pre-existing `only-export-components` warnings.

### 4.2 AC-30 — Scope guardrail (SHA-256 content manifest)

**BINDING PROCESS NOTE — carried forward from M32_P1's Layer 2 critic finding.** In M32_P1 the executor began editing before scripting the pre-snapshot, leaving AC-35 PARTIAL on method (the critic reconstructed the same conclusion via an mtime sweep and passed it, while logging the gap as binding on M32_P2–P4). **Capturing the pre-edit manifest is therefore the literal first action of `/execute` for this phase** — before reading a source file for edit, before the first `Edit`/`Write`, before anything else. An executor that reports a post-hoc reconstruction instead of a genuine pre-snapshot has failed AC-30 on method regardless of the outcome.

**`git diff --name-only` is NOT used and must not be substituted.** This repo has 2 commits against a large pre-existing uncommitted tree — `apps/web` is almost entirely untracked or staged-new against them — so a diff-based criterion cannot distinguish this phase's changes from the pre-existing dirty tree and is unfalsifiable here. Same reasoning M30_P1 established and M31_P4 / M32_P1 recorded.

**Step 1 — before the first edit**, from the repo root:

```bash
git ls-files -co --exclude-standard -z | xargs -0 sha256sum > "$TMPDIR/M32_P2_manifest_pre.txt"
```

**Step 2 — after the last edit**, the same command to `M32_P2_manifest_post.txt`, then diff the two manifests.

The manifest diff must show changed hashes for **exactly these 6 paths and no others**:

1. `apps/web/src/components/FermentableSection.tsx`
2. `apps/web/src/components/MiscSection.tsx`
3. `apps/web/test/FermentableSection.test.tsx`
4. `apps/web/test/MiscSection.test.tsx`
5. `apps/web/test/ScopeGuardrail.test.tsx`
6. `apps/web/test/designTokens.test.ts`

Plus, as the only permitted **additions** to the manifest: `.gsd/` bookkeeping (`STATE.json`, `FEATURES.md`, `ROADMAP.md`, archive logs, this spec) and, if captured, `.gsd/active/manual_verification/M32_P2_*.png`. **Zero files deleted. Zero source files created.**

### 4.3 Forbidden paths (explicitly OUT of scope — must be byte-identical)

- `apps/web/src/components/ui/NumberInput.tsx` — **RA-1. The API is settled; needing to change it is a `/diagnose` signal, not an edit.**
- `apps/web/src/components/ui/index.ts` — RA-1
- `apps/web/src/components/ui/FormField.tsx`, `Input.tsx`, `Select.tsx`, `Button.tsx`
- `apps/web/test/uiPrimitives.test.tsx` — AC-1 is only meaningful if this file is unmodified
- `apps/web/src/components/designSystem.ts` — **RA-1. The single highest-blast-radius file in this initiative.**
- `apps/web/test/designSystem.test.ts`
- `apps/web/test/accessibilityAndPolish.test.tsx` — AC-24 is only meaningful if this file is unmodified
- `apps/web/src/components/BatchRecipeAdjustModal.tsx` and `apps/web/test/BatchRecipeAdjustModal.test.tsx` — **RA-15**
- `apps/web/src/components/HopSection.tsx` — Milestone 32 **P1**, already delivered
- `apps/web/src/components/YeastSection.tsx` — Milestone 32 **P3**
- `apps/web/src/components/MashSection.tsx` — Milestone 32 **P3**
- `apps/web/src/App.tsx` — Milestone 32 **P4**
- `apps/web/src/components/StatsHeader.tsx` — Milestone 32 **P4**
- `apps/web/src/components/BrewDayTracker.tsx` — Milestone 33
- `apps/web/test/HopSection.test.tsx`, `YeastSection.test.tsx`, `MashSection.test.tsx`, `StatsHeader.test.tsx`, `App.test.tsx`, `BatchDetail.test.tsx`
- `packages/**`, `apps/api/**`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `apps/web/src/index.css`
- `.gsd/ROADMAP.md` — already refreshed at this `/plan`; the executor changes no phase count

### 4.4 Manual verification (best-effort)

If browser automation is available, capture `.gsd/active/manual_verification/M32_P2_fermentable_misc_numbers.png` — the recipe designer showing the Fermentables & Malts card (at least one fermentable row, plus the Add Fermentable form) and the Misc & Water Agents card (at least one misc row, plus the Add Misc form), so the 40px add-form input from RA-3 and the retokenized row inputs from RA-6 are both visible. If unavailable, report it as outstanding evidence for `/steer`'s critic (the M30_P1 / M31_P4 precedent), rather than silently omitting it.

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
