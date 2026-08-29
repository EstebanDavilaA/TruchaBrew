# FEATURE SPECIFICATION: M35_P2 — The Remaining 10 Tables

> **Milestone 35:** "Consistency that holds without anyone policing it." (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 2 of 4.** Migrates the **10 remaining `<table>` elements across 9 files** onto the `Table` / `TableHeaderCell` / `TableCell` primitive M35_P1 shipped, collapsing five hand-rolled typographies onto one. Grows `TableCell` the `size` and `variant` axes P1's RA-6 explicitly deferred to "the phase where call sites prove it."

---

## Phase Summary

M35_P1 shipped the primitive and proved it on `BrewSheet.tsx`'s six tables. A fresh `<table>` sweep of `apps/web/src` at this `/plan` finds **11** raw `<table>` literals: one inside `components/ui/Table.tsx` (the primitive itself) and **10 across 9 component files**:

| # | File | Table | Current `<table>` class |
|---|---|---|---|
| 1 | `FermentableSection.tsx` | Fermentables | `w-full text-left text-sm text-slate-300` |
| 2 | `HopSection.tsx` | Hop schedule | `w-full text-left text-sm text-slate-300` |
| 3 | `MiscSection.tsx` | Misc & water agents | `w-full text-left text-sm text-slate-300` |
| 4 | `YeastSection.tsx` | Yeast | `w-full text-left text-sm text-slate-300` |
| 5 | `MashSection.tsx` | Mash steps | `w-full text-left text-xs text-slate-300` |
| 6 | `MashSection.tsx` | Fermentation schedule | `w-full text-left text-xs text-slate-300` |
| 7 | `ReadingLog.tsx` | Readings | `w-full text-sm` |
| 8 | `StockCheckPanel.tsx` | Stock checkoff | `w-full text-sm` |
| 9 | `PostBrewCalibrationModal.tsx` | Metric comparison | `w-full text-left text-xs` |
| 10 | `WaterCalculatorModal.tsx` | Minerals | `w-full text-left text-xs border-collapse` |

Across those 10 tables: **58 `<th>`** and **75 `<td>`** source sites. **34 of the 58 `<th>` carry no `scope` attribute at all** — `MashSection` (11), `MiscSection` (7), `ReadingLog` (7), `WaterCalculatorModal` (5), `StockCheckPanel` (4). M14's `scope="col"` guarantee, asserted by `accessibilityAndPolish.test.tsx` AC-6, reaches only `FermentableSection` / `HopSection` / `YeastSection`; `PostBrewCalibrationModal` has it by luck of authorship, nothing asserts it.

**The material difference from P1:** P1's RA-3 promised "this phase changes zero pixels" because it moved byte-identical strings. **P2 cannot make that promise and does not.** Ten tables currently render in five typographies, three paddings, two header-styling *locations* (`<thead>` vs `<tr>`), and two row-separator mechanisms. Collapsing them onto one token family is a **deliberate, user-visible visual unification** — which is precisely this milestone's chartered user-visible outcome ("the 16 tables that currently render in five-plus different typographies"). **RA-2 is the sign-off item.**

**Why this satisfies vertical-slice constraints (Hard Rule 2):** a brewer moving between the Recipe Designer, the fermentation reading log, the stock checkoff, the post-brew calibration dialog and the water-chemistry modal sees one table, five times, instead of five tables that happen to hold data. Nothing is left half-migrated behind a flag.

---

### Key Behaviors

1. All 10 tables render through `<Table>`; all 58 `<th>` through `<TableHeaderCell>`; all 75 `<td>` through `<TableCell>`.
2. `TableCell` grows two axes — `size` (`'sm' | 'md'`, default `'md'`) and `variant` (`'numeric' | 'text'`, default `'numeric'`) — backed by **three new `designSystem.ts` tokens**. The default pair (`md` + `numeric`) resolves to today's `TABLE_CELL_CLASS`, **byte-identically**, so `BrewSheet.tsx` (a forbidden path) renders unchanged without being reopened.
3. `Table` and `TableHeaderCell` gain **no** new props. The header token already unifies every header treatment in the set.
4. All 34 `<th>` currently missing `scope="col"` gain it **by construction**, not by each call site remembering — RA-8's stated purpose in P1, now realised.
5. Every hand-written `<div className="overflow-x-auto">` directly wrapping a migrated table is deleted; `Table` owns the scroll container.
6. `accessibilityAndPolish.test.tsx` passes **byte-identical and green** — this phase's primary regression evidence, exactly as `BrewSheet.test.tsx` was P1's.

---

## Resolved Ambiguities (Binding)

**RA-1 — Roadmap corrections made at this `/plan` (one factual attribution error; counts verified correct).**

| Roadmap claim | Verified actual | Action |
|---|---|---|
| P2: "the remaining 10 tables" | **10** raw `<table>` outside `ui/Table.tsx` | **Correct as written** — no change |
| Milestone: "16 tables across 10 files" | 6 (now migrated, in `BrewSheet.tsx`) + 10 = **16**, across 10 files | **Correct as written** — no change |
| "a fifth unnamed variant, `w-full text-left text-xs` (**`MashSection.tsx`**)" | That string is **`PostBrewCalibrationModal.tsx`**. `MashSection.tsx`'s two tables are the `w-full text-left text-xs text-slate-300` ×2 variant already named separately | **corrected** — file attribution fixed in the bullet |
| P2: "~6–8 files, each a shallow edit" | **9 source files** + ~6 test files. Shallow in `YeastSection`/`StockCheckPanel`; **not** shallow in `WaterCalculatorModal` (`<colgroup>`, an interactive `<th>` housing a checkbox) or `ReadingLog` (a `colSpan={7}` inline-edit row) | **corrected** — count and the "shallow" characterisation |
| P2 is a like-for-like move | It is a **visual unification** (RA-2) | **corrected** — bullet now says so and points at RA-2 |

P3 (`Badge`) and P4 (guardrail rewrite) splits, the milestone's hardening scope and its verification threshold are **unchanged**. "Estimated phases: 4" stands, now annotated "P2 specced 2026-08-28".

---

**RA-2 — ⚠️ THE SIGN-OFF ITEM. The typography collapse is a deliberate visual unification, binding, and it changes pixels on all 10 tables.**

Five typographies collapse onto one token family. Concretely, **every migrated body cell adopts**:

| Property | Unified value (from `TABLE_CELL_*`) | What it replaces |
|---|---|---|
| Padding | `py-1.5 px-2` | `py-2.5 px-3` (4 recipe sections, `PostBrewCalibrationModal`), `px-4 py-2` (`ReadingLog`), `py-3 pr-3` / `pl-3` (`StockCheckPanel`), `py-2` / `py-1.5 px-2` (`WaterCalculatorModal`) |
| Text colour | `text-slate-200` | per-cell `text-slate-100` / `text-slate-300` / `text-slate-400` overrides |
| Row separator | `border-t border-slate-800` on every cell | `<tbody className="divide-y divide-slate-800">`, and `WaterCalculatorModal`'s per-row `border-b border-slate-800/60 last:border-0` |
| Font size | `text-sm` (`size="md"`) or `text-xs` (`size="sm"`) | the five table-level sizes |
| Font family | `font-mono tabular-nums` (`variant="numeric"`) or none (`variant="text"`) | ad-hoc `${MONO_VALUE_CLASS}` on some cells, nothing on others |

**And every migrated header cell adopts** `text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold py-1.5 px-2`, replacing `text-xs`/`text-[11px]` sizes, `font-medium`/`font-semibold` weights, and `py-2 px-3`/`py-2.5 px-3`/`py-2 pr-2` paddings.

Two user-visible consequences are **accepted, not accidental**, and are called out here so a reviewer rejects them now rather than at `/steer`:
- **The four recipe-section tables get denser** (`py-2.5 px-3` → `py-1.5 px-2`). This is directionally what BUG-030 §3 and FEAT-026 §2 ask for (tables overflowing their container on narrow viewports).
- **A horizontal rule appears between the header row and the first body row** on tables that previously used `divide-y` (which skips the first child). This matches `BrewSheet.tsx`'s existing rendering.

Two things are explicitly **out of scope** and must not be attempted: responsive card-collapse on mobile (BUG-030 §3, FEAT-026 §2) and any retuning of `WaterCalculatorModal`'s `<colgroup>` percentages (FEAT-027 §3; M34_P3 already tuned them and the M34_P3 critic entry documents the current 20/14/27/27/12).

*If the reviewer rejects the unification, the correct response is to reject this spec at the halt gate, not to soften it during execution — a per-file token set would need ~8 more tokens and would defeat the milestone's stated outcome.*

---

**RA-3 — `className` is NOT an override mechanism for any property the token already sets. This is a Tailwind CSS-order trap, and it is binding.**

`TableCell` merges `[TOKEN, className].filter(Boolean).join(' ')` (P1 RA-10). **Class-attribute order does not determine which utility wins** — CSS source order does, and Tailwind emits utilities in its own generated order. So appending `font-sans` after the token's `font-mono` does **not** reliably yield a sans-serif cell, and appending `text-slate-100` after the token's `text-slate-200` reliably **loses** (Tailwind emits `slate-100` before `slate-200`).

Binding rules:
- The executor **must not** attempt to vary font-family, font-size, text colour, cell padding, or the top border by passing `className`. Those five families are settled by the `size`/`variant` axes and by RA-2's unification. Any `className` string containing a `font-mono`/`font-sans`, `text-xs`/`text-sm`/`text-base`, `text-slate-*`/`text-white`, `p*-`/`px-`/`py-`, or `border-t*` utility on a `TableCell` or `TableHeaderCell` is a spec violation.
- **Safe passthrough** (no counterpart in the tokens, no conflict): `text-right`, `text-center`, `align-top`, `whitespace-nowrap`, `italic`, `w-*`, and — on `TableCell` only — `font-medium` / `font-semibold` (the cell tokens set no font-weight; the header token does, so weight is *not* safe on `TableHeaderCell`).
- **Semantic colour that carries meaning** (the emerald/rose variance figures in `PostBrewCalibrationModal`, the amber `% Grain Bill` in `FermentableSection`, the muted `—` placeholders in `MashSection`) is preserved by moving the colour onto an **inner `<span>`**, which is already `PostBrewCalibrationModal`'s own pattern. It is never passed through `className`.

---

**RA-4 — Three new tokens, composed from a non-exported base so `TABLE_CELL_CLASS` stays byte-identical.**

`designSystem.ts` gains a **module-private** (not exported) base string and **three new exports**:

- `TABLE_CELL_TEXT_CLASS` — `md` + text
- `TABLE_CELL_SM_CLASS` — `sm` + numeric
- `TABLE_CELL_SM_TEXT_CLASS` — `sm` + text

`TABLE_CELL_CLASS` is **redefined as a composition** of the private base but its **value is unchanged, byte for byte**. `designSystem.test.ts`'s existing exact-value pin on it must pass **unmodified** — that pin is the proof the refactor changed nothing. Composition (rather than four hand-written strings) follows `designSystem.ts`'s own precedent (`METRIC_TILE_CLASS = SUBPANEL_CLASS`, `LOADING_STATE_CLASS = EMPTY_STATE_CLASS`). The base is not exported, so `designTokens.test.ts` AC-7's `Object.keys` sweep sees exactly +3.

`designSystem.ts` is otherwise a forbidden path; this is the one justified exception, on P1 RA-1's precedent (no `*_CLASS` constant may be declared inside `components/ui/`, per M30_P3 AC-16).

---

**RA-5 — The axes live on `TableCell` as explicit props. No React context, no `TableHead`/`TableRow`/`TableBody` wrappers.**

`size` could have been declared once on `<Table>` and read by cells through context. It is not. Context makes `<TableCell>` silently dependent on an ancestor, breaks it in isolation, and is exactly the kind of implicit mechanism this project's critic has repeatedly flagged. Explicit per-cell props are verbose (~32 `size="sm"` occurrences across the four `sm` tables) and correct; P1 RA-5's "compositional, not data-driven" holds.

Likewise **no `TableHead` wrapper is introduced**, resolving the question P1's RA-4 left open ("P2's tables *do* style `<thead>`; that is where a `TableHead` wrapper earns its existence, **if it earns it at all**"). It does not: the `<thead>` classes that survive migration are per-table *chrome*, not typography — `bg-slate-800/80 border-b border-slate-700` (recipe sections), `bg-slate-950/90 border-b border-slate-800` (`PostBrewCalibrationModal`), none (`ReadingLog`, `StockCheckPanel`, `WaterCalculatorModal`). A wrapper over that would need a `className` passthrough and would unify nothing. `<thead>`, `<tbody>` and `<tr>` stay native (P1 RA-4 continues).

---

**RA-6 — `TableCell`'s defaults are chosen to leave `BrewSheet.tsx` untouched.**

Default `size="md"` + `variant="numeric"` resolves to `TABLE_CELL_CLASS` exactly. `BrewSheet.tsx` passes neither prop, is a **forbidden path** this phase, and must render byte-identically without being edited. This is why the default is `numeric` even though `text` is the more common P2 case: the alternative would silently restyle six already-signed-off tables.

---

**RA-7 — `TableHeaderCell` is not modified, and P1's `scope` wording defect (M35_P1 critic Finding 3) is corrected here, in the spec, not in the code.**

P1's RA-8 said "a caller may pass `scope="row"` or `scope={undefined}` explicitly." The second half is unimplementable: `scope` is a JS **default parameter**, and default parameters fire on `undefined`, so `scope={undefined}` yields `scope="col"` — not an absent attribute. The corrected, binding contract:

> `TableHeaderCell` renders `scope="col"` unless the caller passes a different non-`undefined` string. **There is no supported way to render a `<th>` with no `scope` attribute.** Passing `scope={undefined}` yields `scope="col"`.

**No P2 call site needs an absent `scope`** — all 58 `<th>` in the set are genuine column headers. Therefore **`Table.tsx`'s `TableHeaderCell` requires no change**, and no prop-presence detection is added. AC-7 asserts the corrected contract directly so the ambiguity cannot survive into P4.

---

**RA-8 — Retroactive `scope="col"` on all 34 currently-missing `<th>` is in scope and is delivered by construction.**

Migrating a `<th>` to `<TableHeaderCell>` adds `scope="col"` automatically. This is purely additive (no test anywhere asserts a *missing* `scope`), fixes a real accessibility gap in five files, and is the realisation of P1 RA-8's justification. It is **not** treated as out-of-scope creep: it is an unavoidable consequence of the migration the roadmap asks for, and refusing it would mean passing an explicit override to suppress a correct default.

---

**RA-9 — Header typography moves off `<thead>` and off `<tr>` and onto the cells; per-table chrome stays.**

Three files style headers on the `<thead>`, three on the header `<tr>`. Both locations lose their *typography* classes (size, colour, weight, `uppercase`, `text-left`) to `TABLE_HEADER_CELL_CLASS`, and keep only background and border:
- recipe sections: `<thead className="bg-slate-800/80 text-xs text-slate-400 uppercase border-b border-slate-700">` → `<thead className="bg-slate-800/80 border-b border-slate-700">`
- `ReadingLog` / `StockCheckPanel`: `<tr className="text-left text-xs …uppercase border-b border-slate-800">` → `<tr className="border-b border-slate-800">`
- `WaterCalculatorModal`: `<tr className="border-b border-slate-700 text-slate-400">` → `<tr className="border-b border-slate-700">`

---

**RA-10 — `divide-y` is removed wherever every cell in that `<tbody>` is a `<TableCell>`.**

`TABLE_CELL_*` all carry `border-t border-slate-800`. Leaving `<tbody className="divide-y divide-slate-800">` in place would double the separator on rows 2..n. Binding: remove the `divide-y divide-slate-800` pair; **keep** any other `<tbody>` class (`bg-slate-950/40` in `PostBrewCalibrationModal`). `WaterCalculatorModal`'s per-row `border-b border-slate-800/60 last:border-0` is removed for the same reason. Row *hover* classes (`hover:bg-slate-800/40 transition-colors`) and `data-testid` attributes on `<tr>` are **preserved verbatim**.

---

**RA-11 — Embedded interactive content is preserved verbatim; no control is re-migrated in this phase.**

Cells hosting `<NumberInput>`, `<Select>`, `<Button>` keep those children exactly as they are — M32/M33/M34 already migrated them and their `width`/`size`/`align` props are pinned by other specs' ACs. **Under no circumstances is any `width=` or `size=` prop on an embedded control changed** (this is the exact drift class that broke M35_P1's Layer 3; see §6).

The one interactive **header** cell — `WaterCalculatorModal.tsx`'s Sparge column `<th>`, which houses a `<label>` wrapping a raw `<input type="checkbox">` — migrates to `<TableHeaderCell>` with its children unchanged. The checkbox is **not** migrated onto a `ui/` primitive: no `Checkbox` primitive exists, creating one is P4/M36 territory, and M34_P4's RA-5 set the precedent (a raw `<textarea>` was left in place for want of a primitive).

`WaterCalculatorModal.tsx`'s `<colgroup>`/`<col>` block passes through `<Table>` as children, **verbatim, percentages untouched**.

---

**RA-12 — Scroll wrappers: delete the `overflow-x-auto` div, preserve any other class it carried on a plain div.**

`Table` owns `<div className="overflow-x-auto">` (P1 RA-9). Four wrappers carry an extra margin class (`overflow-x-auto mb-4` ×3, `overflow-x-auto mb-3` ×1). Binding: the wrapper is replaced by `<div className="mb-4">` (resp. `mb-3`) wrapping `<Table>` — the margin is **not** merged into `Table`'s `className` (that would put it on the `<table>`, not the scroll box, changing layout). Wrappers carrying *only* `overflow-x-auto` are deleted outright.

`PostBrewCalibrationModal`'s structure is `<div class="{SUBPANEL_CLASS} !p-0 overflow-hidden"><div class="overflow-x-auto"><table>`. The **inner** div is deleted (Table supplies it); the **outer** div is untouched. This is load-bearing: `PostBrewCalibrationModal.test.tsx:70-80` asserts exactly that two-level nesting and must pass **unmodified**.

---

**RA-13 — Per-cell `variant` assignment is specified here, not left to the executor's taste.** See §2.2. The rule that generated it: `variant="numeric"` where the cell's primary content is a number, measurement, or numeric input; `variant="text"` for names, types, labels, statuses, comments, action controls, and all `colSpan` empty-state / edit rows.

---

**RA-14 — `uiPrimitives.test.tsx`'s M35_P1 AC-12 assertion is SUPERSEDED and converted, never deleted.**

`uiPrimitives.test.tsx` (M35_P1 block, `AC-11, AC-12: static checks on Table.tsx`) currently asserts `TABLE_SRC` matches **no** `size?:`, `density?:`, or `variant?:` declaration, and that `TableProps`' body is exactly `children?: ReactNode;`. **Adding the axes turns this test red.** That is expected and correct: P1's RA-6 wrote that guard specifically to prevent an *unused* axis shipping early, and stated the axis grows "there, where call sites prove it."

Binding handling, following the "convert to an adoption assertion, don't just delete" discipline used in every phase since M30:
- The `density?:` and `wrapperClassName?:` prohibitions **remain** (still unproven, still unwanted).
- The `TableProps` body assertion **remains** (`Table` itself gains nothing).
- The blanket `size?:` / `variant?:` prohibitions are **replaced** by a stronger assertion: the two axes exist on `TableCellProps` with the exact declared unions, **and each of the four `size`×`variant` combinations has at least one real consumer among the 9 migrated files** — a consumers>0 check in the spirit of what M35_P4 will generalise.
- The test's describe-block title is updated to record the supersession.

---

**RA-15 — M35_P1 critic Finding 6 is closed: this phase's structural claims are automated, not left to source trace.**

The M35_P1 critic verified per-table column counts, `columnheader` totals and `scope="col"` coverage **by hand**, noting the guarantee "would not survive a careless P2 edit" and recommending the sweep be automated in P2. AC-22 and AC-23 do exactly that, as **rendered-DOM** assertions across all 10 tables. Per P1's RA-13 these are structural/integration-shaped, not source-literal occurrence counts, so they do not add to the pin debt M35_P4 is chartered to retire.

Additionally, the stale test title at `designTokens.test.ts:33` ("has length 28", body asserts 31 — M35_P1 critic Finding 5) is corrected to 34 in the same edit that raises the count, since this phase touches that exact block.

---

**RA-16 — Scope-guardrail method: SHA-256 content manifest, not `git diff`.**

Re-verified at this `/plan`, not inherited on faith: `git rev-list --count HEAD` is **2**, and `git status --porcelain` reports **167** already-dirty paths, none authored by this phase. `git diff --name-only` against either commit returns a list dominated by pre-existing working-tree state, making any criterion built on it unfalsifiable. The binding method is §5's SHA-256 manifest. **AC-29 is written against that manifest and must not be restated in terms of `git diff`.**

---

## Pre-Flight Findings (drift re-verification)

M35_P1's `/steer` found out-of-band drift in `HopSection.tsx`, `MiscSection.tsx`, `WaterCalculatorModal.tsx` and `HopSection.test.tsx` — 10 reverted width/size values from the closed M32_P1 / M32_P2 / M34_P3 specs — and repaired it before closing. Three of those files are P2 targets, so their current state was re-verified at this `/plan` **before** any migration plan was grounded against them:

- `HopSection.tsx` — `width` props read `md, sm, sm, xs, xs, md, md`; the M32_P1-pinned `xs` dry-hop pair and `sm` whirlpool value are intact.
- `MiscSection.tsx` — both M-1/M-2 `width="md"` values intact (M32_P2).
- `WaterCalculatorModal.tsx` — salt-dose `width="lg"` ×2 and pH/acid-dose `width="md"` ×4 intact (M34_P3), matching `FermentableSection.test.tsx` AC-3's pin of exactly 2 `width="lg"`.
- Full suite re-run at this `/plan`: **exit 0 — 438 api + 1,184 web + 602 calculations = 2,224 passed / 2 skipped across 121 files**, identical to the baseline M35_P1 closed on.

**No new drift found.** The tree is clean and this spec is grounded against a stable target.

---

## Logged Items (status noted; **no log file is edited this phase**)

| Item | Status | Relationship to this phase |
|---|---|---|
| **BUG-030** | `OPEN` | §3's `<Table>`-primitive ask was `BrewSheet.tsx`-scoped and closed by P1. This phase delivers **none** of §3's responsive card-collapse, nor §1/§2/§4. Its "enforce `MONO_VALUE_CLASS` on live metrics" is *partially* advanced — cells get `font-mono tabular-nums` via `variant="numeric"`, but **not** `tracking-tight`. **Stays OPEN.** |
| **FEAT-026** | `IN_PLANNING` | §2 bullet 1 ("replace manual table layout in `MiscSection.tsx` and hop/malt sections with standardized `<Table>` primitives") is **delivered in full** by this phase for `MiscSection`/`HopSection`/`FermentableSection`/`YeastSection` — **except** the "responsive horizontal scroll **or** compact card collapse on mobile" clause, of which only horizontal scroll ships. §1 (TopBar) and §3 (metadata grid) untouched. **Stays OPEN**, materially advanced. |
| **FEAT-027** | `LOGGED` | §3 bullet 1 ("refactor the mineral table to use design system `<Table>` component primitives") is **delivered in full**. §3 bullet 2 (`addonRight` unit addons) was already delivered by M34_P3. §1, §2, §4 untouched; the `<colgroup>` is explicitly not retuned (RA-2). **Stays OPEN**, materially advanced. |
| **BUG-040** / **FEAT-005** | `IN_PLANNING` / `LOGGED` | Multi-milestone umbrellas. Advanced, not closed. |

---

## 1. Data Schema & Contracts

### 1.1 `apps/web/src/components/designSystem.ts`

Appended to the existing `// Tables (M35_P1)` section. **No existing token is modified in value, reordered, or removed.**

```ts
// module-private — NOT exported; invisible to designTokens.test.ts AC-7
const TABLE_CELL_BASE_CLASS = 'text-slate-200 py-1.5 px-2 border-t border-slate-800';

// Redefined as a composition; VALUE IS UNCHANGED, byte for byte.
export const TABLE_CELL_CLASS: string;          // `text-sm ${BASE} font-mono tabular-nums`
export const TABLE_CELL_TEXT_CLASS: string;     // `text-sm ${BASE}`
export const TABLE_CELL_SM_CLASS: string;       // `text-xs ${BASE} font-mono tabular-nums`
export const TABLE_CELL_SM_TEXT_CLASS: string;  // `text-xs ${BASE}`
```

**Exact required values** (asserted by AC-1):

| Token | Value |
|---|---|
| `TABLE_CELL_CLASS` | `text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums` |
| `TABLE_CELL_TEXT_CLASS` | `text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800` |
| `TABLE_CELL_SM_CLASS` | `text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums` |
| `TABLE_CELL_SM_TEXT_CLASS` | `text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800` |

`TABLE_CLASS` and `TABLE_HEADER_CELL_CLASS` are **untouched**.

**Symbol inventory:** exported symbol count `28 → 31` (M35_P1) `→ 34` (this phase). Added: `TABLE_CELL_TEXT_CLASS`, `TABLE_CELL_SM_CLASS`, `TABLE_CELL_SM_TEXT_CLASS`. Removed: none. Renamed: none.

### 1.2 `apps/web/src/components/ui/Table.tsx`

```ts
export type TableCellSize = 'sm' | 'md';
export type TableCellVariant = 'numeric' | 'text';

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  size?: TableCellSize;        // default 'md'
  variant?: TableCellVariant;  // default 'numeric'
}
```

`TableProps` and `TableHeaderCellProps` are **unchanged**. `Table` and `TableHeaderCell` function bodies are **unchanged**.

**Token-selection contract for `TableCell`** (pure, total, no fallback path):

| `size` | `variant` | Token |
|---|---|---|
| `'md'` (default) | `'numeric'` (default) | `TABLE_CELL_CLASS` |
| `'md'` | `'text'` | `TABLE_CELL_TEXT_CLASS` |
| `'sm'` | `'numeric'` | `TABLE_CELL_SM_CLASS` |
| `'sm'` | `'text'` | `TABLE_CELL_SM_TEXT_CLASS` |

The mapping is exhaustive over the two unions — there is **no `default:` branch that silently returns `TABLE_CELL_CLASS` for an unrecognised value**, and no `catch`. An out-of-union value is a typecheck failure, which is the point. Class merge remains `[TOKEN, className].filter(Boolean).join(' ')` (P1 RA-10), unchanged.

### 1.3 `apps/web/src/components/ui/index.ts`

Adds the two new type exports to the existing `Table` line, matching the `ButtonSize` / `NumberInputWidth` precedent:

```ts
export type { TableProps, TableHeaderCellProps, TableCellProps, TableCellSize, TableCellVariant } from './Table';
```

No new value export. The `export { Table, TableHeaderCell, TableCell }` line is unchanged.

---

## 2. Transformations & Integration Contracts

### 2.1 Per-table migration contract

| # | File | `size` | `<th>` | `<td>` sites | Notes |
|---|---|---|---|---|---|
| 1 | `FermentableSection.tsx` | `md` | 7 | 8 | wrapper → `<div className="mb-4">`; empty-state `colSpan={7}` |
| 2 | `HopSection.tsx` | `md` | 7 | 8 | wrapper → `<div className="mb-4">`; empty-state `colSpan={7}`; embedded `Select` + 3 `NumberInput` untouched |
| 3 | `MiscSection.tsx` | `md` | 7 | 8 | wrapper → `<div className="mb-4">`; empty-state `colSpan={7}`; +7 `scope="col"` |
| 4 | `YeastSection.tsx` | `md` | 6 | 7 | wrapper deleted outright; empty-state `colSpan={6}` |
| 5 | `MashSection.tsx` (mash steps) | `sm` | 6 | 6 | wrapper → `<div className="mb-3">`; +6 `scope="col"`; `${MONO_VALUE_CLASS}` removed from cells |
| 6 | `MashSection.tsx` (fermentation) | `sm` | 5 | 5 | wrapper deleted outright; +5 `scope="col"`; `${MONO_VALUE_CLASS}` removed |
| 7 | `ReadingLog.tsx` | `md` | 7 | 8 | +7 `scope="col"`; header styling moves off `<tr>`; edit row `colSpan={7}` |
| 8 | `StockCheckPanel.tsx` | `md` | 4 | 4 | +4 `scope="col"`; `data-testid="stock-check-table"` passes through `<Table>` onto the `<table>` |
| 9 | `PostBrewCalibrationModal.tsx` | `sm` | 4 | 16 | inner wrapper deleted, outer `SUBPANEL_CLASS` div kept (RA-12); `<tbody className="bg-slate-950/40">` retained |
| 10 | `WaterCalculatorModal.tsx` | `sm` | 5 | 5 | `<colgroup>` verbatim; interactive Sparge `<th>` (RA-11); +5 `scope="col"` |
| | **Total** | | **58** | **75** | **+34 `scope="col"`** |

### 2.2 Binding `variant` assignment (RA-13)

`variant="text"` on: `FermentableSection` Name, Type, Action, empty-row · `HopSection` Hop Variety, Use, Action, empty-row · `MiscSection` Name, Type, Use, Unit, Action, empty-row · `YeastSection` Yeast Name, Laboratory, Type, Form, Action, empty-row · `MashSection` (both tables) Step, Type · `ReadingLog` Comment, Actions, edit-row · `StockCheckPanel` Item, Recipe, Stock Status, Action · `PostBrewCalibrationModal` Metric column · `WaterCalculatorModal` Mineral.

`variant="numeric"` on: `FermentableSection` Amount, % Grain Bill, Color, Potential · `HopSection` Schedule, Amount, Alpha Acid, Contribution · `MiscSection` Time, Amount · `YeastSection` Attenuation · `MashSection` Temp, Rest, Infusion, Volume After, Duration, Pressure · `ReadingLog` Time, SG, Temp, pH, Pressure · `PostBrewCalibrationModal` Target Profile, Achieved Real, Variance · `WaterCalculatorModal` Needed, Mash, Sparge, Total.

All four `size`×`variant` combinations therefore have real consumers (AC-11).

### 2.3 Legacy cleanup inventory (things that must be *gone*, not renamed)

- All 10 raw `<table …>` class strings — the five hand-rolled variants.
- All 58 raw `<th …>` and 75 raw `<td …>` literals in the 9 files.
- Header typography classes on 3 `<thead>` and 3 header `<tr>` (RA-9).
- `divide-y divide-slate-800` on the migrated `<tbody>` elements; `WaterCalculatorModal`'s per-row `border-b border-slate-800/60 last:border-0` (RA-10).
- 10 `overflow-x-auto` wrapper divs (RA-12).
- `${MONO_VALUE_CLASS}` template usage inside `MashSection.tsx` **table cells** (its non-table uses, e.g. the `mash-target-ph-value` span at line 111, are **untouched**).
- Per-cell text-colour overrides superseded by the token (RA-2), except semantic colours moved to inner spans (RA-3).
- **No `*_CLASS` local constant exists in any of the 9 target files today** (verified at this `/plan`) — unlike `BrewSheet.tsx` in P1, there is nothing of that class to purge. No deprecated alias, shim, re-export or commented-out retention may be introduced.

### 2.4 Test reconciliation contract

| File | Current pin | Required handling |
|---|---|---|
| `ReadingLog.test.tsx:182` | `expect(table.className).toBe('w-full text-sm')` | **Convert** to `toBe('w-full border-collapse')`. The surrounding AC-20 parent-`overflow-x-auto` assertions (lines 183-185) must be left **unmodified** and must pass. |
| `uiPrimitives.test.tsx` M35_P1 AC-12 | no `size?:` / `variant?:` in `Table.tsx` | **Convert** per RA-14. |
| `designTokens.test.ts` AC-7 | length 31, 31-name list, title says "28" | Length → **34**, +3 names, title corrected to **34**. |
| `designSystem.test.ts` | 31 value pins incl. `TABLE_CELL_CLASS` | **+3** pins. The existing `TABLE_CELL_CLASS` pin must pass **unmodified** (RA-4). |
| `accessibilityAndPolish.test.tsx` AC-6 | Fermentable 7 / Hop 7 / Yeast 6 columnheaders, all `scope="col"` | **Byte-identical, green.** Forbidden path. |
| `PostBrewCalibrationModal.test.tsx:70-80` | inner div `overflow-x-auto`, outer `overflow-hidden`+`rounded-lg` | Passes **unmodified**. |
| `StockCheckPanel.test.tsx:113-116` | `stock-check-table` testid, 4 named columnheaders | Passes **unmodified**. |
| `WaterCalculatorModal.test.tsx:151` | `querySelectorAll('table')` length 1 | Passes **unmodified**. |
| `HopSection.test.tsx` / `MiscSection.test.tsx` / `FermentableSection.test.tsx` | `width=`/`size=` pins on embedded controls | Passes **unmodified** — RA-11 forbids touching those props. |
| `MashSection.test.tsx` AC-19 (`:651-654`), AC-20 (`:680-682`) | `toHaveClass('font-mono', 'tabular-nums', 'tracking-tight', 'text-right')` on 4 mash-step + 3 fermentation-step numeric cells | **Convert** — drop `'tracking-tight'` from all 7 pins, leaving `toHaveClass('font-mono', 'tabular-nums', 'text-right')`. RA-2 binds `variant="numeric"` to `font-mono tabular-nums` **only**; `tracking-tight` arrived from `MONO_VALUE_CLASS`, which §2.3 requires be purged from table cells. Verified rendered value: `text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums text-right`. |
| `MashSection.test.tsx` AC-21 (`:716`, `:723`) | `toHaveClass('font-medium', 'text-slate-100')` on the mash **and** fermentation Step-name cells | **Convert** to `toHaveClass('font-medium', 'text-slate-200')`. `font-medium` is **retained**: the migrated source passes it as an RA-3 safe passthrough (`MashSection.tsx:132`, `:215` — `<TableCell size="sm" variant="text" className="font-medium">`). `text-slate-100` is **retired** by RA-2's text-colour row and may not be reintroduced via `className` (RA-3). Verified rendered value: `text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800 font-medium`. |
| `MashSection.test.tsx` AC-21 (`:718`, `:725`) | `toHaveClass('text-slate-400')` on the mash **and** fermentation Type cells | **Convert** to `toHaveClass('text-slate-200')`. These two assertions do **not** appear in the current 4-failure report only because the `it` aborts at `:716` first — they fail as soon as `:716` is fixed. The migrated Type cells (`MashSection.tsx:133`, `:216`) are `<TableCell size="sm" variant="text">` with **no** `className`, so they render the bare `TABLE_CELL_SM_TEXT_CLASS`; the per-cell `text-slate-400` override is retired by RA-2. |
| `MashSection.test.tsx` `:619`, `:624` | `toHaveClass('font-mono', 'tabular-nums', 'tracking-tight', 'text-slate-200')` on `mash-sparge-temperature-value` / `mash-target-ph-value` | **Unmodified and green.** These are the non-table `MONO_VALUE_CLASS` spans §2.3 explicitly exempts. Removing `tracking-tight` here would be a spec violation. Likewise the `not.toHaveClass` assertions at `:713-715`, `:717`, `:722`, `:724` stay verbatim. |
| `MashSection.test.tsx` AC-24 (`:740-742`) | `expect(MASH_SRC_TEXT.match(/scope="col"/g)).toBeNull()`, titled *"table markup untouched and scope=\"col\" is still 0"* | **Assertion unmodified and green** — it is now the by-construction fact RA-7/RA-8 describe (no literal `scope="col"` in a migrated call site). **Title only** corrected, since "table markup untouched" is false post-migration; same stale-title discipline RA-15 applies to `designTokens.test.ts:33`. No other line in this block changes. |
| `YeastSection.test.tsx` AC-15 (`:80`) | `expect(SRC_TEXT.match(/scope="col"/g)?.length).toBe(6)` — a source-text occurrence count | **Convert** to a rendered-DOM assertion, in place inside the same `it('AC-15: …')` so no AC renumbers. `TableHeaderCell` supplies `scope="col"` by construction (RA-7/RA-8), so the literal never appears in migrated source and `.match()` returns `null` → `?.length` is `undefined`. Required form: render `<YeastSection yeasts={[baseYeast]} onUpdate={vi.fn()} />` (the pattern already at `:86`; `render`/`screen`/`vi` are already imported at `:1-2`), then `screen.getAllByRole('columnheader')` — assert length **6** and that **every** one has `getAttribute('scope') === 'col'`. This mirrors AC-22/AC-23's method for the other 9 tables. The AC-15 assertions at `:77-79` (`<select`, `<button`, `addonRight`) stay **unmodified**. |

---

## 3. Acceptance Criteria & Test Matrix (33 ACs)

| ID | Type | Criterion | Expected outcome |
|---|---|---|---|
| AC-1 | Unit | The four `TABLE_CELL_*` tokens hold exactly the four strings in §1.1 | `designSystem.test.ts` pins all four with `toBe`; the pre-existing `TABLE_CELL_CLASS` pin is unedited and green |
| AC-2 | Unit | `TABLE_CELL_BASE_CLASS` is **not** exported | `Object.keys(designSystem)` does not contain it; length is exactly **34** |
| AC-3 | Unit | `designTokens.test.ts` AC-7 updated in lockstep | Asserts length 34; EXPECTED list holds 34 names incl. the 3 new; block title reads "34", not "28" |
| AC-4 | Unit | `TableCell` token selection is exhaustive and correct over `size`×`variant` | All 4 combinations rendered; each `className` equals the matching token exactly (`toBe`) |
| AC-5 | Unit | Defaults are `size="md"`, `variant="numeric"` | `<TableCell>Ø</TableCell>` renders `className` exactly `TABLE_CELL_CLASS` — proving `BrewSheet.tsx` is unaffected |
| AC-6 | Unit | Merge order is token-first, `className`-last, single space, no trailing space | `<TableCell size="sm" variant="text" className="text-right">` renders exactly `${TABLE_CELL_SM_TEXT_CLASS} text-right`; `className=""` and `className={undefined}` both yield the bare token |
| AC-7 | Unit | `TableHeaderCell`'s corrected `scope` contract (RA-7) | Default renders `scope="col"`; `scope="row"` overrides; **`scope={undefined}` renders `scope="col"`**, asserted explicitly; exactly one `scope` attribute in all three cases |
| AC-8 | Static | `Table` and `TableHeaderCell` gain no props | `TableProps` body is exactly `children?: ReactNode;`; no `density?:`, no `wrapperClassName?:` anywhere in `Table.tsx` |
| AC-9 | Static | `Table.tsx` declares zero local `*_CLASS` constants and imports all 6 tokens from `../designSystem`; no `clsx`/`tailwind-merge`/`cva` | Regex sweep of `Table.tsx` source |
| AC-10 | Static | `ui/index.ts` exports `TableCellSize` and `TableCellVariant` as types; value exports unchanged | Barrel import of both types compiles; `export {` line unchanged |
| AC-11 | Static | RA-14's supersession is a **conversion**, not a deletion | The M35_P1 block still forbids `density`/`wrapperClassName` and still pins `TableProps`' body; the `size`/`variant` prohibitions are replaced by an assertion that both axes exist with their exact unions **and that all four `size`×`variant` combinations appear in ≥1 of the 9 migrated files** |
| AC-12 | Static+Integration | `FermentableSection.tsx` migrated | Zero `<table`/`<th`/`<td` literals; imports the three from `./ui`; renders 7 columnheaders; §2.2 variants applied |
| AC-13 | Static+Integration | `HopSection.tsx` migrated | Same shape; 7 columnheaders; embedded `Select`/`NumberInput` `width`/`size` props **unchanged** |
| AC-14 | Static+Integration | `YeastSection.tsx` migrated | Same shape; 6 columnheaders; empty-state `colSpan={6}` preserved |
| AC-15 | Static+Integration | `MiscSection.tsx` migrated | Same shape; 7 columnheaders, **all now `scope="col"`** (7 gained) |
| AC-16 | Static+Integration | `MashSection.tsx` — **both** tables migrated at `size="sm"` | Zero raw literals; 6 + 5 columnheaders; `MONO_VALUE_CLASS` no longer appears in any `<TableCell>` `className`, but **still appears** in the file (line ~111's non-table span) |
| AC-17 | Static+Integration | `PostBrewCalibrationModal.tsx` migrated at `size="sm"` | 4 columnheaders; `<tbody className="bg-slate-950/40">` retained; semantic emerald/rose variance colours render on inner `<span>`s, not cell `className` |
| AC-18 | Static+Integration | `ReadingLog.tsx` migrated | 7 columnheaders; header typography gone from the `<tr>`; inline-edit row keeps `colSpan={7}`; `reading-row-*` testids resolve |
| AC-19 | Static+Integration | `StockCheckPanel.tsx` migrated | 4 columnheaders; `data-testid="stock-check-table"` lands on the `<table>` element (not the wrapper), so `StockCheckPanel.test.tsx` passes unmodified |
| AC-20 | Static+Integration | `WaterCalculatorModal.tsx` migrated at `size="sm"` | 5 columnheaders; `<colgroup>` present with the five percentages **byte-identical** (20/14/27/27/12); the Sparge `<th>` still renders its checkbox with `data-testid="treat-sparge-water-toggle"` and toggles |
| AC-21 | Static | App-wide sweep | `<table` appears in `apps/web/src` **only** in `components/ui/Table.tsx`; `<th`/`<td` appear in no file under `apps/web/src/components` other than `ui/Table.tsx` |
| AC-22 | Integration | **(Finding 6 closure)** Per-table rendered column counts, automated | Rendered `columnheader` counts are exactly 7, 7, 7, 6, 6, 5, 7, 4, 4, 5 for tables 1-10 of §2.1 — asserted in tests, not by source trace |
| AC-23 | Integration | **(Finding 6 closure)** `scope="col"` coverage, automated | Across the 10 tables, **58** `columnheader` elements render and **every one** has `scope === 'col'` — including all 34 that lacked it before |
| AC-24 | Integration | Degenerate/empty inputs behave | With empty collections, `FermentableSection`/`HopSection`/`MiscSection` render their `colSpan={7}` empty row, `YeastSection` its `colSpan={6}`; `MashSection` renders **no table at all** (its existing `length > 0` guards are unchanged); no `—`, `&nbsp;` or other placeholder is fabricated by `TableCell` |
| AC-25 | Static+Integration | Scroll-container ownership transferred | The literal `overflow-x-auto` appears **zero** times across the 9 source files; every rendered table still has a direct parent `<div>` whose class list contains `overflow-x-auto` |
| AC-26 | Integration | Residual wrapper margins preserved on a plain div | `FermentableSection`/`HopSection`/`MiscSection` tables sit inside a `mb-4` ancestor and `MashSection`'s first inside `mb-3`; **no** `Table` receives `mb-*` via `className` |
| AC-27 | Regression | `accessibilityAndPolish.test.tsx` is **byte-identical** (SHA-256 equal in pre- and post-manifest) and green | Primary regression evidence, exactly as `BrewSheet.test.tsx` was in P1 |
| AC-28 | Regression | Forbidden-path integrity | `BrewSheet.tsx`, `BrewSheet.test.tsx`, `ScopeGuardrail.test.tsx`, `Modal.tsx`, `Button.tsx`, `Input.tsx`, `Select.tsx`, `NumberInput.tsx`, `FormField.tsx` all SHA-256-identical pre vs post; `PostBrewCalibrationModal.test.tsx`, `StockCheckPanel.test.tsx`, `WaterCalculatorModal.test.tsx`, `HopSection.test.tsx`, `MiscSection.test.tsx`, `FermentableSection.test.tsx` unmodified **and** green |
| AC-29 | Scope Guardrail | §5's SHA-256 manifest diff shows **exactly** the §4 authorized set: **0 created, 16 modified (12 source + 4 test), 0 deleted** | Any other path differing — including any `.tsx` outside §4 — fails this AC. **Assessed against the pre/post SHA-256 manifest, never `git diff` (RA-16)** |
| AC-30 | Layer 1 | `npm test` exits 0 | Total **≥ 2,224** passed (the current baseline), 2 skipped, across 121 files |
| AC-31 | Layer 1 | `npm run typecheck` exits 0 | 4/4 workspaces PASS |
| AC-32 | Layer 1 | `npm run build` exits 0 | Production client bundle builds clean |
| AC-33 | Layer 1 | `npm run lint` exits 0 | 0 errors; the same 4 pre-existing fast-refresh warnings, **0 new** |

---

## 4. Authorized Files

**Modified (16) — 12 source + 4 test. Nothing is created or deleted this phase.**

| # | Path | Change |
|---|---|---|
| 1 | `apps/web/src/components/designSystem.ts` | +1 private base, +3 exported tokens; `TABLE_CELL_CLASS` recomposed at identical value (RA-4) |
| 2 | `apps/web/src/components/ui/Table.tsx` | `TableCell` gains `size` + `variant`; `Table`/`TableHeaderCell` unchanged |
| 3 | `apps/web/src/components/ui/index.ts` | +2 type exports |
| 4 | `apps/web/src/components/FermentableSection.tsx` | table 1 migrated |
| 5 | `apps/web/src/components/HopSection.tsx` | table 2 migrated |
| 6 | `apps/web/src/components/MiscSection.tsx` | table 3 migrated |
| 7 | `apps/web/src/components/YeastSection.tsx` | table 4 migrated |
| 8 | `apps/web/src/components/MashSection.tsx` | tables 5 & 6 migrated |
| 9 | `apps/web/src/components/ReadingLog.tsx` | table 7 migrated |
| 10 | `apps/web/src/components/StockCheckPanel.tsx` | table 8 migrated |
| 11 | `apps/web/src/components/PostBrewCalibrationModal.tsx` | table 9 migrated |
| 12 | `apps/web/src/components/WaterCalculatorModal.tsx` | table 10 migrated |
| 13 | `apps/web/test/uiPrimitives.test.tsx` | M35_P2 block: AC-4..AC-26; RA-14 conversion of the M35_P1 AC-12 block |
| 14 | `apps/web/test/designSystem.test.ts` | +3 value pins |
| 15 | `apps/web/test/designTokens.test.ts` | AC-7 count 31→34, +3 names, stale title fixed |
| 16 | `apps/web/test/ReadingLog.test.tsx` | one line: AC-20 class pin converted (§2.4) |

*(Rows 1-12 are source, rows 13-16 are test. AC-29's binding count is **16 modified, 0 created, 0 deleted**.)*

**Forbidden paths — touching any of these fails AC-28 and AC-29:**

- `apps/web/src/components/BrewSheet.tsx` and `apps/web/test/BrewSheet.test.tsx` — **P1 is closed.** RA-6's default-value choice exists precisely so this file need not be reopened.
- `apps/web/test/accessibilityAndPolish.test.tsx` — must stay byte-identical (AC-27).
- `apps/web/test/ScopeGuardrail.test.tsx` — M35_P4's territory.
- `apps/web/src/components/Modal.tsx`, and `ui/Button.tsx`, `ui/Input.tsx`, `ui/Select.tsx`, `ui/NumberInput.tsx`, `ui/FormField.tsx`.
- `apps/web/test/HopSection.test.tsx`, `MiscSection.test.tsx`, `FermentableSection.test.tsx`, `PostBrewCalibrationModal.test.tsx`, `StockCheckPanel.test.tsx`, `WaterCalculatorModal.test.tsx` — these must pass **unmodified**; editing one to make it pass is a spec violation, not a fix.
- `package.json`, `package-lock.json` — no dependency may be added. `clsx` / `tailwind-merge` / `cva` are specifically forbidden (AC-9).
- Everything under `apps/api/`, `packages/`, and all framework paths (`CLAUDE.md`, `.claude/`, `.agents/`, `.gsd/`).
- **Any `width=` or `size=` prop on an embedded `NumberInput`/`Select`/`Button` inside a migrated cell** (RA-11) — this is the exact drift class that broke M35_P1's Layer 3.

---

## 5. Scope-Guardrail Methodology (binding)

`git diff --name-only` is **not viable here** (RA-16: 2 commits, 167 already-dirty paths) and must not be substituted.

**The literal first action of `/execute`, before any file is edited:**

```
git ls-files -co --exclude-standard -z | xargs -0 sha256sum > .gsd/scratch/M35_P2_pre.sha256
```

**The last action, after the final edit and before reporting Layer 1:**

```
git ls-files -co --exclude-standard -z | xargs -0 sha256sum > .gsd/scratch/M35_P2_post.sha256
```

Diff the two manifests. AC-29 requires the difference set to be **exactly** the §4 authorized list: **16 modified, 0 created, 0 deleted** (plus `.gsd/` framework files, which are outside the app scope guardrail). Any additional path — especially a forbidden one — fails AC-29, and the executor must report it rather than reconcile it silently. Both manifests are retained as the audit artifact the Layer 2 critic re-derives from.

---

## 6. Halt Gate (State 2)

**Reviewer's attention is drawn to RA-2** — this phase deliberately changes the appearance of all 10 tables (density, text colour, header typography, and a new rule under the header row). That is the milestone's chartered outcome, but it is a visual change, unlike P1's zero-pixel move, and it is the one decision that cannot be walked back cheaply once executed.

Secondary sign-off items: **RA-5** (explicit per-cell props over context; no `TableHead` wrapper — closing the question P1 left open), **RA-8** (34 `<th>` gain `scope="col"` retroactively), and **RA-14** (a P1 assertion is deliberately superseded).

Review this feature specification. Reply with **SPEC_APPROVED** to begin execution.
