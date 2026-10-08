# FEATURE SPECIFICATION: M32_P3 — The Yeast Input and the Mash Readback

**Milestone 32** (*The recipe designer's numbers line up*) — **Phase 3 of 4**
**Planner:** claude-code · **Date:** 2026-08-25 · **State:** 2 (awaiting SPEC_APPROVED)

---

## Phase Summary

M32_P1 settled the `NumberInput` API and proved it on `HopSection.tsx` (13 inputs). M32_P2 migrated `FermentableSection.tsx` (2) and `MiscSection.tsx` (3) against that settled API. Phase 3 takes the roadmap's two remaining section files — and it is **not the phase the roadmap describes**.

`YeastSection.tsx` has exactly **one** raw numeric input. `MashSection.tsx` has **zero raw `<input>` elements of any kind** — it is a pure read-only display component (two profile-picker `<select>`s and two computed tables). There is nothing in `MashSection.tsx` to migrate onto `NumberInput`, and there never was.

So this phase is two halves with two different shapes:

1. **`YeastSection.tsx` — the last input migration of the milestone.** Its one attenuation input moves onto `<NumberInput size="sm" align="right" width="md">`, and the file gets its first-ever dedicated test suite (`apps/web/test/YeastSection.test.tsx` does not exist today).
2. **`MashSection.tsx` — the readback half.** The milestone's user-visible outcome is that *"the number you type is set in the same letter-spacing as the number the stats header reads back to you."* `MashSection` is a **readback** surface: it displays strike water, strike temperature, sparge temperature, target pH, and eleven columns of computed step figures — **none of which carry `font-mono tabular-nums` today**, while every number the brewer types beside them now does. Unifying that typography onto `MONO_VALUE_CLASS` is the only reading of "migrate `MashSection.tsx`" that this milestone's stated outcome supports in a file with no inputs.

**No `components/ui/` file and no `designSystem.ts` token is modified by this phase** (§4.3). Every prop and token consumed already exists and is already pinned.

### Grounded reconciliation against ROADMAP.md's Milestone 32 P3 bullet (BINDING)

The roadmap's P3 bullet ("**P3 — `YeastSection.tsx` and `MashSection.tsx`.** ~4 files") was written on 2026-08-24, before M32_P1/P2 executed. Per the standing M30/M31/M32 precedent — the roadmap's phase bullets have been stale at **every** phase of this initiative — it was re-verified against actual current source rather than trusted:

| Roadmap claim | Ground truth (verified 2026-08-25 against current source) | Resolution |
|---|---|---|
| P3 is a two-file `NumberInput` migration | **False for half the phase.** `MashSection.tsx` contains **0** `<input>` elements (`grep -c '<input' = 0`). It renders 2 `<select>`s and 2 computed tables and takes no numeric entry at all. | P3 is redefined as **one** input migration (Yeast) plus a **readback typography** unification (Mash). See RA-1. |
| (implied) count of raw numeric inputs | `YeastSection.tsx`: **1** (line 71–79, the per-row attenuation %). `MashSection.tsx`: **0**. Total **1**, not the ~5 the bullet's shape implies. | Pinned as exact counts in AC-3/AC-16. |
| (implied) unnamed controls | **0 in both files.** `YeastSection.tsx`'s input already carries `` aria-label={`${yeast.name} attenuation %`} `` and its `<select>` carries `aria-label="Select Yeast Strain"`; both of `MashSection.tsx`'s `<select>`s carry `aria-label`. Neither file appears in `ScopeGuardrail.test.tsx` AC-15's map. | **Zero new `aria-label`s in this phase** — the first M32 phase with none. |
| "~4 files" | **5 files.** 2 source + 1 existing test suite extended + **1 test suite created** (`YeastSection.test.tsx` does not exist) + 1 cross-file pin reconciliation. | Corrected to 5, with a different composition than the bullet implies. |
| (implied) pin reconciliations, per the P1/P2 "+2" pattern | **Only 1 this time.** `ScopeGuardrail.test.tsx` needs **no** edit (both files already count 0 unnamed controls) and `designTokens.test.ts` needs **no** edit (both files have **0** `focus:outline-none` occurrences; the app-wide 6 and AC-15(c)'s three-file array are untouched). The single reconciliation is `FermentableSection.test.tsx`'s app-wide residue count. | Both files added to §4.3's byte-identical list — a deliberate *non*-edit, not an oversight. |

**`.gsd/ROADMAP.md`'s "Estimated phases: 4" line for Milestone 32 remains correct and is not changed by this phase.** P4 (identity, scale and readback: `App.tsx`, `StatsHeader.tsx`, and the milestone's closing assertions) is still a full phase. The bullet's prose was refreshed at this `/plan` to record P3's grounded shape so P4's planner does not re-derive it.

### Key Behaviors

1. `YeastSection.tsx`'s one raw `<input type="number">` renders through `<NumberInput>`. The file contains zero raw `<input>` elements afterward.
2. The attenuation input gains `tracking-tight` via `MONO_VALUE_CLASS`, and is otherwise visually identical (`w-16`, `text-right`, compact size).
3. `MashSection.tsx`'s eleven computed numeric readbacks render `MONO_VALUE_CLASS` — the same `font-mono tabular-nums tracking-tight` the brewer now types into.
4. `MashSection.tsx`'s render tree gains **no new element**. Only `className` values change, plus two new `data-testid` hooks.
5. `apps/web/test/YeastSection.test.tsx` exists for the first time.
6. M14's `scope="col"` assertions, M14's AC-9 yeast accessible-name assertion, and all 18 of `MashSection.test.tsx`'s pre-existing behavioural tests pass **unmodified**.

### Resolved Ambiguities (Binding)

- **RA-1 — `MashSection.tsx`'s inclusion in this phase is a readback typography change, and that is a deliberate, bounded interpretation.**
  The roadmap lists `MashSection.tsx` in Milestone 32's hardening scope ("Migrate … `YeastSection.tsx`, `MashSection.tsx`"), but the file has no inputs to migrate. Doing nothing would leave a roadmap-named file untouched with no record of why; treating it as an input migration is impossible. The milestone's own user-visible outcome — *"the number you type is set in the same letter-spacing as the number the stats header reads back to you"* — is a statement about **readback**, and `MashSection` is the recipe designer's second-largest readback surface after `StatsHeader` (which P4 owns). This phase therefore unifies its numeric typography onto `MONO_VALUE_CLASS` and nothing else. **Layout, structure, sizing, colour, spacing and copy are untouched.** If a reviewer judges this out of scope, the correct response is to strike §2.3's MashSection rows at SPEC_APPROVED and let the phase ship as a Yeast-only migration — not to broaden it.

- **RA-2 — No `components/ui/` file and no `designSystem.ts` token is modified.**
  `size`, `align`, `width` and `MONO_VALUE_CLASS` are all already correct as M32_P1 left them and M32_P2 consumed them. `width="md"` → `w-16` is already pinned by `uiPrimitives.test.tsx`. `designSystem.ts` remains this initiative's highest-blast-radius file (the M30_P1 precedent) and stays byte-identical at 28 exports. Needing to change either is a `/diagnose` signal, not an inline edit. Both are in §4.3.

- **RA-3 — Y-1's size is derived from its current base token, not re-litigated.**
  The attenuation input currently renders `` `w-16 text-right ${INPUT_COMPACT_CLASS} font-mono tabular-nums` ``, which maps exactly onto `size="sm" align="right" width="md"` — the identical mapping M32_P2 applied to `MiscSection`'s three inputs. **No control changes height in this phase.** `size="sm"` carries no `CONTROL_HEIGHT_CLASS`, so unlike M32_P2's F-2 nothing gains `h-10` here.

- **RA-4 — `className` must be absent entirely on the migrated call site.**
  Expressing width, alignment, font or numeric typography through `className` would reintroduce the improvised-suffix pattern this milestone removes. The single `<NumberInput …>` tag in `YeastSection.tsx` may not contain `className`. Asserted by source sweep (AC-7), not inspection.

- **RA-5 — `type="number"` is passed explicitly; `NumberInput`'s `type="text"` default is overridden.**
  `accessibilityAndPolish.test.tsx` AC-9 resolves the control by label and the phase's own tests resolve it by the `spinbutton` role, which only `type="number"` produces. `addonRight` is **not** used (the `%` is part of the column header and the label, not an adornment) — AC-15.

- **RA-6 — `min="50"` and `max="98"` are preserved verbatim, and their disagreement with the handler's clamp is preserved too, not reconciled.**
  The native attributes advise 50–98. The handler clamps `Math.max(0, Math.min(100, …))` — 0–100. These have disagreed since the file was written; native `min`/`max` on a number input constrain stepper/validation behaviour but do **not** constrain a programmatically-set value, so the handler's range is the effective one. **This phase does not touch either.** Changing the clamp or the attributes would be an unrequested behavioural change smuggled into a markup migration. Recorded so a reviewer sees a preserved quirk rather than an accident, and pinned by AC-6 and AC-13.

- **RA-7 — Y-1 has no `step` attribute today and must not gain one.**
  Its handler parses with `parseInt(e.target.value, 10)`. Adding `step` would invite fractional stepper values into an integer-parsed field. Asserted as `hasAttribute('step') === false` (AC-6) — the same explicit-absence assertion M32_P2 used for M-1.

- **RA-8 — The `|| 75` fallback is preserved exactly, including its falsy-zero quirk.**
  `handleAttenuationChange` receives `parseInt(e.target.value, 10) || 75`. Because `0` is falsy, typing `0` yields **75**, not 0 — and typing a non-numeric string also yields 75. This is pre-existing behaviour, it is **preserved verbatim**, and it is pinned by AC-12 precisely so a migration-time "cleanup" to `?? 75` or `|| 0` is caught. The migration moves markup, not arithmetic. `Math.max(0, Math.min(100, …))` is likewise carried through unchanged, as is `handleAddFromCatalog`'s `amountPkg: 1`.

- **RA-9 — `MashSection.tsx` gains no new element, and no number is re-wrapped.**
  Only `className` attribute values change on **existing** elements, plus two new `data-testid` attributes (RA-10). Introducing a `<span>` around a number embedded in prose would split a text node, and `MashSection.test.tsx`'s 18 existing tests resolve values with `getByText` against exact strings (`'15.5 L'`, `'4.09 gal'`, `/sparge temp/i`) — a wrapper would break assertions this phase must leave passing unmodified. This is why the two prose warnings are excluded (RA-12). Pinned by AC-23.

- **RA-10 — Exactly two new `data-testid` attributes are added, and no more.**
  `mash-sparge-temperature-value` (MS-3) and `mash-target-ph-value` (MS-4) — the two readbacks with no stable query handle today. `MashSection.tsx` already carries 10 `data-testid` attributes, so this follows the file's own established convention; they are non-visual, non-semantic test hooks and add no element. The other nine readbacks are reachable via existing testids (`mash-strike-temperature-value`, `mash-plan`, `mash-plan-step-{position}`, `fermentation-plan-step-{i}`) or by table position within them.

- **RA-11 — Where a numeric cell contains a unit or source annotation, the annotation is monospaced too. This matches the house style, and is a decision, not an oversight.**
  The Infusion cell renders `` {formatVolume(…)} <span className="text-[10px] text-slate-400">({step.infusionSource})</span> ``, and the step tables append `min`, `d` and `psi` suffixes. Applying `MONO_VALUE_CLASS` at the `<td>` means these annotations inherit `font-mono`. **`StatsHeader.tsx` already does exactly this** — line 88 renders `` <span className="text-xs font-normal text-slate-400 font-mono tabular-nums">({stats.ebc} EBC)</span> `` — so mono-on-annotation is the established precedent on the very readback surface this milestone is aligning to. No annotation span gains an opt-out class.

- **RA-12 — The two prose warnings are deliberately excluded and stay byte-identical.**
  The strike-temperature enzyme warning and the mash-water-balance warning both embed a formatted figure mid-sentence. Monospacing the whole sentence would be wrong, and monospacing only the figure requires a new wrapper element (forbidden by RA-9). They are recorded here as a known, accepted gap rather than silently skipped, and their class strings are pinned unchanged by AC-22.

- **RA-13 — `MashSection.tsx`'s `<th>` elements lack `scope="col"`, and this phase deliberately does NOT add it.**
  Verified: both step tables render `<th className="…">` with no `scope`. `accessibilityAndPolish.test.tsx` AC-6 covers `FermentableSection`, `HopSection` and `YeastSection` only — `MashSection` was never in M14's scope. This is the identical call M32_P2's RA-11 made for `MiscSection`, for the identical reason: Milestone 35 owns tables, and adding it here would be an unrequested accessibility change to table markup. Pinned as still-zero by AC-24.

- **RA-14 — Numeric-typography scope is drawn at the value, not the table. M35's table ownership is not encroached.**
  This phase changes `className` values on `<td>` elements; it does **not** touch `<table>`, `<thead>`, `<tr>` or `<th>`, does not introduce `TH_CLASS`/`TD_CLASS`-style local constants, and does not alter column structure, ordering, padding or alignment. Milestone 35's claim on tables is the `Table` **primitive and its structural tokens** — a different axis from the typography of the numbers inside the cells, which is this milestone's entire subject. Non-numeric cells (Step name, Type) are explicitly excluded (AC-21).

- **RA-15 — `<select>`s, `<button>`s and wrapper markup are out of scope in both files.**
  `YeastSection.tsx` keeps its 1 `<select>` and 2 `<button>`s, including the hand-rolled `bg-purple-600 …` Select Yeast button — Milestone 33 owns buttons, Milestone 34 owns selects. `MashSection.tsx` keeps both profile-picker `<select>`s untouched. `addonRight` is used nowhere in this phase.

- **RA-16 — Degenerate branches are untouched and must be re-asserted.**
  `yeasts.length === 0` renders a single `colSpan={6}` empty-state row and no numeric input. `MashSection` has four such branches — `mash-no-profile`, `mash-no-steps`, `fermentation-no-profile`, `fermentation-no-steps` — plus `mashPlan.steps.length > 0` and `recipe.fermentationProfile.steps.length > 0` gates. All six render exactly as they do today; a zero-step or absent profile must never surface a monospaced placeholder where nothing rendered before. Pinned by AC-14 and AC-25.

- **RA-17 — `YeastSection.test.tsx` is created, not extended.**
  No dedicated suite exists for this file today; its only coverage is incidental, inside `accessibilityAndPolish.test.tsx` AC-6/AC-9. This is the milestone's first file creation. The new suite must not duplicate or relocate those two existing assertions — they stay where they are, in a file that is byte-frozen (AC-26).

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

// apps/web/src/components/designSystem.ts  — READ ONLY this phase
export const MONO_VALUE_CLASS = 'font-mono tabular-nums tracking-tight';
```

Width mapping consumed by this phase (already pinned by `uiPrimitives.test.tsx`):

| `width` | emitted class | consumed by |
|---|---|---|
| `'md'` | `w-16` | Y-1 |
| all others | — | not consumed by this phase |

### 1.2 Symbol inventory

**Modified:** `YeastSection` (JSX + import list only), `MashSection` (JSX `className` values, 2 `data-testid` additions, and import list only).

**Explicitly untouched:**
- Every export in `designSystem.ts` (28 constants) — RA-2.
- `NumberInput`, `NumberInputProps`, `NumberInputWidth`, `FormField`, `Input`, `Select`, `Button`, and `ui/index.ts`'s export list — RA-2.
- `YeastSectionProps` and `MashSectionProps` — no prop-interface change. `MashSection`'s seven props keep their exact names, types and JSDoc.
- `handleAddFromCatalog`, `handleAttenuationChange`, `handleRemove` (YeastSection) — no signature or body change (RA-8).
- `YeastSection`'s `useState('')` for `selectedCatalogId`, and its `useCatalog()` usage including the `catalogError` branch.
- `MashSection` has no state, no hooks and no handlers of its own — it is a pure props-to-markup function and must remain one. `formatTemperature`, `formatVolume` and `strikeTempExceedsEnzymeLimit` call sites are unchanged in count, arguments and position.

### 1.3 Files

**Authorized to MODIFY (3):**

| Path | Reason |
|---|---|
| `apps/web/src/components/YeastSection.tsx` | Migrate 1 raw numeric input onto `<NumberInput>`; drop `INPUT_COMPACT_CLASS` import; add `NumberInput` import. |
| `apps/web/src/components/MashSection.tsx` | Apply `MONO_VALUE_CLASS` to 11 enumerated numeric readbacks; add 2 `data-testid` hooks; add `MONO_VALUE_CLASS` import. |
| `apps/web/test/MashSection.test.tsx` | **Extend only.** Append this phase's MashSection ACs. All 18 pre-existing tests keep their assertions unmodified (AC-25). |

**Authorized to MODIFY — pin reconciliation only, no new assertions (1):**

| Path | Exact permitted edit |
|---|---|
| `apps/web/test/FermentableSection.test.tsx` | In the `app-wide residue counts land exactly where §2.3 pins them` block: the literal `expect(compactCount).toBe(2)` → `toBe(1)`. `inputClassCount` stays **16** and `compactTextRightCount` stays **0**. **No other line in the file changes.** |

**Authorized to CREATE (1):**

| Path | Reason |
|---|---|
| `apps/web/test/YeastSection.test.tsx` | First dedicated suite for this component (RA-17). Carries this phase's YeastSection ACs. |

`.gsd/active/manual_verification/M32_P3_*.png` per §4.4 is bookkeeping, not a source file.

---

## 2. Transformations & Pure Logic

### 2.1 Pure-logic contract

This phase introduces **no new pure function, no new derived value, and no new state**. `NumberInput`'s class-derivation contract — a deterministic, prop-only, side-effect-free join of `[widthClass, baseClasses, MONO_VALUE_CLASS, alignClass, addonPad, className].filter(Boolean).join(' ')` — is consumed unchanged from M32_P1 and is not re-specified here.

**No-match / fallback contract:** not applicable — there is no lookup, no matching pass and no zero-match branch anywhere in this phase. `width` is a closed type-level union with a parameter default, not a runtime `??` over a wider type; no runtime fallback branch exists or may be added. The only value-level fallback in scope is `YeastSection`'s pre-existing `|| 75` (RA-8), which is preserved verbatim and is **not** a no-match placeholder — it is a parse-failure default that legitimately reaches state, and AC-12 pins it doing so.

**Stateful integration contract:** `YeastSection` remains a controlled-input container. The migrated `<NumberInput>` keeps its exact `value={yeast.attenuationPct}` binding and its exact `onChange` closure, so the render → change → `onUpdate` → re-render cycle is byte-for-byte the behaviour it is today. `onUpdate` must fire **exactly once** per `fireEvent.change`, with the same mapped-array shape (`yeasts.map(...)`, never a mutation) — asserted by AC-11.

`MashSection` has **no** stateful integration to preserve: it holds no state, registers no effect, and its two `onSelect*` callbacks are invoked only from `<select>` elements this phase does not touch. Its contract this phase is purely that a `className` change alters no rendered text, no element count, and no callback wiring — asserted by AC-23 and AC-25.

### 2.2 Migration map — `YeastSection.tsx` (binding, 1 row)

Existing `value`, `onChange`, `min`, `max` and `aria-label` pass through **verbatim**; `className` **absent** (RA-4); `step` **absent** (RA-7); `addonRight` **absent** (RA-15); the surrounding `<td className="py-2.5 px-3 text-right">` **unchanged**.

| # | Current line | Control | Current width class | Current base | `width` | `size` | `align` | `aria-label` | Preserved attrs |
|---|---|---|---|---|---|---|---|---|---|
| Y-1 | 71–79 | Per-row attenuation % | `w-16` | `${INPUT_COMPACT_CLASS}` | `md` | `sm` | `right` | `` `${yeast.name} attenuation %` `` — **unchanged** | `type="number"`, `min="50"`, `max="98"` (no `step`) |

Y-1's `` className={`w-16 text-right ${INPUT_COMPACT_CLASS} font-mono tabular-nums`} `` is deleted in full: `size="sm"` supplies `INPUT_COMPACT_CLASS`, `MONO_VALUE_CLASS` supplies `font-mono tabular-nums tracking-tight`, `align="right"` supplies `text-right`, `width="md"` supplies `w-16`. The sole rendered delta is the arrival of `tracking-tight`. The input has no `placeholder` today and does not gain one.

### 2.3 Readback map — `MashSection.tsx` (binding, 11 rows)

Every row: `MONO_VALUE_CLASS` is **appended to the existing `className`**, except where the row says *replaces `tracking-tight`* — in which case the literal `tracking-tight` is removed first, so the token supplies it and the class appears exactly once. No element is added, removed or re-nested (RA-9). No other attribute changes except the two `data-testid` additions marked **NEW**.

| # | Current line | Readback | Current className (excerpt) | Change | Query handle |
|---|---|---|---|---|---|
| MS-1 | 71 | Strike Water volume | `text-xl font-extrabold text-white tracking-tight` | append `MONO_VALUE_CLASS`, **replaces `tracking-tight`** | within `mash-plan` |
| MS-2 | 76 | Strike Temperature | `text-xl font-extrabold text-amber-400 tracking-tight` | append `MONO_VALUE_CLASS`, **replaces `tracking-tight`** | existing `mash-strike-temperature-value` |
| MS-3 | 102–104 | Sparge temperature `<strong>` | `text-slate-200` | append `MONO_VALUE_CLASS` | **NEW** `data-testid="mash-sparge-temperature-value"` |
| MS-4 | 108 | Target pH `<strong>` | `text-slate-200` | append `MONO_VALUE_CLASS` | **NEW** `data-testid="mash-target-ph-value"` |
| MS-5 | 130 | Mash step — Temp `<td>` | `py-1.5 px-2 text-right` | append `MONO_VALUE_CLASS` | `mash-plan-step-{position}`, cell 3 |
| MS-6 | 131 | Mash step — Rest `<td>` | `py-1.5 px-2 text-right` | append `MONO_VALUE_CLASS` | `mash-plan-step-{position}`, cell 4 |
| MS-7 | 132 | Mash step — Infusion `<td>` | `py-1.5 px-2 text-right` | append `MONO_VALUE_CLASS` (annotation inherits — RA-11) | `mash-plan-step-{position}`, cell 5 |
| MS-8 | 142 | Mash step — Volume After `<td>` | `py-1.5 px-2 text-right` | append `MONO_VALUE_CLASS` | `mash-plan-step-{position}`, cell 6 |
| MS-9 | 213 | Ferm step — Temp `<td>` | `py-1.5 px-2 text-right` | append `MONO_VALUE_CLASS` | `fermentation-plan-step-{i}`, cell 3 |
| MS-10 | 214 | Ferm step — Duration `<td>` | `py-1.5 px-2 text-right` | append `MONO_VALUE_CLASS` | `fermentation-plan-step-{i}`, cell 4 |
| MS-11 | 215 | Ferm step — Pressure `<td>` | `py-1.5 px-2 text-right` | append `MONO_VALUE_CLASS` | `fermentation-plan-step-{i}`, cell 5 |

**Deliberately EXCLUDED from this map** (each is byte-identical afterward):

| Element | Line | Why excluded |
|---|---|---|
| Strike-temp enzyme warning prose | 87–97 | Figure is mid-sentence; monospacing requires a new wrapper (RA-9, RA-12). |
| Mash-water-balance warning prose | 150–155 | Same; also pinned by an existing `getByText` test at `MashSection.test.tsx:357`. |
| Mash step — Step name `<td>` | 128 | Not a number (RA-14, AC-21). |
| Mash step — Type `<td>` | 129 | Not a number. |
| Ferm step — Step name `<td>` | 211 | Not a number. |
| Ferm step — Type `<td>` | 212 | Not a number. |
| Empty-state / no-profile divs | 59, 81, 185, 191 | Prose, no figures (RA-16). |
| Both `<select>` pickers | 42–55, 168–181 | Out of scope (RA-15). |
| All `<table>`/`<thead>`/`<tr>`/`<th>` | — | Out of scope (RA-13, RA-14). |

### 2.4 Refactoring & legacy cleanup (explicit purge list)

- **`INPUT_COMPACT_CLASS` must no longer be imported by `YeastSection.tsx`** — Y-1 is its only consumer in that file. Its post-phase `designSystem` import list is exactly `CARD_CLASS`, `SECTION_HEADING_CLASS`, `SUBPANEL_CLASS`, `FORM_SELECT_CLASS`, plus `NumberInput` from `./ui`. A lingering unused import is a lint failure under Layer 1 gate 4 and is pinned by AC-8.
- `MashSection.tsx`'s import list **gains** `MONO_VALUE_CLASS` and drops nothing; its post-phase `designSystem` import list is exactly `CARD_CLASS`, `SECTION_HEADING_CLASS`, `FORM_SELECT_COMPACT_CLASS`, `MONO_VALUE_CLASS`.
- App-wide template-literal residue after this phase (verified pre-phase counts in parentheses): `${INPUT_COMPACT_CLASS} font-mono tabular-nums` **1** (2), surviving only in `BrewDayTracker.tsx:545` — which Milestone 33 owns. `${INPUT_CLASS} font-mono tabular-nums` stays **16**; `${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right` stays **0**.
- **After this phase, all five recipe-designer section files are free of raw `<input type="number">`** — `HopSection` (P1), `FermentableSection`/`MiscSection` (P2), `YeastSection` (P3), and `MashSection` (never had any). The milestone's adoption assertion over the five section files is satisfiable from here; **P4 owns writing it**, and this phase does not pre-empt it.
- No obsolete registration loop, legacy alias map, module-level side effect, or dead export exists on this surface. No `designSystem.ts` token becomes consumer-less as a result of this phase (`INPUT_COMPACT_CLASS` retains consumers in `BrewDayTracker.tsx` and `NumberInput.tsx` itself).

---

## 3. Acceptance Criteria & Test Matrix

32 criteria. Every one is answerable as a yes/no against the built code.

| ID | Requirement | Test Type | Expected Outcome |
|----|---|---|---|
| AC-1 | `components/ui/` untouched (RA-2) | Verification | SHA-256 of `apps/web/src/components/ui/NumberInput.tsx` and `apps/web/src/components/ui/index.ts` identical pre/post. `uiPrimitives.test.tsx` byte-unchanged and passing. |
| AC-2 | `designSystem.ts` byte-unchanged (RA-2) | Verification | SHA-256 identical pre/post; still exactly **28** exported constants; `designSystem.test.ts` byte-unchanged and passing, including its `MONO_VALUE_CLASS === 'font-mono tabular-nums tracking-tight'` pin. |
| AC-3 | Zero raw `<input>` in `YeastSection.tsx` | Source sweep (`YeastSection.test.tsx`) | `/<input[\s>]/g` matches **0** (down from 1). |
| AC-4 | Exactly 1 `<NumberInput>` in `YeastSection.tsx` | Source sweep | `/<NumberInput[\s>]/g` matches exactly **1**. |
| AC-5 | Y-1 passes `type="number"` (RA-5) | Source sweep + rendered | The `<NumberInput` tag contains `type="number"` before its close. Rendered with one yeast, `getByLabelText('<name> attenuation %').getAttribute('type') === 'number'` and `getAllByRole('spinbutton')` has length **1**; with two yeasts, length **2**. |
| AC-6 | `min`/`max` preserved, `step` absent (RA-6, RA-7) | Rendered | The attenuation input has `min="50"` and `max="98"`, and `hasAttribute('step') === false`. |
| AC-7 | No `className` on the migrated call site (RA-4) | Source sweep | The `<NumberInput …>` tag in `YeastSection.tsx` does not contain `className`. |
| AC-8 | Unused base-token import removed (§2.4) | Source sweep + lint | `YeastSection.tsx` does not import `INPUT_COMPACT_CLASS`; it still imports `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem` (required by `accessibilityAndPolish.test.tsx` AC-1..AC-5); `npm run lint` reports no new unused-import warning. |
| AC-9 | Exact rendered width, alignment and size band (§2.2) | Rendered | The attenuation input has `w-16` (**not** `w-full`), `text-right`, and the compact band's `px-2.5`, `py-1`, `text-xs`, `bg-slate-800`, `rounded`; and does **not** have `h-10`, `rounded-lg`, `px-3` or `text-sm`. |
| AC-10 | Y-1 carries `MONO_VALUE_CLASS` in full | Rendered | The attenuation input has all three of `font-mono`, `tabular-nums`, **`tracking-tight`**. This is the assertion that fails against pre-phase source, where `tracking-tight` is absent. |
| AC-11 | Attenuation editing — lockstep with `onUpdate` (§2.1) | Rendered | `fireEvent.change` with `'80'` on `<name> attenuation %` fires `onUpdate` **exactly once** with an array where that yeast's `attenuationPct === 80` and every other field (`id`, `name`, `laboratory`, `type`, `form`, `amountPkg`) is identical. With two yeasts present, the sibling row's object is unmutated. |
| AC-12 | Degenerate parse and clamp behaviour preserved verbatim (RA-8) | Rendered | `'abc'` → `attenuationPct === 75` (the `\|\| 75` fallback). **`'0'` → `75`, not `0`** — the falsy-zero quirk is preserved; this is the assertion that catches a `?? 75` or `\|\| 0` "cleanup". `'150'` → `100` (`Math.min` clamp). `'-5'` → `0` (`Math.max` clamp). `'98'` → `98`. |
| AC-13 | Native `min`/`max` are advisory only, and stay disagreeing with the clamp (RA-6) | Rendered | Programmatically changing the value to `'20'` (below `min="50"`) still yields `attenuationPct === 20` — the handler's 0–100 clamp governs, the native attributes do not. Neither the attributes nor the clamp changed. |
| AC-14 | Degenerate: empty yeast list (RA-16) | Rendered | With `yeasts={[]}`: exactly one `colSpan={6}` empty-state row containing `No yeast added yet. Select a yeast strain below.`, and `queryAllByRole('spinbutton')` has length **0**. The Add Yeast `<select>` still renders and still resolves by `Select Yeast Strain`. |
| AC-15 | `YeastSection.tsx` out-of-scope elements untouched (RA-15) | Source sweep | Still exactly **1** `<select` and **2** `<button` occurrences; **0** `addonRight` occurrences; all **6** `scope="col"` occurrences retained; the `<thead>`/`<tr>`/`<th>` block is byte-unchanged. |
| AC-16 | `MashSection.tsx` has zero inputs, before and after (roadmap correction) | Source sweep (`MashSection.test.tsx`) | `/<input[\s>]/g` matches **0** and `/<NumberInput[\s>]/g` matches **0**. This pins the grounded finding that supersedes the roadmap's P3 bullet. |
| AC-17 | MS-1/MS-2 hero tiles carry `MONO_VALUE_CLASS` without duplication (§2.3) | Rendered | The strike-water value and `mash-strike-temperature-value` each have `font-mono`, `tabular-nums` and `tracking-tight`; each retains `text-xl` and `font-extrabold`; and each element's `className` contains `tracking-tight` **exactly once**. |
| AC-18 | MS-3/MS-4 inline readbacks carry `MONO_VALUE_CLASS` (RA-10) | Rendered | `getByTestId('mash-sparge-temperature-value')` and `getByTestId('mash-target-ph-value')` each resolve to exactly one element, each has `font-mono tabular-nums tracking-tight` and retains `text-slate-200`, and each still renders its pre-phase text content unchanged. |
| AC-19 | MS-5..MS-8 mash-step numeric cells carry `MONO_VALUE_CLASS` (§2.3) | Rendered | In `mash-plan-step-{position}` for a profile with ≥1 step, cells 3, 4, 5 and 6 each have `font-mono`, `tabular-nums`, `tracking-tight`, and each retains `text-right`. |
| AC-20 | MS-9..MS-11 fermentation-step numeric cells carry `MONO_VALUE_CLASS` (§2.3) | Rendered | In `fermentation-plan-step-{i}` for a profile with ≥1 step, cells 3, 4 and 5 each have `font-mono`, `tabular-nums`, `tracking-tight`, and each retains `text-right`. |
| AC-21 | Non-numeric cells deliberately excluded (RA-14) | Rendered | In both step tables, cell 1 (Step name) and cell 2 (Type) have **none** of `font-mono`, `tabular-nums`, `tracking-tight`. Cell 1 still has `font-medium text-slate-100`; cell 2 still has `text-slate-400`. |
| AC-22 | Prose warnings byte-identical (RA-12) | Source sweep | `MashSection.tsx` still contains the exact literals `bg-amber-950/50 border border-amber-800 rounded-lg p-2.5 mb-3 flex items-start gap-2 text-xs text-amber-300` and `text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2 flex items-start gap-1.5`, neither extended with `MONO_VALUE_CLASS`. |
| AC-23 | `MashSection.tsx` render tree gains no new element (RA-9) | Source sweep | Occurrence counts are **unchanged** from pre-phase for each of `<div`, `<span`, `<strong`, `<table`, `<thead`, `<tbody`, `<tr`, `<th`, `<td`, `<select`, `<option`. `data-testid` occurrences increase by exactly **2** (from 10 to 12), and the two new values are exactly `mash-sparge-temperature-value` and `mash-target-ph-value`. |
| AC-24 | `MashSection.tsx` table markup untouched (RA-13, RA-14) | Source sweep | Still **0** `scope="col"` occurrences (deliberately not added — RA-13); no local `TH_CLASS`/`TD_CLASS`/`TABLE_CLASS` constant is introduced; both `<thead>` blocks and every `<th>` className are byte-unchanged. |
| AC-25 | All 18 pre-existing `MashSection.test.tsx` tests pass unmodified (RA-16) | Existing test | Every pre-existing `it()` block in `MashSection.test.tsx` retains its assertions byte-unchanged and passes — including the °F/°C conversion suites, the `us`/`metric` volume pins (`4.09 gal`, `2.11 gal`, `6.21 gal`, `0.53 gal`, `15.5 L`, `8.0 L`, `23.5 L`, `2.0 L`), the water-balance `getByText` at line 357, the no-profile/no-steps branches, and the `fmt`-identifier-gone check. The file is **extended only**. |
| AC-26 | M14 guarantees pass unmodified | Existing test | `accessibilityAndPolish.test.tsx` is **byte-unchanged** and passes in full: AC-1..AC-5's `CARD_CLASS`/`SECTION_HEADING_CLASS` import assertions for `YeastSection.tsx` **and** `MashSection.tsx`; AC-6's `YeastSection sets scope="col" on all <th> elements`; AC-9's `Saflager W-34/70 attenuation %` accessible name and the remove button's `p-2`. |
| AC-27 | App-wide residue pin reconciliation (§2.4) | Existing test, reconciled | `FermentableSection.test.tsx`'s residue block asserts `compactCount` **1** (was 2), `inputClassCount` **16** (unchanged), `compactTextRightCount` **0** (unchanged), and passes. Exactly one literal in that file changed. |
| AC-28 | `ScopeGuardrail.test.tsx` and `designTokens.test.ts` byte-unchanged | Verification | SHA-256 of both identical pre/post — the first M32 phase requiring **no** edit to either. `ScopeGuardrail.test.tsx` AC-15's map still equals its 7-entry, 10-total breakdown with no Yeast/Mash key; `designTokens.test.ts` AC-15(b) still asserts **6** and AC-15(c)'s array is still the three entries `['App.tsx', 'components/HopSection.tsx', 'components/RecipeLibrary.tsx']`. Both pass. |
| AC-29 | Cross-file consumers unaffected | Existing tests | `App.test.tsx`, `BatchDetail.test.tsx`, `StatsHeader.test.tsx`, `HopSection.test.tsx`, `MiscSection.test.tsx`, `BatchRecipeAdjustModal.test.tsx` and `calculatorImportGraph.test.ts` pass **byte-unchanged**. `FermentableSection.test.tsx` passes with only AC-27's single literal changed. |
| AC-30 | `YeastSection.test.tsx` created (RA-17) | Verification | `apps/web/test/YeastSection.test.tsx` exists, did not exist pre-phase, and is the only file created by this phase. It does not duplicate or relocate `accessibilityAndPolish.test.tsx`'s AC-6/AC-9 yeast assertions, which remain in that byte-frozen file. |
| AC-31 | Test-count monotonicity and four Layer 1 gates | Layer 1 | All four commands in §4.1 exit 0. Total passing ≥ the M32_P2 closing baseline of **2159 passed / 2 skipped**, across **121** test files (120 + the new `YeastSection.test.tsx`), with **no previously-passing test removed, renamed away, or `.skip`ped**. Lint shows exactly the 4 pre-existing `only-export-components` warnings and 0 new. |
| AC-32 | **Scope guardrail — SHA-256 content manifest** | Verification | See §4.2. Exactly the 4 authorized-to-modify paths show changed hashes, exactly 1 file is created, zero files deleted. **The pre-edit manifest must have been captured before the first source edit** — see §4.2's binding process note. |

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

Expected: `npm test` exit 0 with ≥ 2159 passed / 2 skipped across 121 files; `npm run typecheck` exit 0 across 4/4 workspaces; `npm run build` exit 0; `npm run lint` exit 0 with exactly the 4 known pre-existing `only-export-components` warnings.

### 4.2 AC-32 — Scope guardrail (SHA-256 content manifest)

**BINDING PROCESS NOTE — carried forward from M32_P1's Layer 2 critic finding, complied with in M32_P2, and binding again here.** In M32_P1 the executor began editing before scripting the pre-snapshot, leaving that phase's scope AC PARTIAL on method. M32_P2 complied and passed it cleanly. **Capturing the pre-edit manifest is therefore the literal first action of `/execute` for this phase** — before reading a source file for edit, before the first `Edit`/`Write`, before anything else. An executor that reports a post-hoc reconstruction instead of a genuine pre-snapshot has failed AC-32 on method regardless of the outcome.

**`git diff --name-only` is NOT used and must not be substituted.** This repo has 2 commits against a large pre-existing uncommitted tree — `apps/web` is almost entirely untracked or staged-new against them — so a diff-based criterion cannot distinguish this phase's changes from the pre-existing dirty tree and is unfalsifiable here. Same reasoning M30_P1 established and M31_P4 / M32_P1 / M32_P2 recorded.

**Step 1 — before the first edit**, from the repo root:

```bash
git ls-files -co --exclude-standard -z | xargs -0 sha256sum > "$TMPDIR/M32_P3_manifest_pre.txt"
```

**Step 2 — after the last edit**, the same command to `M32_P3_manifest_post.txt`, then diff the two manifests.

The manifest diff must show changed hashes for **exactly these 4 paths and no others**:

1. `apps/web/src/components/YeastSection.tsx`
2. `apps/web/src/components/MashSection.tsx`
3. `apps/web/test/MashSection.test.tsx`
4. `apps/web/test/FermentableSection.test.tsx`

And exactly **one** new source path added:

5. `apps/web/test/YeastSection.test.tsx`

Plus, as the only other permitted **additions** to the manifest: `.gsd/` bookkeeping (`STATE.json`, `FEATURES.md`, `ROADMAP.md`, archive logs, this spec) and, if captured, `.gsd/active/manual_verification/M32_P3_*.png`. **Zero files deleted.**

### 4.3 Forbidden paths (explicitly OUT of scope — must be byte-identical)

- `apps/web/src/components/ui/NumberInput.tsx` — **RA-2. The API is settled; needing to change it is a `/diagnose` signal, not an edit.**
- `apps/web/src/components/ui/index.ts` — RA-2
- `apps/web/src/components/ui/FormField.tsx`, `Input.tsx`, `Select.tsx`, `Button.tsx`
- `apps/web/test/uiPrimitives.test.tsx` — AC-1 is only meaningful if this file is unmodified
- `apps/web/src/components/designSystem.ts` — **RA-2. The single highest-blast-radius file in this initiative.**
- `apps/web/test/designSystem.test.ts`
- `apps/web/test/accessibilityAndPolish.test.tsx` — **AC-26 is only meaningful if this file is unmodified. Its AC-6/AC-9 yeast assertions are not to be moved into the new suite (RA-17).**
- `apps/web/test/ScopeGuardrail.test.tsx` — **AC-28. Deliberately NOT edited: both files already count 0 unnamed controls.**
- `apps/web/test/designTokens.test.ts` — **AC-28. Deliberately NOT edited: both files have 0 `focus:outline-none` occurrences.**
- `apps/web/src/components/HopSection.tsx` — Milestone 32 **P1**, delivered
- `apps/web/src/components/FermentableSection.tsx`, `MiscSection.tsx` — Milestone 32 **P2**, delivered
- `apps/web/src/App.tsx` — Milestone 32 **P4** (its 1 raw numeric input and the scale surface are P4's, not this phase's)
- `apps/web/src/components/StatsHeader.tsx` — Milestone 32 **P4**. **This phase must not pre-empt P4's entered-vs-readback typography assertion.**
- `apps/web/src/components/BrewDayTracker.tsx` — Milestone 33 (owns the last `${INPUT_COMPACT_CLASS} font-mono tabular-nums` occurrence)
- `apps/web/src/components/BatchRecipeAdjustModal.tsx` and its test
- `apps/web/test/HopSection.test.tsx`, `MiscSection.test.tsx`, `StatsHeader.test.tsx`, `App.test.tsx`, `BatchDetail.test.tsx`
- `packages/**`, `apps/api/**`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `apps/web/src/index.css`
- `.gsd/ROADMAP.md` — already refreshed at this `/plan`; the executor changes no phase count

### 4.4 Manual verification (best-effort)

If browser automation is available, capture `.gsd/active/manual_verification/M32_P3_yeast_mash_numbers.png` — the recipe designer showing the Yeast Strain & Fermentation card (at least one yeast row, so the migrated attenuation input is visible) and the Mash Profile card with a step-bearing profile attached (so the strike-water and strike-temperature tiles and at least one mash-step row are visible), demonstrating that the typed number and the read-back numbers now share one typeface. If unavailable, report it as outstanding evidence for `/steer`'s critic (the M30_P1 / M31_P4 / M32_P1 / M32_P2 precedent), rather than silently omitting it.

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
