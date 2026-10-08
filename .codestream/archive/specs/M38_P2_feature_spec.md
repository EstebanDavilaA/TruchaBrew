# FEATURE SPECIFICATION: M38_P2 - BJCP 2021 Style Guide Dataset & Evaluator

> **Milestone 38:** "Recipe Folders, Tags & BJCP 2021 Style Targets" (`.gsd/ROADMAP.md`)
> **Phase:** P2 of 3. **State:** State 2 (spec draft — no code until `SPEC_APPROVED`).
> **Builds on:** M38_P1 (folders & tags, archived). **Consumed by:** M38_P3 (Recipe Designer style selector + in-range gauges) — P3 is a **later** phase and is deliberately **NOT** scoped here.

> ## AMENDMENT 1 (2026-09-02) — spot-check ranges corrected to the official source
>
> **Trigger:** pre-build source verification during `/execute` (no code written) found 4 of the 7 spot-check ACs conflicting with the **official BJCP 2021 Beer Style Guidelines PDF** and both cited machine mirrors, which agree with the PDF on every disputed value. **Same-phase amendment** — M38_P2/P3 remain as scheduled; no new phase is opened.
>
> - **AC IDs 1–32 stay stable.** AC-9, AC-10, AC-11, AC-12 amended in place and marked `[AMENDED]`; no AC renumbered or appended. New **RA-12** records the source-verification method.
> - **AC-9** (10A Weissbier): og high `1.052 → 1.053`, fg low `1.010 → 1.008` — official is og `1.044–1.053`, fg `1.008–1.014`.
> - **AC-10** (3B Czech Premium Pale Lager): og high `1.056 → 1.060`, abv low `4.9 → 4.2`, srm high `5.5 → 6` — official is og `1.044–1.060`, abv `4.2–5.8`, srm `3.5–6`.
> - **AC-11** (Vienna Lager): style code `29A → 7A` (range values were already correct and are unchanged). In the 2021 guidelines Vienna Lager is `7A`; `29A` is Fruit Beer.
> - **AC-12** (20A American Porter): abv low `5.0 → 4.8` — official is `4.8–6.5`.
> - **AC-7/AC-8/AC-13** independently re-verified accurate; untouched.
>
> ## AMENDMENT 2 (2026-09-02) — dataset scoped to the official range-carrying set (categories 1–26, 86 styles)
>
> **Trigger:** pre-build source verification during `/execute` (Amendment 1 passed, still no code written) established that the official BJCP 2021 guidelines publish numeric ranges **only for categories `1`–`26` (86 styles)**; categories `27`–`34` state "Vital Statistics: Variable by base style", so AC-1 (`> 90` styles) and AC-2 (categories `1..34`) were unsatisfiable by honest data. **Same-phase amendment** — M38_P2/P3 remain as scheduled.
>
> - **AC IDs 1–32 stay stable.** AC-1 and AC-2 amended in place and marked `[AMENDED]`; no AC renumbered or appended. New **RA-13** records the re-scope decision + three-source verification.
> - **AC-1**: dataset length `> 90` → `=== 86` (complete official range-carrying set, categories `1`–`26`).
> - **AC-2**: category coverage `1..34` → `1..26` (categories `27`–`34` carry no numeric guidelines; excluded by design — no fabrication).
> - **AC-3…AC-32** unaffected (every spot-check and evaluator AC lives in `1`–`26`; AC-5/AC-6/AC-14 hold for the 86).
> - A request for a `27`–`34` or other absent style id returns the existing `found: false` no-match contract — semantically correct (no numeric guideline exists for it).

## Provenance

- **No dedicated FEAT-xxx / BUG-xxx is assigned to M38_P2.** A full read of `.gsd/FEATURES.md` and `.gsd/BUGS.md` confirms the only BJCP-adjacent items are **FEAT-015** and **FEAT-016** (structured sensory scoring + BJCP radar *comparison*), both already `CLOSED` (delivered in M17_P1 / M20_P1). Those items concern the *sensory score panel* (`calculateBJCPScore`) and a *Completed-stage radar* — neither is the machine-readable style-guideline dataset this phase builds, and neither is re-opened here. Consequently **no status field changes** are required in `FEATURES.md`/`BUGS.md`; the BJCP style-guideline work is **roadmap-scoped only** (Milestone 38 P2/P3 in `.gsd/ROADMAP.md`). This phase invents no new FEAT/BUG id and mutates neither file.
- **Roadmap context / deferred items:** Milestone 38 is estimated at **3 phases**; this phase does not change that count. `RA-8` (optional `folder?`/`tags?` required-typing sweep) and `RA-9` (folder datalist/picker deferred into M38_P3) are **neither** in P2's scope. `RA-9` is expressly absorbed by **P3**, not P2. This spec authorizes zero edits to `apps/web`, `apps/api`, `packages/shared-types`, or any non-listed file.
- **`.gsd/active/` pre-flight:** Confirmed empty of any prior-phase spec (only an empty `manual_verification/` dir remains); no stale spec to reconcile before writing.

## Phase Summary

Author a **comprehensive, typed, read-only dataset of BJCP 2021 beer-style guideline ranges** (OG, FG, ABV, IBU, SRM color) plus a **pure evaluator** `evaluateStyleMatch` that, given a style id and a recipe's vitals, reports per-vital in/out-of-range and an overall match verdict — all inside the existing pure-logic package `packages/calculations/src/bjcp/`. This phase ships **data + evaluator only** (no UI). The **next** phase (M38_P3) consumes the exported dataset for the style selector and the real-time OG/FG/ABV/IBU/SRM in-range gauges; P2 keeps its contracts P3-consumable but does none of that UI work.

### Key Behaviors
1. A `BJCP_STYLES` dataset constant covers the **complete official BJCP 2021 range-carrying set — categories `1`–`26`, 86 styles** (e.g. `"21A"` = American IPA), keyed by the official style code, each carrying inclusive low/high guideline ranges for the five recipe vitals the app already computes (`og`, `fg`, `abv`, `ibu`, `srm`). Categories `27`–`34` (Historical, Wild, Fruit, Spiced, Alternative-Fermentables, Smoked, Wood, Specialty) publish **no numeric guidelines** ("Vital Statistics: Variable by base style") and are intentionally excluded — see RA-13. **[AMENDED — Amendment 2]**
2. `evaluateStyleMatch(styleId, vitals)` is a **pure, deterministic** function: for a found style it returns per-vital presence + in-range booleans, counts of presented/in-range/out-of-range vitals, and a composite `verdict` (`'full' | 'partial' | 'none'`). For an unknown style id or a recipe with no present vitals it returns a **no-match contract** (`found: false` / `verdict: null`) — it **never fabricates** a range or a match.
3. The dataset is **read-only** (typed `readonly`/frozen), living under `packages/calculations/src/bjcp/` with a barrel, and is re-exported from the package top-level `index.ts` **by explicit name** to avoid the documented `export *` name-collision hazard.

### Resolved Ambiguities (Binding)

- **Range semantics — inclusive on both ends.** Every vital range is `[low, high]`, and "in range" is **exactly** `low <= value <= high` (both endpoints inclusive) for every one of OG/FG/ABV/IBU/SRM. Out-of-range is `value < low` OR `value > high`. There are no one-sided open ranges and no "close enough" tolerance in this phase (any tolerance is a P3 *display* concern, never a data/evaluator concern). Boundary ACs pin `value === low` and `value === high` as in-range, and `value = high + 0.001` / `value = low - 0.001` as out-of-range for each scale.
- **Composite match judgment (full vs partial vs none).** Only the **present** vitals participate; vitals whose input value is missing are excluded entirely (see no-match). With `presentedCount = P > 0` and `inRangeCount = R`:
  - `'full'` ⟺ `R === P`.
  - `'none'` ⟺ `R === 0`.
  - `'partial'` ⟺ `0 < R < P`.
  - `verdict === null` ⟺ style not found **or** `P === 0`. This mirrors the "no active fret" contract style used elsewhere: the caller must branch on `found`/`verdict` rather than reading a placeholder verdict.
- **Gravity unit convention — specific gravity (SG), no conversion in the evaluator.** BJCP 2021 publishes OG and FG in SG. The dataset stores `og`/`fg` as **SG** (e.g. `{ low: 1.056, high: 1.070 }`). The real recipe side `CalculatedStats.og`/`fg` are already SG (see `packages/shared-types/src/brewing.ts`), so `evaluateStyleMatch` compares them **directly with no gravity conversion**. If a future caller holds a Plato reading, it must convert with the **existing** exported `platoToSg` before calling — the evaluator does **not** convert internally (an SG value passed where Plato was intended would be wildly out of range and must be the caller's error to prevent, not the evaluator's to guess).
- **Color unit — SRM only, EBC never used internally.** The dataset stores `srm` (BJCP publishes SRM). The recipe side carries both `srm` and `ebc`; `evaluateStyleMatch` consumes only `srm`. There is **no EBC path** inside the evaluator, so there is no drift between `srmToEbc` (`× 1.97`, `SRM_TO_EBC`) and the dataset. A caller holding only EBC converts with the existing exported `ebcToSrm` before calling. Exact boundary for the dataset is therefore irrelevant to the evaluator (SRM is already canonical); the conversion factor `1.97` remains owned solely by `packages/calculations/src/units.ts` (`srmToEbc`/`ebcToSrm`), which is **untouched**.
- **Missing / undefined vital — no-match contract, never fabricated.** A vital input value of `undefined`, `null`, or any non-finite number (`NaN`, `±Infinity`) is treated as **not present** (`present: false`), contributes `0` to `presentedCount`, and is excluded from all verdict math. The evaluator never substitutes a default, a mid-range guess, or the style's own midpoint for a missing vital. When **all** vitals are absent (`presentedCount === 0`), `verdict` and `allInRange` are `null` even if the style is found.
- **Unknown style id.** If `styleId` has no matching entry in the supplied dataset, `found: false`, `style: null`, `verdict: null`, `allInRange: null`, and every vital `inRange` is `null` (ranges cannot be judged without a guideline). No exception is thrown.
- **Dataset coverage scope.** P2 covers the **complete, official BJCP 2021 range-carrying style set (categories `1`–`26`, 86 styles)** as published **[AMENDED — Amendment 2]** (source: *2021 BJCP Style Guidelines*; the officially-flagged machine-readable mirrors — `beerjson/bjcp-json` `bjcp_styleguide-2021.json`, `ascholer/bjcp-styleview` `styles.json` — are acceptable transcription sources alongside the PDF/DOCX). The dataset must include at least one style from **every** BJCP 2021 category code `1..26` (categories `27`–`34` excluded per RA-13), must not contain duplicate style ids, and every style must carry all five vitals. The exact total style count is **not** hard-coded as a magic number (transcription-count totals are not reliably verifiable without the source open); instead coverage is pinned by (a) the structural all-26-categories + uniqueness + all-five-vitals ACs, (b) a source-cited provenance count exported as `BJCP_STYLE_COUNT` with a runtime guard that it equals `BJCP_STYLES.length`, and (c) **spot-check ACs** that pin the exact official ranges of a curated set of well-known styles (21A, 18B, 10A, 3B, 7A, 20A, 1A) so data accuracy is anchored to independently-checkable reference values. The executor **must** transcribe from the cited source; AC-1 pins the total to the official 86-style range-carrying set (categories `1`–`26`).
- **Read-only dataset.** `BJCP_STYLES` is exported as `readonly BJCPStyle[]`; each style object is `Readonly<BJCPStyle>`. The evaluator must never mutate input or the dataset (pure function; no in-place edits, no cached results that depend on caller state).
- **Import/export plan & collision avoidance.** The top-level barrel `packages/calculations/src/index.ts` currently `export *`s most modules but re-exports `config.ts` **by explicit name** because of a name collision (the M7_P1 note). The new `bjcp` module adds value/type names that **do not** collide with any existing export — in particular it must **not** re-export or shadow the existing BJCP-*sensory* symbols `BJCPTier`, `SensoryScoreInput`, `BJCPScoreResult`, `calculateBJCPScore` (all already exported from `equipmentDriven.ts`). To make the guard structural rather than incidental, the top-level barrel adds the `bjcp` surface via **explicit named re-exports** (both `export { ... } from './bjcp'` and `export type { ... } from './bjcp'`) — mirroring the `config.ts` treatment — rather than a bare `export * from './bjcp'`. The `bjcp/index.ts` sub-barrel may use `export *` internally over its own three files because its names are unique and private to the subdirectory, but the **top-level** `index.ts` must name them explicitly.
- **No new type duplication.** `evaluateStyleMatch` consumes vitals under the **same field names/types** the real recipe stats already use (`og`, `fg`, `abv`, `ibu`, `srm` from `CalculatedStats`). This phase defines **no parallel** stats type; P3 passes `CalculatedStats` (or a partial of it) straight in.
- **Spot-check ranges re-verified against the official source (RA-12).** *(new, Amendment 1 — closes the pre-build data-conflict.)* The seven AC-7…AC-13 range tables were re-transcribed byte-for-byte from the **official BJCP 2021 Beer Style Guidelines PDF** (`2021_Guidelines_Beer.pdf`, bjcp.org) and cross-checked against both cited machine mirrors (`beerjson/bjcp-json` `styles/bjcp_styleguide-2021.json`, `ascholer/bjcp-styleview` `styles.json`), which agree with the PDF on every value. AC-9/AC-10/AC-12 carried transcription errors and were corrected in place; AC-11's code `29A` was wrong (Vienna Lager is `7A` — `29A` is Fruit Beer) and is corrected to `7A`; AC-7/AC-8/AC-13 confirmed accurate. The full dataset is transcribed from the official PDF/mirrors — never from the ACs' numbers alone, which exist only as anchor pins.

- **Dataset scoped to the official range-carrying set — categories `1`–`26`, 86 styles (RA-13).** *(new, Amendment 2 — closes the pre-build coverage conflict.)* Independent three-source verification (official `2021_Guidelines_Beer.pdf`, `beerjson/bjcp-json` `styles/bjcp_styleguide-2021.json`, `ascholer/bjcp-styleview` `styles.json`) established that the official BJCP 2021 guidelines publish numeric OG/FG/ABV/IBU/SRM ranges **only for categories `1`–`26` (86 styles: `1A`–`26D`)**; every substyle in categories `27`–`34` (Historical Beer, American Wild Ale, Fruit Beer, Spiced Beer, Alternative Fermentables Beer, Smoked Beer, Wood Beer, Specialty Beer — 30 official entries) states **"Vital Statistics: Variable by base style"** and carries no numeric guideline. This phase ships exactly that official range-carrying set; no ranges are fabricated for `27`–`34` (the spec's no-fabrication contract would forbid it, and invented ranges would poison P3's gauges). Requests for a `27`–`34` style id (or any id absent from the dataset) return the normal `found: false` no-match contract — semantically correct, since no numeric guideline exists for them. AC-1 (`=== 86`) and AC-2 (`1..26`) amended in place; all types, evaluator contracts, and AC-3…AC-32 unaffected (every spot-check and evaluator AC lives in `1`–`26`).

---

## 1. Data Schema & Contracts

### Exported Types (from `packages/calculations/src/bjcp/`)

```ts
// The five recipe vitals the app computes and BJCP publishes guideline ranges for.
export type StyleVitalKey = 'og' | 'fg' | 'abv' | 'ibu' | 'srm';

// Inclusive closed interval [low, high]. low <= high always.
export interface RangeSpec {
  low: number;   // inclusive lower bound
  high: number;  // inclusive upper bound
}

// One official BJCP 2021 style's guideline ranges.
export interface BJCPStyle {
  id: string;         // official style code, e.g. '21A' (category digits + letter)
  name: string;       // official style name, e.g. 'American IPA'
  og: RangeSpec;      // original gravity, SPECIFIC GRAVITY (SG), e.g. { low: 1.056, high: 1.070 }
  fg: RangeSpec;      // final gravity, SPECIFIC GRAVITY (SG)
  abv: RangeSpec;     // alcohol by volume, percent
  ibu: RangeSpec;     // International Bitterness Units
  srm: RangeSpec;     // Standard Reference Method color
}

// The recipe vitals fed to the evaluator. Field names match CalculatedStats;
// each field optional/nullable so a partial or not-yet-measured recipe works.
export interface RecipeVitals {
  og?: number | null;   // SG
  fg?: number | null;   // SG
  abv?: number | null;  // percent
  ibu?: number | null;
  srm?: number | null;  // SRM
}

export interface VitalMatchResult {
  key: StyleVitalKey;
  present: boolean;        // false when input was undefined/null/non-finite
  value: number | null;    // the input value when present, else null
  low: number;             // style lower bound (0 when !found)
  high: number;            // style upper bound (0 when !found)
  inRange: boolean | null; // low<=value<=high when present AND found; null otherwise
}

export type StyleMatchVerdict = 'full' | 'partial' | 'none';

export interface StyleMatchResult {
  styleId: string;
  found: boolean;                  // false when styleId has no dataset entry
  style: BJCPStyle | null;         // the matched style, else null
  vitals: Record<StyleVitalKey, VitalMatchResult>;
  presentedCount: number;          // count of present (finite) vital inputs
  inRangeCount: number;            // count of present vitals that are in range
  outOfRangeCount: number;         // presentedCount - inRangeCount
  allInRange: boolean | null;      // null when !found OR presentedCount===0
  verdict: StyleMatchVerdict | null; // null when !found OR presentedCount===0
}
```

### Exported Constants & Functions

```ts
// Full official BJCP 2021 dataset, ordered by category code then letter. Read-only.
export const BJCP_STYLES: readonly BJCPStyle[];

// Runtime guard: number of styles in BJCP_STYLES. Must equal BJCP_STYLES.length.
export const BJCP_STYLE_COUNT: number;

// Pure inclusive range check used by the evaluator (also independently exported).
export function isValueInRange(value: number, range: RangeSpec): boolean;
//   returns range.low <= value && value <= range.high

// Pure evaluator. See §2.
export function evaluateStyleMatch(
  styleId: string,
  vitals: RecipeVitals,
  styles?: ReadonlyArray<BJCPStyle>,  // default: BJCP_STYLES; injectable for empty/degenerate tests
): StyleMatchResult;
```

### File Layout & Symbol Inventory

| File | Status | Contents |
|------|--------|----------|
| `packages/calculations/src/bjcp/types.ts` | **NEW** | All exported types above (`StyleVitalKey`, `RangeSpec`, `BJCPStyle`, `RecipeVitals`, `VitalMatchResult`, `StyleMatchVerdict`, `StyleMatchResult`). Types only — no runtime code. |
| `packages/calculations/src/bjcp/data.ts` | **NEW** | `BJCP_STYLES` (readonly array of every official 2021 style) + `BJCP_STYLE_COUNT`. Header comment cites the source document/JSON and states the transcribed style count. |
| `packages/calculations/src/bjcp/evaluate.ts` | **NEW** | `isValueInRange`, `evaluateStyleMatch`, plus any private helper. May build an internal id→style `Map` at module load for O(1) lookup. |
| `packages/calculations/src/bjcp/index.ts` | **NEW** | Sub-barrel: re-exports the three files' public symbols. |
| `packages/calculations/src/index.ts` | **MODIFIED** | Adds **explicit named re-exports** of the `bjcp` surface (values via `export { ... } from './bjcp'`, types via `export type { ... } from './bjcp'`) appended after the existing lines. **No existing line is removed or reordered.** |
| `packages/calculations/test/bjcp.test.ts` | **NEW** | Vitest suite covering the AC matrix below. |

**Untouched (explicitly out of scope):** every file in `apps/web`, `apps/api`, `packages/shared-types`, all other `packages/calculations/src/*` modules (`equipmentDriven.ts` and its `calculateBJCPScore`/`BJCPTier` etc. remain as-is), `packages/calculations/src/units.ts` (`srmToEbc`, `ebcToSrm`), `packages/calculations/src/config.ts` (`sgToPlato`, `platoToSg`), `packages/calculations/src/index.ts`'s existing lines, all `package.json`, all config/tsconfig/vitest files, and `.gsd/`. The scope-guardrail AC enforces this byte-for-byte.

**No-match → caller branching contract (for M38_P3 and any future consumer):** when `result.found === false` the caller must render a "no guideline data for this style" state and must **not** show in-range gauges or substitute any default verdict. When `result.found === true` but `result.presentedCount === 0` (or an individual `present: false`), the caller must show a neutral/empty gauge for those vitals — never a fabricated in/out reading. No-match results never leak a placeholder verdict into state.

---

## 2. Transformations & Pure Logic

### Pure Function Contracts

- **`isValueInRange(value: number, range: RangeSpec): boolean`** — deterministic: `range.low <= value && value <= range.high`. Inclusive on both ends. No rounding, no epsilon.
- **`evaluateStyleMatch(styleId: string, vitals: RecipeVitals, styles?: ReadonlyArray<BJCPStyle>): StyleMatchResult`** — deterministic input→output with no side effects and no dependence on ambient state. Algorithm, in order:
  1. Resolve `list = styles ?? BJCP_STYLES`; look up the style whose `id === styleId`. If absent → `found: false`, `style: null`.
  2. For each of the five `StyleVitalKey`s, classify presence: present ⟺ the input value is a finite number (`Number.isFinite`). Non-present inputs (`undefined`/`null`/`NaN`/`±Infinity`) give `present: false`, `value: null`, `inRange: null`. Present-but-`!found` inputs give `inRange: null` (no guideline to judge against).
  3. `presentedCount` = number of present vitals; `inRangeCount` = number of present vitals where (found AND `isValueInRange`) ; `outOfRangeCount = presentedCount - inRangeCount`.
  4. `allInRange` = (`found && presentedCount > 0`) ? `inRangeCount === presentedCount` : `null`.
  5. `verdict` per §1 "composite match" — `null` when `!found || presentedCount === 0`, else `'full'`/`'none'`/`'partial'` by `R === P` / `R === 0` / otherwise.
  6. Return the assembled `StyleMatchResult`. Identical inputs always yield a deep-equal identical output.

### No-Match / Fallback Contracts
- Unknown style id → `found:false`, `style:null`, `verdict:null`, `allInRange:null`, per-vital `inRange:null`. No throw.
- All vitals absent (or non-finite) → `presentedCount:0`, `verdict:null`, `allInRange:null`. No throw, no fabricated ranges.
- A style with `presentedCount > 0` always yields a concrete `verdict` (`'full'|'none'|'partial'`) — the three outcomes are exhaustive and mutually exclusive for `found === true && presentedCount > 0`.
- **Caller branching rule:** consumers branch on `found` first, then on `verdict === null` (no present vitals), and only then read `vitals[...].inRange` for the gauges. Fallback/placeholder readings are never produced by this function.

### Stateful Integration Contract
- This phase is **pure logic only** — there is no frame/render loop, no component state, and no `apps/web` integration in P2. The dataset is a static constant; `evaluateStyleMatch` is a stateless pure function. P3 (later) will call `evaluateStyleMatch` from React render paths; because the function is pure and the dataset read-only, P3 can call it freely without lockstep/caching concerns. This section exists to make explicit that P2 adds **no** stateful integration surface and **no** shared mutable module state (the only module-level state permitted is the internal frozen id→style `Map` in `evaluate.ts`, which is read-only after construction).

### Refactoring & Legacy Cleanup
- **No legacy code is purged or migrated in P2.** In particular: the existing BJCP-*sensory* code in `equipmentDriven.ts` (`SensoryScoreInput`, `BJCPScoreResult`, `BJCPTier`, `calculateBJCPScore`) is a **distinct concern** and is left **untouched**; the new `bjcp/` style-guideline module is additive and must not fold into, rename, or shadow it.
- **Barrel hygiene:** the top-level `index.ts` must add the `bjcp` surface by **explicit name** (not bare `export *`), consistent with the existing `config.ts` treatment, so no future/`equipmentDriven` name collision can silently arise. This is the one legacy-adjacent discipline to honor, not a code removal.

---

## 3. Acceptance Criteria & Test Matrix

> **Scope-guardrail note (RA-14 pattern):** `git diff --name-only` is **NOT viable** in this repo — the entire tracked tree shows modified against HEAD (no meaningful base commit). The scope guardrail **AC-30** therefore specifies a **pre/post-execution SHA-256 content-manifest diff** instead, and says so explicitly: the executor records `git ls-files -co --exclude-standard -z | xargs -0 sha256sum` **before the first edit** and **again after the last edit**, then asserts the only paths whose hash changed are within the Authorized Files set (the five `bjcp/` files + top-level `index.ts` + `test/bjcp.test.ts`).

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| **AC-1** `[AMENDED]` | `BJCP_STYLES` is a non-empty `readonly BJCPStyle[]` | Unit (data) | Array length `=== 86` (the complete official BJCP 2021 range-carrying set, categories `1`–`26`; categories `27`–`34` publish no numeric guidelines — RA-13); import resolves; each element is a valid `BJCPStyle`. |
| **AC-2** `[AMENDED]` | Full BJCP 2021 category coverage | Unit (data) | For every integer category code `1..26`, at least one style's `id` begins with that code's digits (e.g. `21A` → category `21`). Categories `27`–`34` are excluded by design (no official numeric ranges — RA-13). |
| AC-3 | Unique style ids | Unit (data) | No two styles share the same `id`. |
| AC-4 | Style id format | Unit (data) | Every `id` matches `/^\d{1,2}[A-Z]$/`. |
| AC-5 | Every style has all five vitals | Unit (data) | Every style has `og`, `fg`, `abv`, `ibu`, `srm` `RangeSpec`s, each finite and ordered `low <= high`. |
| AC-6 | Physical-domain sanity bounds | Unit (data) | For every style: `1.000 <= og.low`; `0.990 <= fg.low`; `0 <= abv.low`; `0 <= ibu.low`; `0 <= srm.low`; all highs finite and `low <= high`. |
| AC-7 | Spot-check: American IPA `21A` ranges | Unit (data) | Entry `21A` equals official: og `1.056–1.070`, fg `1.008–1.014`, abv `5.5–7.5`, ibu `40–70`, srm `6–14`. |
| AC-8 | Spot-check: American Pale Ale `18B` ranges | Unit (data) | Entry `18B` equals official: og `1.045–1.060`, fg `1.010–1.015`, abv `4.5–6.2`, ibu `30–50`, srm `5–10`. |
| **AC-9** `[AMENDED]` | Spot-check: Weissbier `10A` ranges | Unit (data) | Entry `10A` equals official: og `1.044–1.053`, fg `1.008–1.014`, abv `4.3–5.6`, ibu `8–15`, srm `2–6`. |
| **AC-10** `[AMENDED]` | Spot-check: Czech Premium Pale Lager `3B` ranges | Unit (data) | Entry `3B` equals official: og `1.044–1.060`, fg `1.013–1.017`, abv `4.2–5.8`, ibu `30–45`, srm `3.5–6`. |
| **AC-11** `[AMENDED]` | Spot-check: Vienna Lager `7A` ranges | Unit (data) | Entry `7A` equals official: og `1.048–1.055`, fg `1.010–1.014`, abv `4.7–5.5`, ibu `18–30`, srm `9–15`. |
| **AC-12** `[AMENDED]` | Spot-check: American Porter `20A` ranges | Unit (data) | Entry `20A` equals official: og `1.050–1.070`, fg `1.012–1.018`, abv `4.8–6.5`, ibu `25–50`, srm `22–40`. |
| AC-13 | Spot-check: American Light Lager `1A` ranges | Unit (data) | Entry `1A` equals official: og `1.028–1.040`, fg `0.998–1.008`, abv `2.8–4.2`, ibu `8–12`, srm `2–3`. |
| AC-14 | `BJCP_STYLE_COUNT` guard | Unit (data) | `BJCP_STYLE_COUNT === BJCP_STYLES.length`. |
| AC-15 | Full-match verdict (mid-range) | Unit (evaluate) | `evaluateStyleMatch('21A', { og: 1.060, fg: 1.011, abv: 6.5, ibu: 55, srm: 10 })` → `found:true`, `presentedCount:5`, `inRangeCount:5`, `allInRange:true`, `verdict:'full'`. |
| AC-16 | Inclusive lower bound | Unit (evaluate) | For `21A`, `og: 1.056` (== low) → `og.inRange === true`; `srm: 6` (== low) → in range. |
| AC-17 | Inclusive upper bound | Unit (evaluate) | For `21A`, `og: 1.070` (== high) → in range; `ibu: 70` (== high) → in range. |
| AC-18 | Exclusive just-outside bounds | Unit (evaluate) | For `21A`, `og: 1.071` (high+0.001) → out of range; `og: 1.055` (low−0.001) → out of range; same boundary convention asserted for `abv` and `srm`. |
| AC-19 | Partial verdict | Unit (evaluate) | `evaluateStyleMatch('21A', { og: 1.060, abv: 12 })` → `presentedCount:2`, `inRangeCount:1`, `verdict:'partial'`. |
| AC-20 | None verdict | Unit (evaluate) | `evaluateStyleMatch('21A', { og: 1.100, abv: 12 })` → `inRangeCount:0`, `verdict:'none'`, `allInRange:false`. |
| AC-21 | Unknown style id (no-match) | Unit (evaluate) | `evaluateStyleMatch('999Z', { og: 1.060 })` → `found:false`, `style:null`, `verdict:null`, `allInRange:null`, per-vital `inRange:null`. No throw. |
| AC-22 | Empty vitals (no-match) | Unit (evaluate) | `evaluateStyleMatch('21A', {})` → `found:true`, `presentedCount:0`, `verdict:null`, `allInRange:null`; no fabricated ranges. |
| AC-23 | Null / non-finite vitals excluded | Unit (evaluate) | Input `{ og: null, fg: undefined, abv: NaN, ibu: Infinity }` → `presentedCount:0`, `verdict:null`; and `{ og: 1.060, abv: NaN }` → `presentedCount:1`, only `og` evaluated. No throw. |
| AC-24 | Single present vital | Unit (evaluate) | `evaluateStyleMatch('18B', { og: 1.050 })` → `presentedCount:1`, `verdict:'full'` (only vital in range); `{ og: 1.080 }` → `verdict:'none'`. |
| AC-25 | Empty dataset (degenerate) | Unit (evaluate) | `evaluateStyleMatch('21A', { og: 1.060 }, [])` → `found:false`, `verdict:null`. |
| AC-26 | Default dataset param | Unit (evaluate) | Calling `evaluateStyleMatch('21A', { og: 1.060 })` with 2 args uses `BJCP_STYLES` (found:true). |
| AC-27 | Determinism | Unit (evaluate) | Two calls with identical args produce deep-equal results; output object is not reused/mutated across calls. |
| AC-28 | Gravity is SG (no Plato confusion) | Unit (evaluate) | `og: 1.060` for `21A` is in range while `og: 15` (a would-be °P reading) is out of range — proves the dataset/evaluator interpret gravity as SG, never converting. |
| AC-29 | Color is SRM only | Unit (evaluate) | Only `srm` drives the color vital: `evaluateStyleMatch('21A', { srm: 10 })` → `srm.inRange === true`; an `ebc` field is not a recognized key (ignored, does not affect `presentedCount`). |
| AC-30 | Scope guardrail (SHA-256 manifest) | Verification | Pre/post `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` manifests differ **only** for: `packages/calculations/src/bjcp/{types,data,evaluate,index}.ts`, `packages/calculations/src/index.ts`, `packages/calculations/test/bjcp.test.ts`. No other tracked/untracked path's hash changes. (`git diff --name-only` is not viable in this repo — see note above.) |
| AC-31 | Barrel export integrity (no collision) | Unit / typecheck | All new symbols import cleanly from `@truchabrew/calculations`; existing `BJCPTier`, `SensoryScoreInput`, `BJCPScoreResult`, `calculateBJCPScore` still resolve and are not shadowed; top-level typecheck/build has no duplicate-export ambiguity. |
| AC-32 | Layer-1 gates | Integration | Test suite **and** typecheck **and** build **and** lint all exit `0`. Test totals exceed the baseline (2,495 passed / 2 skipped across 126 files) with the new `bjcp.test.ts` present and its ACs all passing. |

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
