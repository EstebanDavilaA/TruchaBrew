# FEATURE SPECIFICATION: M32_P1 — The Width Axis, Proven on the Hardest Section

**Milestone 32** (*The recipe designer's numbers line up*) — **Phase 1 of 4**
**Planner:** claude-code · **Date:** 2026-08-25 · **State:** 2 (awaiting SPEC_APPROVED)

---

## Phase Summary

Milestone 32's user-visible claim is that every numeric field in the recipe designer is the same height, the same width for the same kind of quantity, aligned the same way, and typeset identically to the number the stats header reads back. Phase 1 settles the API that claim depends on and proves it on `HopSection.tsx` — the app's hardest numeric surface: 13 raw `<input type="number">` elements, 6 of the app's 17 remaining statically-unnamed controls, M14's `scope="col"` table accessibility, and M29_P3's tabular-numeral guarantee, all in one file.

`NumberInput` grows **one new axis — `width`** — and `HopSection.tsx`'s 13 raw numeric inputs migrate onto it.

### Grounded reconciliation against ROADMAP.md's Milestone 32 P1 bullet (BINDING)

The roadmap's P1 bullet was written during the 2026-08-24 Option-C phase split, **before M30_P3 shipped `NumberInput`**. Three of its four claims are stale against the source as it exists today. Per the M31_P4 amendment precedent, the discrepancies are stated plainly rather than silently reconciled:

| Roadmap claim | Ground truth (verified 2026-08-25) | Resolution |
|---|---|---|
| "Grow `NumberInput` its `size`/`align`/`width` props" | `NumberInput.tsx` **already has** `size?: 'sm' \| 'md'` (line 5) and `align?: 'left' \| 'right'` (line 6), shipped by M30_P3 and pinned by `uiPrimitives.test.tsx` AC-9/AC-10. Only `width` is missing. | **Only `width` is added.** `size` and `align` are untouched. |
| "make `MONO_VALUE_CLASS` the thing it actually renders (closing the `tracking-tight` mismatch)" | `NumberInput.tsx` line 24 **already renders `MONO_VALUE_CLASS`**, and `uiPrimitives.test.tsx` AC-8 already asserts `tracking-tight` on the rendered input. | **Already done. No change.** See RA-1 for the real defect and why `designSystem.ts` is NOT edited. |
| "`${INPUT_CLASS} font-mono tabular-nums` ×26 … `${INPUT_COMPACT_CLASS} font-mono tabular-nums` ×13" | Actual counts across `apps/web/src`: **17**, not 26; **11**, not 13. The other two figures are correct: `${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right` = **7**; `${INPUT_CLASS} flex-1 font-mono tabular-nums` = **5**. | Corrected here. These are milestone-wide figures; P1 retires only HopSection's share. |
| "6 of the app's unnamed controls" | **Confirmed exactly.** `ScopeGuardrail.test.tsx` AC-15 pins `components/HopSection.tsx: 6`. | Unchanged. |
| "~3 files" | Confirmed as a floor, but **5 files** are actually required — the two extra are pre-existing cross-file pin reconciliations (`ScopeGuardrail.test.tsx`, `designTokens.test.ts`) that this migration necessarily invalidates. See §1.3. | Corrected to 5. |

**`.gsd/ROADMAP.md` is not edited by this phase.** Milestone 32's "Estimated phases: 4" line remains correct — this scoping neither adds nor removes a phase. Only the prose of the P1 bullet is stale, and it is superseded by this document, which is what the executor and critic read.

### Key Behaviors

1. `NumberInput` gains a `width` prop over a fixed, named scale. `width` defaults to `'full'`, which renders exactly the `w-full` that is hardcoded today — so all 6 existing `NumberInput` consumers are byte-identical in rendered output after the change.
2. All 13 raw `<input type="number">` elements in `HopSection.tsx` render through `<NumberInput>`. `HopSection.tsx` contains zero raw `<input>` elements afterward.
3. The 6 statically-unnamed controls in `HopSection.tsx`'s "Add Hop" form gain `aria-label`s. `components/HopSection.tsx` drops from 6 to 0 in `ScopeGuardrail.test.tsx`'s per-file map.
4. Entered numbers in `HopSection.tsx` and read-back numbers in the stats surfaces become the same typography (`font-mono tabular-nums tracking-tight`) because both now resolve through `MONO_VALUE_CLASS` — the migration closes the mismatch, not a token edit.
5. M14's `scope="col"` assertions, M14's AC-8 accessible-name assertions, and M29_P3's tabular-numeral guarantee pass **unmodified**.

### Resolved Ambiguities (Binding)

- **RA-1 — `designSystem.ts` is NOT modified by this phase. `MONO_VALUE_CLASS` keeps `tracking-tight` verbatim.**
  The roadmap frames the defect as "the inputs hand-type `font-mono tabular-nums` while `MONO_VALUE_CLASS` also carries `tracking-tight`." Verified: `MONO_VALUE_CLASS === 'font-mono tabular-nums tracking-tight'` (`designSystem.ts:36`) and `NumberInput` already applies it. The mismatch therefore exists **only at call sites that hand-write `font-mono tabular-nums` instead of using `NumberInput`** — such as HopSection's 13 raw inputs. The correct fix is migration, not a token edit.
  Editing `MONO_VALUE_CLASS` is **forbidden** in this phase. It would (a) change the rendered typography of 22 existing read-back sites in `StatsHeader.tsx`, `BatchRecipeAdjustModal.tsx`, `RefractometerFermentationModal.tsx` and `CalculatorCard.tsx` that are correct today, and (b) break `designSystem.test.ts:20`'s exact-string pin — the large-blast-radius failure mode M30_P1's history documents. `designSystem.ts` appears in §4.2's forbidden-paths list.
  **Wiring direction is settled: `NumberInput` consumes `MONO_VALUE_CLASS`; `MONO_VALUE_CLASS` is not reshaped to suit `NumberInput`.**

- **RA-2 — The `width` scale is a closed union of exactly seven values, and P1 exercises four of them.**
  `'full' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'` → `'w-full' | 'w-12' | 'w-14' | 'w-16' | 'w-20' | 'w-24' | 'w-40'`.
  Every value is grounded in a width already hand-set somewhere in `apps/web/src/components`: `w-16` ×15, `w-14` ×9, `w-24` ×5, `w-20` ×4, `w-12` ×2, `w-40` ×1. P1's HopSection migration consumes `full` (unchanged default, 6 existing consumers), `xs`, `sm`, and `md`. `lg`/`xl`/`2xl` have no P1 consumer and are deliberately defined now so the scale is decided **once** rather than re-litigated in P2/P3/P4 — this is a prop-value union on one existing export, not a new dead export, and so is not the "defined, pinned, unused token" failure M35 targets. This is recorded as an accepted, deliberate deviation from consumers-first discipline, with the rationale above as its justification.
  **No arbitrary/escape-hatch width value is permitted.** A width not on this scale is a spec violation, not a `className` override.

- **RA-3 — `className` remains a supported pass-through and is appended last, but must not be used to set width, alignment, height, font, or numeric typography in `HopSection.tsx`.**
  The existing `className` merge order (`w-full`, base, `MONO_VALUE_CLASS`, align, `pr-10`, `className`) is preserved so `className` still wins on conflict. In migrated HopSection call sites, `className` must be **absent entirely** — any width/align/size expressed through it would reintroduce the improvised-suffix pattern this milestone exists to remove.

- **RA-4 — Width and `w-full` are mutually exclusive, resolved inside the component, not by class-order luck.**
  When `width !== 'full'`, the component emits the mapped fixed-width class and **must not** also emit `w-full`. Tailwind resolves `w-full w-16` by source order in the generated stylesheet, not by class-attribute order, so emitting both is non-deterministic. The component selects exactly one width class.

- **RA-5 — The migrated table inputs adopt token styling; this is an intended visual change, and the local `focus:ring-1`/`transition-colors` treatment is dropped.**
  HopSection's 7 table inputs currently carry a drifted local string: `bg-slate-950 border border-slate-700/80 rounded-lg px-2.5|px-2|px-1.5 py-1 ... focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs transition-colors`. After migration they render `INPUT_COMPACT_CLASS` (`bg-slate-800`, `border-slate-700`, `rounded`, `px-2.5 py-1 text-xs`, `focus:border-amber-500`, the M30_P1 `focus-visible` amber ring). The `focus:outline-none` / `focus:ring-1` pair is **deliberately not carried over** — M30_P1 removed exactly that pattern from the tokens because it out-specified the global focus-visible ring. Restoring it on these inputs is forbidden.

- **RA-6 — `type="number"` is preserved on every migrated HopSection input; `NumberInput`'s `type="text"` default is explicitly overridden.**
  `accessibilityAndPolish.test.tsx` asserts `amountInput.getAttribute('type')` is `'number'` on the sibling FermentableSection case, and HopSection's handlers depend on native numeric semantics (`step="5"`, `step="0.5"`, `step="0.1"`, `min="0"`, `min="1"`). Every migrated call site passes `type="number"` explicitly, along with its existing `step`/`min` attributes verbatim. `NumberInput` already supports this (`uiPrimitives.test.tsx` AC-11).

- **RA-7 — The `<select>` elements, the "Add Hop" `<button>`, the remove `<button>`, the `—` placeholder `<div>`, and the table markup are OUT of scope.**
  `HopSection.tsx` has 3 `<select>` elements (the per-row hop-use select, and the two add-form selects), 2 `<button>` elements, and a `hopUseClass === 'none'` placeholder `<div className="text-right text-xs text-slate-400 font-mono">—</div>`. None is a numeric input. **None is touched.** Migrating selects onto `<Select>` is Milestone 34's work; migrating buttons onto `<Button>` is Milestone 33's. The `<table>`/`<thead>`/`<th scope="col">`/`<tbody>` structure is byte-unchanged (Milestone 35 owns tables).

- **RA-8 — `focus:outline-none` count reconciliation: `designTokens.test.ts` M30_P2 AC-15(b) drops from 14 to 7; AC-15(c)'s four-file list is UNCHANGED.**
  Current per-file counts: `App.tsx` 4, `FermentableSection.tsx` 1, `HopSection.tsx` 8, `RecipeLibrary.tsx` 1 = 14. The 7 migrated table inputs each carry one occurrence; the 8th is on the per-row hop-use `<select>` (line 200), which RA-7 puts out of scope. HopSection therefore goes 8 → 1, and the app-wide total goes **14 → 7**. Because HopSection retains exactly one occurrence, **AC-15(c)'s exact four-file array must not be edited** — editing it would be a regression, not a reconciliation. Only the integer in AC-15(b) changes.

- **RA-9 — Two add-form branches share one `aria-label` by design.**
  `timeInput` is rendered by two mutually-exclusive JSX branches (the Whirlpool/Aroma branch and the fallback branch). Both receive `aria-label="Hop addition time (minutes)"`. Because the branches are exclusive, `getByLabelText` never sees two matches, and a duplicate-label test failure would indicate a real regression in the branch logic.

- **RA-10 — Accessible names for the 6 add-form controls are fixed strings, specified exactly in §2.2, and must not be improvised.**
  They are distinct from the per-row labels (which are name-interpolated, e.g. `` `${hop.name} amount (g)` ``) so `getByLabelText` in a rendered test with hops present is unambiguous between the table row and the add form.

- **RA-11 — Existing `data-testid` attributes are preserved verbatim on the migrated elements.**
  All 5 per-row testids (`hop-boil-mins-${id}`, `hop-whirlpool-mins-${id}`, `hop-whirlpool-temp-${id}`, `hop-dry-offset-${id}`, `hop-dry-duration-${id}`) pass through `NumberInput`'s `...props` spread onto the `<input>`. `HopSection.test.tsx`, `useRecipeEditor.test.tsx`, `BatchDetail.test.tsx` and `InventoryManager.test.tsx` reference HopSection behaviour; none may be broken.

- **RA-12 — `addonRight` is NOT used in this migration.**
  HopSection renders its units as adjacent `<span>` siblings inside `flex` rows (`min`, `min @`, `°C`, `Day`, `+`, `d`, `g`, `days`), which is layout-load-bearing and not equivalent to `addonRight`'s absolutely-positioned overlay. Those `<span>`s and their wrapper `<div className="flex …">` elements stay exactly as they are. Converting them to `addonRight` is forbidden in this phase.

- **RA-13 — Degenerate case: the empty-hops branch is untouched.**
  `hops.length === 0` renders a single `colSpan={7}` empty-state row and no numeric inputs. It must continue to render exactly that, and the add-form's 6 inputs must still render (and still be labelled) when the hop list is empty.

---

## 1. Data Schema & Contracts

### 1.1 Modified export: `NumberInputProps` (`apps/web/src/components/ui/NumberInput.tsx`)

```
export type NumberInputWidth = 'full' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';                 // UNCHANGED (M30_P3)
  align?: 'left' | 'right';           // UNCHANGED (M30_P3)
  width?: NumberInputWidth;           // NEW — default 'full'
  addonRight?: string;                // UNCHANGED (M30_P3)
}
```

Width mapping (exact, binding):

| `width` | emitted class |
|---|---|
| `'full'` (default) | `w-full` |
| `'xs'` | `w-12` |
| `'sm'` | `w-14` |
| `'md'` | `w-16` |
| `'lg'` | `w-20` |
| `'xl'` | `w-24` |
| `'2xl'` | `w-40` |

`NumberInputWidth` is exported from `NumberInput.tsx` and re-exported from `apps/web/src/components/ui/index.ts` alongside the existing `export type { NumberInputProps }`.

### 1.2 Symbol inventory

**Modified:** `NumberInputProps` (one added optional member), `NumberInput` (one added prop, one changed width-class derivation), `ui/index.ts` (one added type re-export), `HopSection` (JSX only — no prop-interface change, no handler-signature change).

**Explicitly untouched:** every export in `designSystem.ts` (28 constants, RA-1); `FormField`, `Input`, `Select`, `Button` and their prop types; `NumberInput`'s `size`, `align`, `addonRight`, `type`/`inputMode` defaults, the `addonRight` wrapper `<div>`, and the `pr-10` behaviour; `HopSectionProps`; all 8 `handle*Change` / `handleAdd*` / `handleRemove` functions; all 7 `useState` hooks and their initial values.

### 1.3 Files

**Authorized to MODIFY (5):**

| Path | Reason |
|---|---|
| `apps/web/src/components/ui/NumberInput.tsx` | Add `width` prop + `NumberInputWidth` type; derive width class. |
| `apps/web/src/components/ui/index.ts` | Re-export `NumberInputWidth`. |
| `apps/web/src/components/HopSection.tsx` | Migrate 13 raw numeric inputs; add 6 `aria-label`s. |
| `apps/web/test/HopSection.test.tsx` | Extend with this phase's HopSection ACs. |
| `apps/web/test/uiPrimitives.test.tsx` | Extend with this phase's `width`-axis ACs. |

**Authorized to MODIFY — pin reconciliation only, no new assertions (2):**

| Path | Exact permitted edit |
|---|---|
| `apps/web/test/ScopeGuardrail.test.tsx` | AC-15's object literal: **remove the `'components/HopSection.tsx': 6` key entirely.** AC-14's ceiling `<= 21` is **left as-is** (a ceiling remains satisfied by a lower total; tightening it is out of scope and would collide with M31_P4's re-SPEC_APPROVED figure). No other line changes. |
| `apps/web/test/designTokens.test.ts` | M30_P2 AC-15(b): the literal `14` → `7`, and the `it(...)` title's parenthetical updated to match. **AC-15(c)'s four-file array is NOT edited** (RA-8). No other line changes. |

**Authorized to CREATE: 0 files.**

---

## 2. Transformations & Pure Logic

### 2.1 `NumberInput` class derivation (contract, not code)

Deterministic, prop-only, no state, no effects. Given `(size, align, width, addonRight, className)`, the rendered `class` attribute is the space-joined, falsy-filtered concatenation, **in this exact order**:

1. exactly one width class per §1.1's table (RA-4: never two)
2. `size === 'sm'` → `INPUT_COMPACT_CLASS`; otherwise `` `${INPUT_CLASS} ${CONTROL_HEIGHT_CLASS}` `` — **unchanged from today**
3. `MONO_VALUE_CLASS` — **unchanged from today**
4. `align === 'right'` → `text-right`, else omitted — **unchanged**
5. `addonRight` truthy → `pr-10`, else omitted — **unchanged**
6. `className` verbatim, last — **unchanged**

The only behavioural delta versus today is step 1: the hardcoded `'w-full'` becomes the mapped value, whose default is `'w-full'`. **`width` omitted must produce output byte-identical to today's** for every combination of the other props.

No-match / degenerate contract: `width` is a closed union enforced at the type level; there is no runtime fallback branch and none is to be added. An omitted `width` is `'full'` via the parameter default, not via a runtime `??` on a wider type.

### 2.2 `HopSection.tsx` migration map (binding, 13 rows)

Every row below: `<NumberInput type="number" size="sm" align="right" width=… />`, existing `value`/`onChange`/`step`/`min`/`data-testid` passed through **verbatim**, `className` **absent** (RA-3), `addonRight` **absent** (RA-12), surrounding `<div className="flex …">` wrappers and unit `<span>`s **unchanged**.

**Table rows (7) — `aria-label`s already present, preserved verbatim:**

| # | Current line | Current width | `width` | `aria-label` (unchanged) |
|---|---|---|---|---|
| 1 | 222 boil minutes | `w-16` | `md` | `Boil minutes` |
| 2 | 235 whirlpool minutes | `w-14` | `sm` | `Whirlpool minutes` |
| 3 | 245 whirlpool temp | `w-14` | `sm` | `Whirlpool temp` |
| 4 | 259 dry-hop day offset | `w-12` | `xs` | `Dry hop day offset` |
| 5 | 270 dry-hop duration | `w-12` | `xs` | `Dry hop duration days` |
| 6 | 291 amount | `w-16` | `md` | `` `${hop.name} amount (g)` `` |
| 7 | 302 alpha acid | `w-16` | `md` | `` `${hop.name} alpha acid %` `` |

**Add-Hop form (6) — currently unnamed; `aria-label`s are NEW and exact:**

| # | Current line | Current width | `width` | NEW `aria-label` (exact string) |
|---|---|---|---|---|
| 8 | 374 `dryHopOffsetInput` | `w-14` | `sm` | `New hop dry hop day offset` |
| 9 | 383 `dryHopDurationInput` | `w-14` | `sm` | `New hop dry hop duration (days)` |
| 10 | 395 `timeInput` (Whirlpool/Aroma) | `w-14` | `sm` | `Hop addition time (minutes)` |
| 11 | 404 `whirlpoolTempInput` | `w-16` | `md` | `New hop whirlpool temperature (°C)` |
| 12 | 415 `timeInput` (fallback) | `w-16` | `md` | `Hop addition time (minutes)` |
| 13 | 427 `amountGInput` | `w-16` | `md` | `New hop amount (g)` |

Rows 10 and 12 intentionally share a label (RA-9). Rows 8–13 currently carry `` className={`w-14 ${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right`} `` (or `w-16`); that entire template literal is **removed** — `size="sm"` supplies `INPUT_COMPACT_CLASS`, `MONO_VALUE_CLASS` supplies `font-mono tabular-nums` (plus `tracking-tight`), `align="right"` supplies `text-right`, and `width` supplies the width. Rows 8–13 also lose their `placeholder` attributes only if the placeholder is absent today; existing `placeholder="0"` (row 8), `placeholder="3"` (row 9), `placeholder="20"` (row 10) are **preserved verbatim**.

### 2.3 Refactoring & legacy cleanup (explicit purge list)

- The 7 verbatim drifted class strings on the table inputs (RA-5) are deleted, not adapted. After this phase `HopSection.tsx` contains **zero** occurrences of `bg-slate-950 border border-slate-700/80`.
- The 6 `${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right` template literals in the add form are deleted. `apps/web/src` drops from 7 to 1 occurrence of that exact string. **`INPUT_COMPACT_CLASS` must no longer be imported by `HopSection.tsx`** once its last use is gone — a lingering unused import is a lint failure under Layer 1 gate 4.
- `HopSection.tsx`'s import list must end up importing exactly the tokens it still uses (`CARD_CLASS`, `SECTION_HEADING_CLASS`, `SUBPANEL_CLASS`, `FORM_SELECT_CLASS`, `FORM_SELECT_COMPACT_CLASS`) plus `NumberInput` from `./ui`.
- No obsolete registration loop, alias map, or side-effecting module exists on this surface; nothing else is purged.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|----|---|---|---|
| AC-1 | `NumberInputWidth` type exported | Typecheck / Unit | `NumberInputWidth` is importable from `components/ui/NumberInput` **and** from `components/ui` (index re-export). Assigning `'w-16'` (a raw class) to it fails typecheck. |
| AC-2 | Default width unchanged | Unit (`uiPrimitives`) | `<NumberInput data-testid="w-def" />` has class `w-full` and does **not** have `w-12`/`w-14`/`w-16`/`w-20`/`w-24`/`w-40`. |
| AC-3 | Backward compatibility of the whole class string | Unit (`uiPrimitives`) | With `width` omitted, `<NumberInput />` still satisfies existing AC-8 exactly: has `w-full`, `bg-slate-800`, `border-slate-700`, `rounded-lg`, `h-10`, `font-mono`, `tabular-nums`, `tracking-tight`, `type="text"`, `inputmode="decimal"`. |
| AC-4 | Full width scale maps correctly | Unit (`uiPrimitives`), table-driven | All 7 pairs assert: `full`→`w-full`, `xs`→`w-12`, `sm`→`w-14`, `md`→`w-16`, `lg`→`w-20`, `xl`→`w-24`, `2xl`→`w-40`. |
| AC-5 | Width exclusivity (RA-4) | Unit (`uiPrimitives`) | For every non-`full` value, the rendered element does **not** have class `w-full`. Asserted for all 6 non-`full` values, not just one. |
| AC-6 | Width composes with `size`/`align`/`addonRight` | Unit (`uiPrimitives`) | `<NumberInput size="sm" align="right" width="xs" addonRight="d" />` has `w-12`, `text-right`, `pr-10`, `px-2.5`, `py-1`, `text-xs`, `font-mono`, `tabular-nums`, `tracking-tight`, and does **not** have `h-10` or `w-full`. |
| AC-7 | `className` still wins last (RA-3) | Unit (`uiPrimitives`) | `<NumberInput width="md" className="zz-sentinel" />` renders a class attribute where `zz-sentinel` is the final token and `w-16` is present. |
| AC-8 | No new `NumberInput` runtime behaviour | Unit (`uiPrimitives`) | Existing M30_P3 AC-8..AC-12 tests pass **with their assertions unmodified** (the executor may not edit those five `it()` bodies). |
| AC-9 | `designSystem.ts` byte-unchanged (RA-1) | Verification | SHA-256 of `apps/web/src/components/designSystem.ts` is identical pre- and post-phase. `designSystem.test.ts:20`'s `MONO_VALUE_CLASS === 'font-mono tabular-nums tracking-tight'` passes unmodified, and `designSystem.test.ts` itself is byte-unchanged. |
| AC-10 | Zero raw `<input>` in HopSection | Source sweep (`HopSection.test.tsx`) | Reading `src/components/HopSection.tsx`, the count of `/<input[\s>]/` matches is **0** (down from 13). |
| AC-11 | 13 `<NumberInput>` call sites | Source sweep | The count of `/<NumberInput[\s>]/` matches in `HopSection.tsx` is exactly **13**. |
| AC-12 | Every call site passes `type="number"` (RA-6) | Rendered + sweep | Every `<NumberInput` occurrence in `HopSection.tsx` is followed, before its tag close, by `type="number"`; and in a render with 1 Boil hop, `screen.getByLabelText('Boil minutes').getAttribute('type') === 'number'`. |
| AC-13 | No `className` on migrated call sites (RA-3) | Source sweep | Zero `<NumberInput …>` tags in `HopSection.tsx` contain `className`. |
| AC-14 | Drifted local strings purged (§2.3) | Source sweep | `HopSection.tsx` contains **0** occurrences of `bg-slate-950 border border-slate-700/80`, **0** of `${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right`, and **0** of `focus:ring-1`. |
| AC-15 | `INPUT_COMPACT_CLASS` import removed | Source sweep + lint | `HopSection.tsx` does not import `INPUT_COMPACT_CLASS`; `npm run lint` reports no new unused-import warning. |
| AC-16 | Table-row widths render correctly | Rendered (`HopSection.test.tsx`) | With one Boil hop, one Whirlpool hop and one DryHop hop rendered: `Boil minutes`→`w-16`; `Whirlpool minutes`→`w-14`; `Whirlpool temp`→`w-14`; `Dry hop day offset`→`w-12`; `Dry hop duration days`→`w-12`; `<name> amount (g)`→`w-16`; `<name> alpha acid %`→`w-16`. |
| AC-17 | All 6 add-form controls have the exact new accessible names (RA-10) | Rendered | With `hops={[]}` and use `Boil`, `getByLabelText('Hop addition time (minutes)')` and `getByLabelText('New hop amount (g)')` each resolve to exactly one element. Switching use to `DryHop` resolves `New hop dry hop day offset` and `New hop dry hop duration (days)`; switching to `Whirlpool` resolves `Hop addition time (minutes)` and `New hop whirlpool temperature (°C)`. |
| AC-18 | Shared label is never ambiguous (RA-9) | Rendered | In the `Whirlpool` branch and in the fallback branch independently, `getAllByLabelText('Hop addition time (minutes)')` has length exactly **1** (`getByLabelText` does not throw). |
| AC-19 | Migrated inputs share one numeric typography | Rendered | Every element resolved in AC-16 and AC-17 has all three of `font-mono`, `tabular-nums`, `tracking-tight` — i.e. `MONO_VALUE_CLASS` in full. This is the assertion that fails against the pre-phase source, where `tracking-tight` is absent from all 13. |
| AC-20 | Entered value and rendered readback share typography | Rendered | In one render, an input from AC-16 and the row's IBU readback cell (`hop-ibu-${id}`) both carry `font-mono` and `tabular-nums`; the input additionally carries `tracking-tight` — closing the entered-vs-displayed gap on this surface. (The readback cell's own class string is NOT edited by this phase; Milestone 32 P4 owns the readback side.) |
| AC-21 | Editing behaviour preserved — lockstep with `onUpdate` | Rendered | `fireEvent.change` on `hop-boil-mins-*`, `hop-whirlpool-mins-*`, `hop-whirlpool-temp-*`, `hop-dry-offset-*`, `hop-dry-duration-*`, `<name> amount (g)` and `<name> alpha acid %` each fires `onUpdate` exactly once with the same mutated `HopItem` shape as before (including `Math.max(0, …)` clamping, and `dryHopDurationDays` updating `timeMinutes` to `days * 1440` in the same call). |
| AC-22 | Add-Hop flow preserved | Rendered | Selecting `Citra`, entering an amount and time via the new labelled inputs, and clicking `Add Hop` calls `onUpdate` with an array of `hops.length + 1` whose new item matches the pre-phase field-for-field construction (`amountG`, `use`, `boilMins`, `whirlpoolMins`, `whirlpoolTempC`, `dryHopDayOffset`, `dryHopDurationDays`, `timeMinutes`, `type`). |
| AC-23 | Degenerate: empty hop list (RA-13) | Rendered | With `hops={[]}`: exactly one `colSpan={7}` empty-state row renders, zero `<NumberInput>`-rendered inputs appear inside `<tbody>`, and the add-form's inputs still render and are still resolvable by their AC-17 labels. |
| AC-24 | Existing `data-testid`s preserved (RA-11) | Rendered | All 5 per-row testids resolve, and each resolves to an `HTMLInputElement`. |
| AC-25 | M14 `scope="col"` guarantee, unmodified | Existing test | `accessibilityAndPolish.test.tsx`'s `HopSection sets scope="col" on all <th> elements` passes with the test file **byte-unchanged**, and `HopSection.tsx`'s `<thead>`/`<th>` block is byte-unchanged. |
| AC-26 | M14 AC-8 accessible-name guarantee, unmodified | Existing test | `accessibilityAndPolish.test.tsx`'s `AC-8: Hop amount, alpha acid inputs, and remove button have accessible names and padding` passes with the test file **byte-unchanged** (`Saaz amount (g)`, `Saaz alpha acid %`, `Remove Saaz`, remove button retains `p-2`). |
| AC-27 | M14 AC-1..AC-5 token-import guarantee | Existing test | `accessibilityAndPolish.test.tsx`'s per-file assertion that `HopSection.tsx` imports `CARD_CLASS` and `SECTION_HEADING_CLASS` passes unmodified. |
| AC-28 | Out-of-scope elements untouched (RA-7, RA-12) | Source sweep | `HopSection.tsx` still contains exactly 3 `<select`, exactly 2 `<button`, the `—` placeholder `<div className="text-right text-xs text-slate-400 font-mono">`, and zero `addonRight` occurrences. |
| AC-29 | `ScopeGuardrail` unnamed-control reconciliation | Existing test, reconciled | `ScopeGuardrail.test.tsx` AC-15's map no longer contains a `components/HopSection.tsx` key; the app-wide AC-14 total is **11** (was 17) and still satisfies the unchanged `<= 21` ceiling. Only the one key is removed; the other 8 entries and the AC-14 ceiling are unedited. |
| AC-30 | `focus:outline-none` reconciliation (RA-8) | Existing test, reconciled | `designTokens.test.ts` M30_P2 AC-15(b) asserts **7** (was 14) and passes; AC-15(c)'s array is **byte-unchanged** and still passes with `components/HopSection.tsx` present (HopSection retains exactly 1 occurrence, on the out-of-scope `<select>`). |
| AC-31 | Existing `HopSection.test.tsx` behaviour suites survive | Existing tests | `F-7`, `M11_P2 AC-10..AC-14`, and `AC-10: HopSection summary conversion` all pass. Where a selector must change from a removed class string to a testid/label, the **assertion's meaning** is unchanged; the executor must state each such edit in its report. |
| AC-32 | Cross-file consumers unaffected | Existing tests | `useRecipeEditor.test.tsx`, `BatchDetail.test.tsx`, `InventoryManager.test.tsx`, `calculatorImportGraph.test.ts` pass **byte-unchanged**. |
| AC-33 | Test-count monotonicity | Layer 1 | Total passing tests ≥ the M31_P4 closing baseline of **2091 passed / 2 skipped**, with no previously-passing test removed or `.skip`ped. Net new tests are additive. |
| AC-34 | Four Layer 1 gates green | Layer 1 | All four commands in §4.1 exit 0. Lint shows exactly the 4 pre-existing `only-export-components` warnings and 0 new. |
| AC-35 | **Scope guardrail — SHA-256 content manifest** | Verification | See §4.2. |

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

Expected: `npm test` exit 0 with ≥ 2091 passed / 2 skipped; `npm run typecheck` exit 0 across 4/4 workspaces; `npm run build` exit 0; `npm run lint` exit 0 with exactly the 4 known pre-existing warnings.

### 4.2 AC-35 — Scope guardrail (SHA-256 content manifest)

**`git diff --name-only` is NOT used and must not be substituted.** This repo has 2 commits against a large pre-existing uncommitted tree — `apps/web` is almost entirely untracked or staged-new — so a diff-based criterion is unfalsifiable here. Same reasoning M31_P4 recorded and M30_P1 established.

**Before the first edit**, from the repo root:

```bash
git ls-files -co --exclude-standard -z | xargs -0 sha256sum > "$TMPDIR/M32_P1_manifest_pre.txt"
```

**After the last edit**, the same command to `M32_P1_manifest_post.txt`, then diff the two manifests.

The manifest diff must show changed hashes for **exactly these 7 paths and no others**:

1. `apps/web/src/components/ui/NumberInput.tsx`
2. `apps/web/src/components/ui/index.ts`
3. `apps/web/src/components/HopSection.tsx`
4. `apps/web/test/HopSection.test.tsx`
5. `apps/web/test/uiPrimitives.test.tsx`
6. `apps/web/test/ScopeGuardrail.test.tsx`
7. `apps/web/test/designTokens.test.ts`

Plus, as the only permitted **additions** to the manifest: `.gsd/` bookkeeping (`STATE.json`, archive logs) and, if captured, `.gsd/active/manual_verification/M32_P1_*.png`. **Zero files deleted. Zero source files created.**

### 4.3 Forbidden paths (explicitly OUT of scope — must be byte-identical)

- `apps/web/src/components/designSystem.ts` — **RA-1. The single highest-blast-radius file in this initiative.**
- `apps/web/test/designSystem.test.ts`
- `apps/web/src/components/FermentableSection.tsx` — Milestone 32 **P2**
- `apps/web/src/components/MiscSection.tsx` — Milestone 32 **P2**
- `apps/web/src/components/YeastSection.tsx` — Milestone 32 **P3**
- `apps/web/src/components/MashSection.tsx` — Milestone 32 **P3**
- `apps/web/src/App.tsx` — Milestone 32 **P4**
- `apps/web/src/components/StatsHeader.tsx` — Milestone 32 **P4**
- `apps/web/src/components/ui/FormField.tsx`, `Input.tsx`, `Select.tsx`, `Button.tsx`
- `apps/web/test/accessibilityAndPolish.test.tsx` — AC-25/AC-26/AC-27 are only meaningful if this file is unmodified
- `apps/web/test/FermentableSection.test.tsx`, `MiscSection.test.tsx`, `MashSection.test.tsx`, `StatsHeader.test.tsx`, `App.test.tsx`
- `packages/**`, `apps/api/**`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `apps/web/src/index.css`
- `.gsd/ROADMAP.md` — this phase changes no phase count (see §Grounded reconciliation)

### 4.4 Manual verification (best-effort)

If browser automation is available, capture `.gsd/active/manual_verification/M32_P1_hop_section_numbers.png` — the recipe designer's Hops card with at least one Boil hop and one DryHop hop, showing the table inputs and the Add-Hop form. If unavailable, report it as outstanding evidence for `/steer`'s critic (the M30_P1 / M31_P4 precedent), rather than silently omitting it.

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
