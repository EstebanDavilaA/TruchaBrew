# FEATURE SPECIFICATION: M35_P1 — `Table`, Proven on `BrewSheet.tsx`

> **Milestone 35:** "Consistency that holds without anyone policing it." (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 1 of 4.** Adds `Table` / `TableHeaderCell` / `TableCell` to `components/ui/`, adds the three table tokens to `designSystem.ts`, and migrates `BrewSheet.tsx`'s six tables onto the primitive — retiring the local `TH_CLASS` / `TD_CLASS` / `TABLE_CLASS` constants that have been invisible to every guardrail this project owns.

---

## Phase Summary

`apps/web/src` renders **16** `<table>` elements across 10 files, in five distinct hand-rolled typographies. Six of those sixteen live in `BrewSheet.tsx`, styled by three constants declared locally at `BrewSheet.tsx:10-12`:

```
TH_CLASS    = 'text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold py-1.5 px-2'
TD_CLASS    = 'text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums'
TABLE_CLASS = 'w-full border-collapse'
```

These are exactly the failure this milestone exists to correct. `designTokens.test.ts`'s AC-12 guardrail — "no local button/input/select class-string constant survives outside `designSystem.ts`" — tests the regex `/^\s*(export\s+)?const\s+[A-Z_]*(BUTTON|INPUT|SELECT)[A-Z_]*_CLASS\s*=/m`. `TH_CLASS`, `TD_CLASS` and `TABLE_CLASS` pass that guardrail not because they are compliant but because the regex was never written to see them. `designTokens.test.ts`'s AC-22 (no file re-declares a name `designSystem.ts` exports) misses them for the same reason: `designSystem.ts` has never exported a table token, so there is nothing to collide with.

Phase 1 closes that hole for the six call sites it can reach, and establishes the primitive the remaining ten migrate onto in P2. It deliberately does **not** rewrite the shared guardrail — Milestone 35 Phase 4 is reserved for that, alone, precisely so a guardrail rewrite never shares a change with a migration.

**Why this satisfies vertical-slice constraints (Hard Rule 2):** the primitive ships with its first real consumer in the same change. A brewer opening the Brew Sheet on a batch sees six ingredient tables that are demonstrably one component rendering one typography, and the constants that made them a private dialect are gone from the file rather than merely renamed.

---

### Key Behaviors

1. `designSystem.ts` gains three exports — `TABLE_CLASS`, `TABLE_HEADER_CELL_CLASS`, `TABLE_CELL_CLASS` — carrying **byte-identical** strings to `BrewSheet.tsx`'s retired locals. No visual change is introduced by this phase.
2. `components/ui/Table.tsx` exports three thin wrappers over native elements: `Table` (renders the horizontal-scroll container **and** the `<table>`), `TableHeaderCell` (`<th>`, defaulting `scope="col"`), and `TableCell` (`<td>`).
3. `components/ui/index.ts` re-exports all three components and their prop types alongside the existing five primitives.
4. `BrewSheet.tsx`'s six tables render through `<Table>`; its 34 `<th>` render through `<TableHeaderCell>`; its 35 `<td>` (34 body cells plus `EmptyRow`'s) render through `<TableCell>`. The three local constants and the six hand-written `<div className="overflow-x-auto">` wrappers are deleted.
5. `BrewSheet.tsx`'s two remaining raw `<button>` elements migrate onto `<Button variant="secondary" size="sm">` (RA-7).
6. `BrewSheet.test.tsx` passes **completely unmodified** — including its AC-20 assertion that every table's rendered `className` is exactly `'w-full border-collapse'` and its direct parent is a `<div>` carrying `overflow-x-auto`. That file being byte-identical before and after is this phase's primary regression evidence.

---

## Resolved Ambiguities (Binding)

**RA-1 — The three table tokens go in `designSystem.ts`, not inside `Table.tsx`.**
`designSystem.ts` is otherwise a forbidden path this phase (see §4); this is the one explicitly justified exception. Every existing primitive composes canonical tokens rather than declaring its own (`Button` → `BUTTON_*_CLASS`; `Input`/`NumberInput` → `INPUT_CLASS`/`INPUT_COMPACT_CLASS`; `Select` → `FORM_SELECT_*_CLASS`), and M30_P3's AC-16 established that no `*_CLASS` constant may be declared inside `components/ui/`. Declaring the table strings inside `Table.tsx` would recreate the exact local-constant pattern this phase exists to retire, one directory over. Placing them in `designSystem.ts` additionally brings them under `designTokens.test.ts` AC-22's re-declaration guard for the first time.

**RA-2 — Token names are spelled out, not abbreviated.**
`TABLE_CLASS`, `TABLE_HEADER_CELL_CLASS`, `TABLE_CELL_CLASS` — **not** `TH_CLASS` / `TD_CLASS`. Two-letter names are inconsistent with the file's convention (`FORM_SELECT_COMPACT_CLASS`, `STATUS_BADGE_WRAPPER_CLASS`) and are too short for AC-22's re-declaration guard to be meaningful. `TABLE_CLASS` keeps its name because it is already correct.

**RA-3 — Values are byte-identical to the retired locals. This phase changes zero pixels.**
The three token strings are copied verbatim from `BrewSheet.tsx:10-12`. Any improvement to table typography (density, mobile card-collapse, `thead` treatment) is out of scope and belongs to P2 or to BUG-030's own scheduling. A phase that both moves a string and edits it cannot prove which of the two caused a visual diff.

**RA-4 — Component set: three thin wrappers; `<thead>`, `<tbody>` and `<tr>` stay native.**
`BrewSheet.tsx` applies no class to `<thead>`, `<tbody>` or `<tr>`, so wrapping them this phase would ship exports with no consumers — the precise `BUTTON_ICON_CLASS` failure mode this initiative was chartered to end, and something P4's planned "consumers > 0" assertion would immediately flag. P2's tables *do* style `<thead>`; that is where a `TableHead` wrapper earns its existence, if it earns it at all.

**RA-5 — The API is compositional, not data-driven.**
`<Table>` takes `children`, not `columns`/`rows` arrays. Every other primitive in `components/ui/` is a thin wrapper that spreads native attributes, and the ten P2 call sites are structurally heterogeneous (nested inputs, action buttons, colgroups, per-row testids). A data-driven table API settled now, on six uniform call sites, would be re-litigated in P2.

**RA-6 — No `size` / `density` / `variant` axis in this phase.**
`TableProps` exposes no styling axis beyond `className`. The `text-sm`-versus-`text-xs` split that would justify a size axis exists only in the ten P2 call sites; growing the axis there, where call sites prove it, follows the precedent M32_P1 set when `NumberInput` grew its `width` axis. This is binding: an unused `size` prop shipped in P1 is a spec violation, not a head start.

**RA-7 — `BrewSheet.tsx`'s two raw buttons migrate in this phase. This is a deliberate deviation from the roadmap bullet.**
The roadmap's P1 bullet names tables only. `BrewSheet.tsx` also carries two raw `<button>` elements (`brew-sheet-toggle` at line 37, `brew-sheet-print-btn` at line 56), both using `${BUTTON_SECONDARY_CLASS} text-xs flex items-center gap-1.5` — verbatim the string M33 retired onto `<Button variant="secondary" size="sm">` across five files. `BrewSheet.tsx` was never in M33's or M34's file lists, so they survived. They are exactly what P4's adoption guardrail is built to fail on, in a file this phase already has open. Migrating them costs two lines and reuses a settled substitution; leaving them means P4 must reopen this file to fix something P1 walked past.
*If the reviewer prefers strict roadmap fidelity, this is the single item to strike — AC-21 and its share of AC-22 come out and nothing else in the spec changes.*

**RA-8 — `TableHeaderCell` defaults `scope="col"`, overridable per call site.**
`BrewSheet.tsx`'s 34 `<th>` carry no `scope` today, which is a real accessibility gap. `accessibilityAndPolish.test.tsx` AC-6 asserts `scope === 'col'` on the recipe-section tables only (Fermentable/Hop/Yeast — all P2 files) and no test anywhere asserts its *absence*, so the default is purely additive. Defaulting it here means M14's `scope="col"` guarantee survives P2's migrations by construction rather than by each call site remembering. A caller may pass `scope="row"` or `scope={undefined}` explicitly.

**RA-9 — `Table` owns the `overflow-x-auto` scroll container.**
`<Table>` renders `<div className="overflow-x-auto"><table className={…}>{children}</table></div>`. `BrewSheet.tsx`'s six hand-written wrapper `<div>`s are deleted, not nested. This is what makes `BrewSheet.test.tsx`'s AC-20 (Amendment 2) — direct parent is a `<div>` containing `overflow-x-auto`, and `table.className === 'w-full border-collapse'` — pass unmodified. The wrapper's class string is fixed; no `wrapperClassName` prop is introduced (RA-6's reasoning).

**RA-10 — Class merge order is token-first, `className`-last, joined with a single space.**
`[TOKEN, className].filter(Boolean).join(' ')`, matching every existing primitive. Consequences, both binding and both directly asserted:
- `<Table>` with no `className` renders **exactly** `w-full border-collapse` (not `w-full border-collapse ` with a trailing space, not a re-ordered string). `BrewSheet.tsx` passes no `className` to any `<Table>`.
- `EmptyRow`'s `<TableCell className="text-slate-400 italic">` renders **exactly** `${TABLE_CELL_CLASS} text-slate-400 italic`, byte-identical to today's template literal at `BrewSheet.tsx:17`.

**RA-11 — Adoption is asserted in `uiPrimitives.test.tsx`; `designTokens.test.ts` is touched only for AC-7's lockstep.**
M33/M34 precedent: `designTokens.test.ts` AC-13 was drained to zero rows and full adoption moved to `uiPrimitives.test.tsx`. AC-13 stays at zero rows. The only `designTokens.test.ts` edit permitted this phase is AC-7's key list and length (28 → 31, RA-12).

**RA-12 — AC-7's key count moves 28 → 31 in the same change that adds the tokens.**
`designTokens.test.ts` AC-7 pins `Object.keys(designSystem)` to length 28 against an exact sorted list. Adding three exports without updating it turns the suite red. Both the length and the list are updated in lockstep, and the three new tokens additionally get exact-value pins in `designSystem.test.ts` (which asserts values per-token and carries no exhaustive length check, so it fails only if a pin is wrong). *Note for P4: the roadmap described this as a "26-key list"; it is 28 today, corrected in `.gsd/ROADMAP.md` at this `/plan`.*

**RA-13 — No new occurrence-count pins.** M35_P4's charter is to *retire* the AC-18..AC-21 count pins in favour of refactor-surviving invariants. This phase adds none: every new assertion is adoption-shaped ("zero raw `<th>` in `BrewSheet.tsx`") or exact-value-shaped ("this token equals this string"), never "this literal appears N times". AC-7's key count is an existing pin being kept correct, not a new one.

**RA-14 — Roadmap corrections made at this `/plan` (counts only; no scope decisions changed).**
Verified against source, corrected in `.gsd/ROADMAP.md`, and flagged here for sign-off:

| Roadmap claim | Verified actual | Action |
|---|---|---|
| P1: "first six call sites" in `BrewSheet.tsx` | **6** `<table>` elements (lines 174, 206, 240, 276, 310, 345) | **Correct as written** — no change |
| `TH_CLASS`/`TD_CLASS`/`TABLE_CLASS` are "local" | **Correct** — declared at `BrewSheet.tsx:10-12`; absent from `designSystem.ts` | **Correct as written** — no change |
| Milestone: "the 17 tables" | **16** `<table>` elements across 10 files | corrected 17 → 16 |
| P2: "the remaining 11 tables" | **10** (16 − BrewSheet's 6) | corrected 11 → 10 |
| Hardening: "the 11 hand-rolled variants (four named strings)" | The four named strings cover only **9** of the 10; a fifth unnamed variant, `w-full text-left text-xs` (`MashSection.tsx`), is the tenth | fifth variant named in the bullet |
| P4: "AC-7's 26-key list" | **28** keys | corrected 26 → 28, with a note that P1 raises it to 31 |
| P1: "~3 files" | 1 created + 6 modified (3 source, 3 test) | restated as "~6 files (1 created, 3 source, 3 test) — the original counted source only" |

P2/P3/P4 splits, the milestone's hardening scope and its verification threshold are **unchanged**. The "Estimated phases: 4" line stands, now annotated "P1 specced 2026-08-27".

**RA-15 — Scope-guardrail method: SHA-256 content manifest, not `git diff`.**
`git diff --name-only` against a base commit is **not viable in this repository** and must not be specified: `git rev-list --count HEAD` is **2**, and `git status --porcelain` reports **167** already-dirty paths, none of which this phase authored. A diff against either commit would return a file list dominated by pre-existing working-tree state, making the criterion unfalsifiable. The binding method is §5's SHA-256 manifest.

---

## Logged Items (status noted; **no log file is edited this phase**)

| Item | Status | Relationship to this phase |
|---|---|---|
| **BUG-030** — Batch Detail Workbench / Brew Day Stepper / Mobile Telemetry Refactor | `OPEN` | Its Expected Behavior §3 asks for "`BrewSheet.tsx` tables to use the design system `<Table>` primitive with horizontal scrolling **or** responsive card-list transformation". P1 delivers the primitive adoption and preserves horizontal scrolling; it delivers **none** of the responsive card-collapse, the 12-column workbench grid (§1), the stepper (§2), or the touch ergonomics (§4). **Stays OPEN.** |
| **FEAT-026** — Recipe Designer … Sub-Section Table Architecture Refactor | `OPEN` (partially advanced by M32) | Its §2 first bullet (`<Table>` primitive for `MiscSection`/hop/malt sections) is **P2** work, not P1. Untouched. |
| **FEAT-027** — Water Chemistry Modal … Table Alignment Refactor | `OPEN` | "Refactor the mineral table to use design system `<Table>` primitives" is **P2** work (`WaterCalculatorModal.tsx`). Untouched. |
| **BUG-040** / **FEAT-005** — Design System Unification / App-Wide UI Redesign | `IN_PLANNING` / `LOGGED` | Multi-milestone umbrella items. Advanced, not closed. |

---

## 1. Data Schema & Contracts

### 1.1 New tokens (`apps/web/src/components/designSystem.ts`)

Appended as a new section; **no existing token is modified, reordered, or removed.**

```ts
// ---------------------------------------------------------------------------
// Tables (M35_P1)
// ---------------------------------------------------------------------------

export const TABLE_CLASS = 'w-full border-collapse';

export const TABLE_HEADER_CELL_CLASS =
  'text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold py-1.5 px-2';

export const TABLE_CELL_CLASS =
  'text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums';
```

Post-change export count: **31** (28 existing + 3).

### 1.2 New primitive (`apps/web/src/components/ui/Table.tsx`)

```tsx
import type { TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, ReactNode } from 'react';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children?: ReactNode;
}

export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export function Table(props: TableProps): JSX.Element;
export function TableHeaderCell(props: TableHeaderCellProps): JSX.Element;
export function TableCell(props: TableCellProps): JSX.Element;
```

Rendering contracts, binding:

| Component | Renders | Class expression | Attribute defaults |
|---|---|---|---|
| `Table` | `<div className="overflow-x-auto"><table …>{children}</table></div>` | `[TABLE_CLASS, className].filter(Boolean).join(' ')` on the `<table>`; the wrapper's class is the fixed literal `overflow-x-auto` | none; all spread props land on `<table>`, never on the wrapper |
| `TableHeaderCell` | `<th …>{children}</th>` | `[TABLE_HEADER_CELL_CLASS, className].filter(Boolean).join(' ')` | `scope="col"`, overridable by an explicit `scope` prop |
| `TableCell` | `<td …>{children}</td>` | `[TABLE_CELL_CLASS, className].filter(Boolean).join(' ')` | none — no `scope` is emitted |

- Zero local `*_CLASS` constants inside `Table.tsx`; all three strings are imported from `../designSystem`.
- Zero external class-merging dependencies (`clsx`, `tailwind-merge`, `cva`) — M30_P3 RA-2 stands.
- `<thead>`, `<tbody>` and `<tr>` are **not** wrapped (RA-4).

### 1.3 Barrel export (`apps/web/src/components/ui/index.ts`)

Adds, leaving the five existing export blocks untouched:

```ts
export { Table, TableHeaderCell, TableCell } from './Table';
export type { TableProps, TableHeaderCellProps, TableCellProps } from './Table';
```

### 1.4 Symbol inventory

**Created:** `Table`, `TableHeaderCell`, `TableCell`, `TableProps`, `TableHeaderCellProps`, `TableCellProps`, `TABLE_CLASS`, `TABLE_HEADER_CELL_CLASS`, `TABLE_CELL_CLASS`.
**Deleted:** `BrewSheet.tsx`'s local `TH_CLASS`, `TD_CLASS`, `TABLE_CLASS`.
**Modified (signature-preserving):** `BrewSheet`'s and `EmptyRow`'s bodies. `BrewSheetProps` (`{ model: BrewSheetModel }`) and `EmptyRow`'s `{ colSpan: number }` are **unchanged** — `pages/BatchDetail.tsx`'s `<BrewSheet model={brewSheetModel} />` call site requires zero edits and is not an authorized file.
**Explicitly untouched:** all 28 existing `designSystem.ts` tokens; `Button`, `Input`, `Select`, `NumberInput`, `FormField` and their props; `BrewSheetModel` and everything in `@truchabrew/calculations`.

---

## 2. Transformations & Integration Contracts

### 2.1 Pure rendering contracts (`Table.tsx`)

All three components are pure: props in, element out. No state, no effects, no context, no refs, no side effects at module scope.

**Degenerate inputs, binding:**
- `<Table />` and `<Table>{null}</Table>` render the wrapper `<div>` and an empty `<table>` and must not throw. An empty table is a legal DOM state; the primitive does not substitute a placeholder, an empty-state card, or `null` for it. Empty-state rows remain the **caller's** concern — `BrewSheet.tsx`'s `EmptyRow` keeps owning its own "None" row exactly as it does today.
- `<TableCell />` / `<TableHeaderCell />` with no children render an empty cell, not a fallback dash or `&nbsp;`.
- `className={undefined}` and `className=""` both yield the bare token string with no trailing whitespace (`.filter(Boolean)` is what guarantees this — a naive template literal does not, and would break `BrewSheet.test.tsx` AC-20's exact `toBe` comparison).

### 2.2 Stateful integration contract (`BrewSheet.tsx`)

`BrewSheet` keeps its single piece of state — `const [isOpen, setIsOpen] = useState(false)` — with identical semantics: component-local, ephemeral, never persisted, never touching `formData` (M18_P1 Ambiguity 9). This phase moves markup only; no state, prop, handler or model access path changes.

Per-table transformation, applied identically six times:

```
BEFORE:  <div className="overflow-x-auto">
           <table className={TABLE_CLASS}>
             <thead><tr><th className={TH_CLASS}>…</th> …</tr></thead>
             <tbody>… <tr key={…} data-testid={…}><td className={TD_CLASS}>…</td> …</tr> …</tbody>
           </table>
         </div>

AFTER:   <Table>
           <thead><tr><TableHeaderCell>…</TableHeaderCell> …</tr></thead>
           <tbody>… <tr key={…} data-testid={…}><TableCell>…</TableCell> …</tr> …</tbody>
         </Table>
```

Preserved without exception: every `key`, every `data-testid` on every `<tr>`, every `colSpan`, every cell's rendered text and its `.toFixed(n)` precision, the `.length === 0 ? <EmptyRow …/> : rows.map(…)` branch in all six tables, and the per-table column counts **5 / 5 / 7 / 5 / 6 / 6** (mash rests, fermentables, hops, miscs, yeasts, fermentation steps).

`EmptyRow` becomes `<tr><TableCell colSpan={colSpan} className="text-slate-400 italic">None</TableCell></tr>` — same `<tr>`, same `colSpan` prop threading, same literal text `None`.

### 2.3 Button integration (RA-7)

```
BEFORE:  <button type="button" data-testid="brew-sheet-toggle" aria-expanded={isOpen}
                 onClick={…} className={`${BUTTON_SECONDARY_CLASS} text-xs flex items-center gap-1.5`}>
AFTER:   <Button variant="secondary" size="sm" data-testid="brew-sheet-toggle"
                 aria-expanded={isOpen} onClick={…}>
```

`Button` spreads all remaining props onto the `<button>` and already defaults `type="button"`, so `data-testid`, `aria-expanded`, `onClick` and `type` all survive — which is why `BrewSheet.test.tsx`'s AC-22 (`getByTestId('brew-sheet-toggle')`, `aria-expanded`) and AC-25 (`getByTestId('brew-sheet-print-btn')`, `window.print` called once per click) pass unmodified. The `Printer` / `ChevronDown` / `ChevronUp` icon children and the `w-3.5 h-3.5` sizing on them are unchanged; `Button`'s own `gap-1.5` layout class replaces the hand-written `flex items-center gap-1.5`.

### 2.4 Refactoring & legacy cleanup — what must be *purged*, not merely bypassed

Leaving any of these behind is a phase failure even if every other AC is green:

1. The three `const` declarations at `BrewSheet.tsx:10-12`. Deleted outright — **no deprecated aliases, no re-export shim, no `/** @deprecated */` retention**. There is exactly one consumer file and it is migrated in the same change; an alias would preserve the very indirection this milestone exists to remove, and would additionally trip `designTokens.test.ts` AC-22 the moment `designSystem.ts` exports the same names.
2. All six `<div className="overflow-x-auto">` wrappers in `BrewSheet.tsx`. `Table` owns the container now; a retained wrapper would nest two identical scroll containers.
3. `BrewSheet.tsx`'s now-unused `BUTTON_SECONDARY_CLASS` import (RA-7 removes its last use). The remaining `designSystem` imports — `CARD_CLASS`, `SECTION_HEADING_CLASS`, `SUBSECTION_HEADING_CLASS`, `SUBPANEL_CLASS`, `METADATA_TEXT_CLASS` — **stay**; they are still used by the header, the stat grids and the sub-panels, and removing them is out of scope.
4. No `<table>`, `<th>` or `<td>` literal may remain anywhere in `BrewSheet.tsx`.

---

## 3. Acceptance Criteria & Test Matrix (31 ACs)

### Primitive — unit

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | Barrel exports the new symbols | Unit | `components/ui/index.ts` exports `Table`, `TableHeaderCell`, `TableCell` and types `TableProps`, `TableHeaderCellProps`, `TableCellProps`, **alongside** the existing `FormField`, `Input`, `Select`, `Button`, `NumberInput` and their types (existing exports asserted still present). |
| **AC-2** | `<Table>` structure and class | Unit | Renders a `<div>` whose `className` contains `overflow-x-auto`, containing a `<table>` whose `className` is **exactly** `w-full border-collapse` (`toBe`, not `toContain`). |
| **AC-3** | `<Table className>` merge order | Unit | `<Table className="mt-2">` → table `className` is exactly `w-full border-collapse mt-2` (token first, single space, no trailing space). |
| **AC-4** | `<Table>` prop pass-through targets the `<table>` | Unit | `<Table data-testid="t" aria-label="Hops">` → the `<table>` element carries both attributes; the wrapper `<div>` carries neither. |
| **AC-5** | `<TableHeaderCell>` default | Unit | Renders `<th>` with `className` exactly `text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold py-1.5 px-2` and `scope="col"`. |
| **AC-6** | `scope` is overridable | Unit | `<TableHeaderCell scope="row">` → `scope="row"` (exactly one `scope` attribute, value `row`). |
| **AC-7** | `<TableCell>` default | Unit | Renders `<td>` with `className` exactly `text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums` and **no** `scope` attribute. |
| **AC-8** | `<TableCell>` merge + `colSpan` | Unit | `<TableCell colSpan={5} className="text-slate-400 italic">` → `colspan="5"` and `className` exactly `<TABLE_CELL_CLASS> text-slate-400 italic` — byte-identical to the pre-migration `BrewSheet.tsx:17` literal. |
| **AC-9** | Degenerate / empty inputs | Unit | `<Table />`, `<Table>{null}</Table>`, `<TableCell />`, `<TableHeaderCell />` each render without throwing; the empty `<Table>` still emits wrapper + `<table>`; no placeholder text, dash or `&nbsp;` is substituted for empty children. |
| **AC-10** | `className=""` / `undefined` yield a bare token | Unit | Both cases render the token string with **no** trailing or doubled whitespace (`toBe` comparison). |
| **AC-11** | No local class constants, no external merge deps | Static | `Table.tsx` matches `/const\s+[A-Z_]+_CLASS\s*=/` **zero** times, imports all three tokens from `../designSystem`, and imports no `clsx` / `tailwind-merge` / `cva`. |
| **AC-12** | No styling axis shipped unused (RA-6) | Static | `Table.tsx`'s prop interfaces declare no `size`, `density`, `variant`, or `wrapperClassName` member; `TableProps` adds only `children` beyond `TableHTMLAttributes<HTMLTableElement>`. |

### Tokens

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-13** | Three tokens exported with byte-identical values | Unit | `designSystem.test.ts` pins `TABLE_CLASS`, `TABLE_HEADER_CELL_CLASS`, `TABLE_CELL_CLASS` to the exact strings in §1.1 — each verified equal to the string previously at `BrewSheet.tsx:12`, `:10`, `:11` respectively. |
| **AC-14** | AC-7 key list updated in lockstep | Unit | `designTokens.test.ts` AC-7 asserts `Object.keys(designSystem)` has length **31** and equals the sorted 31-name list; suite green. |
| **AC-15** | No existing token disturbed | Unit | All 28 pre-existing `designSystem.test.ts` value pins pass **unmodified**; no existing token's value, name or ordering changed. |
| **AC-16** | Re-declaration guard now covers tables | Unit | `designTokens.test.ts` AC-22 green — zero files outside `designSystem.ts` declare `TABLE_CLASS`, `TABLE_HEADER_CELL_CLASS` or `TABLE_CELL_CLASS`. (This assertion was structurally incapable of catching `BrewSheet.tsx` before this phase.) |

### `BrewSheet.tsx` integration

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-17** | Local constants purged | Static | `BrewSheet.tsx` matches `/const\s+(TH_CLASS\|TD_CLASS\|TABLE_CLASS)\s*=/` zero times; no deprecated alias, re-export or commented-out retention of any of the three. |
| **AC-18** | Raw table elements purged | Static | `BrewSheet.tsx` contains zero `<table`, `<th` and `<td` literals; it imports `Table`, `TableHeaderCell`, `TableCell` from `./ui`. |
| **AC-19** | Scroll wrappers purged | Static | The literal `overflow-x-auto` appears **zero** times in `BrewSheet.tsx` (ownership moved to `Table`), while every rendered table still has a direct `<div>` parent carrying it. |
| **AC-20** | Six tables, unchanged shape | Integration | Rendering `<BrewSheet>` with a populated model and opening it yields exactly **6** `<table>` elements; per-table column counts are 5 / 5 / 7 / 5 / 6 / 6; all `<tr>` `data-testid` values (`brew-sheet-mash-rest-*`, `-fermentable-*`, `-hop-*`, `-misc-*`, `-yeast-*`, `-fermentation-*`) still resolve. |
| **AC-21** | Column headers are scoped | Integration | The opened Brew Sheet exposes **34** elements with role `columnheader`, every one carrying `scope="col"`. |
| **AC-22** | Degenerate model / empty collections | Integration | With an empty model, all six sections still render their `EmptyRow`: exactly 6 cells reading `None`, each with `className` exactly `<TABLE_CELL_CLASS> text-slate-400 italic` and `colSpan` 5 / 5 / 7 / 5 / 6 / 6 respectively. Fallback rows are the caller's, never leaked from the primitive (§2.1). |
| **AC-23** | Raw buttons migrated (RA-7) | Static + Integration | `BrewSheet.tsx` contains zero raw `<button` literals; both controls render via `<Button variant="secondary" size="sm">`; `brew-sheet-toggle` still exposes `aria-expanded` reflecting `isOpen` and `brew-sheet-print-btn` still calls `window.print` once per click; the unused `BUTTON_SECONDARY_CLASS` import is removed. |
| **AC-24** | Adoption block added to `uiPrimitives.test.tsx` | Unit | A new `M35_P1` describe block carries the AC-17 / AC-18 / AC-19 / AC-23 source sweeps, following the M33/M34 adoption-assertion pattern. `designTokens.test.ts` AC-13 stays at **0** rows (RA-11). |

### Invariants, scope and gates

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-25** | `BrewSheet.test.tsx` passes byte-identical | Verification | `apps/web/test/BrewSheet.test.tsx`'s SHA-256 is **unchanged** between the pre-edit and post-edit manifests, and its full suite is green — specifically AC-20 (6 tables, parent `<div>` has `overflow-x-auto`, `table.className === 'w-full border-collapse'`), AC-22, AC-23, AC-24 and AC-25. This is the phase's primary regression evidence; editing this file to make it pass is a phase failure. |
| **AC-26** | The shared guardrail is **not** rewritten (P4's charter) | Verification | `designTokens.test.ts` AC-12's `BUTTON\|INPUT\|SELECT` regex is unchanged; AC-18..AC-21's count pins are unchanged; `ScopeGuardrail.test.tsx` and `accessibilityAndPolish.test.tsx` are byte-identical (SHA-256 unchanged). The AC-12 blind spot is documented, not patched, in this phase. |
| **AC-27** | No new occurrence-count pins (RA-13) | Verification | No assertion added by this phase is of the form "literal X appears exactly N times". AC-14's key count is an update to an existing pin, not a new one. |
| **AC-28** | Zero new dependencies | Guardrail | `package.json` and `package-lock.json` SHA-256 unchanged. |
| **AC-29** | **Scope Guardrail** — authorized files only | Verification | Per §5's SHA-256 pre/post content-manifest diff (**not** `git diff --name-only`, which is unusable here — RA-15): exactly **1 created** (`ui/Table.tsx`), **6 modified** (`ui/index.ts`, `designSystem.ts`, `BrewSheet.tsx`, `uiPrimitives.test.tsx`, `designTokens.test.ts`, `designSystem.test.ts`), **0 deleted**, plus framework files (`.gsd/active/M35_P1_feature_spec.md`, `.gsd/STATE.json`). Every §4 forbidden path — including all nine other table-bearing source files, all five existing `components/ui/` primitives, `Modal.tsx`, `BrewSheet.test.tsx`, `ScopeGuardrail.test.tsx`, `accessibilityAndPolish.test.tsx` — has an **identical** hash in both manifests. |
| **AC-30** | Layer 1 gate: tests | Verification | `npm test` exit 0 across all workspaces; total passing count ≥ the 2,206 baseline recorded at M34_P5. |
| **AC-31** | Layer 1 gates: typecheck, build, lint | Verification | `npm run typecheck` exit 0 (4/4 packages), `npm run build` exit 0, `npm run lint` exit 0 (0 errors; the 4 known pre-existing fast-refresh warnings are permitted, no new warning introduced). |

> A manual-verification screenshot of the opened Brew Sheet (all six tables) is captured to `.gsd/active/manual_verification/M35_P1_brew_sheet_tables.png` and referenced at `/steer`. It is evidence for Milestone 35's screenshot-walk threshold, not a Layer 1 gate, and the executor must state plainly if it was not captured rather than reporting a file that does not exist.

---

## 4. Authorized Files

### Created (1)
| Path |
|---|
| `apps/web/src/components/ui/Table.tsx` |

### Modified (6)
| Path | Permitted change |
|---|---|
| `apps/web/src/components/ui/index.ts` | Add the two new export lines from §1.3. Existing blocks untouched. |
| `apps/web/src/components/designSystem.ts` | **Append only** the three tokens of §1.1 in a new "Tables (M35_P1)" section. No existing token modified, reordered or removed. |
| `apps/web/src/components/BrewSheet.tsx` | §2.2 / §2.3 / §2.4 exactly. |
| `apps/web/test/uiPrimitives.test.tsx` | Add the `M35_P1` describe block (AC-1..AC-12, AC-17..AC-24). Existing blocks untouched. |
| `apps/web/test/designTokens.test.ts` | **AC-7's key list and length only** (28 → 31). Nothing else in this file. |
| `apps/web/test/designSystem.test.ts` | Add the three exact-value pins of AC-13. Existing pins untouched. |

### Forbidden — must be byte-identical in the post-edit manifest
- `apps/web/test/BrewSheet.test.tsx` — **the load-bearing one.** Its passing unmodified is AC-25.
- `apps/web/test/ScopeGuardrail.test.tsx`, `apps/web/test/accessibilityAndPolish.test.tsx` — M23/M25/M31 cross-file sweeps; P4's territory.
- `apps/web/src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `NumberInput.tsx`, `FormField.tsx` — consumed, never edited.
- `apps/web/src/components/Modal.tsx` and every dialog — M34 is closed.
- The nine other table-bearing files, reserved for P2: `FermentableSection.tsx`, `HopSection.tsx`, `MashSection.tsx`, `MiscSection.tsx`, `YeastSection.tsx`, `PostBrewCalibrationModal.tsx`, `ReadingLog.tsx`, `StockCheckPanel.tsx`, `WaterCalculatorModal.tsx`.
- `apps/web/src/pages/BatchDetail.tsx` — the only `BrewSheet` consumer; its call site needs no edit (§1.4).
- `package.json`, `package-lock.json`, any config or build file.
- `.gsd/ROADMAP.md` (already corrected at `/plan` per RA-14 — the executor does not touch it), `.gsd/BUGS.md`, `.gsd/FEATURES.md`, `.gsd/HARD_RULES.md`, `CLAUDE.md`, `.claude/`, `.agents/`.
- Anything under `apps/api/` or `packages/`.

**On discovering unlisted work:** if migrating `BrewSheet.tsx` turns out to require editing a file not listed above, **stop and report** rather than expanding scope. That is a spec defect routed through `/diagnose`, not an executor judgment call.

---

## 5. Scope-Guardrail Methodology (binding)

`git diff --name-only` against a base commit is **not usable in this repository** — 2 commits total, 167 already-dirty paths (RA-15). The binding method is a content manifest:

1. **The literal first action of `/execute`, before any file is created or edited**, capture the pre-edit manifest:
   ```
   git ls-files -co --exclude-standard -z | xargs -0 sha256sum > <scratch>/M35_P1_pre.sha256
   ```
2. Build the phase.
3. After the last edit and before reporting Layer 1, capture the post-edit manifest the same way into `<scratch>/M35_P1_post.sha256`.
4. Diff the two. The set of differing paths must equal exactly the §4 authorized set plus the framework files named in AC-29 — no more, no fewer. Report created / modified / deleted counts explicitly.

If step 1 was missed, say so and re-run the phase from a clean state rather than reconstructing a manifest after the fact — a manifest captured mid-edit proves nothing.

---

## 6. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL `SPEC_APPROVED` IS RECEIVED.**

Review this feature specification. Reply with **SPEC_APPROVED** to begin execution.
