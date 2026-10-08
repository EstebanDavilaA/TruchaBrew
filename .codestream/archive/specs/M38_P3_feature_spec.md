# FEATURE SPECIFICATION: M38_P3 — Real-Time BJCP Style Target Gauges & Folder Datalist in the Recipe Designer

## Phase Summary

Milestone 38 is **"Recipe Folders, Tags & BJCP 2021 Style Targets"**. P1 (folders & tags taxonomy) and P2 (the BJCP 2021 dataset + `evaluateStyleMatch` in `packages/calculations`) are shipped and archived. P3 is the **final, UI slice** that makes the milestone's user-visible outcome real inside the Recipe Designer: a **BJCP style selector** plus **real-time in-range comparison gauges** (OG, FG, ABV, IBU, SRM) that render against the live-computed vitals of the recipe being edited, using the M38_P2 evaluator. P3 also **absorbs RA-9** (deferred from M38_P1 Amendment 1): the editor's folder `Input` gains a datalist of existing folder names, which needs a folder source the editor view did not previously add.

The app has **no `RecipeEditor.tsx`** — the Recipe Designer is rendered inline in `apps/web/src/App.tsx` (the editor view branch, guarded by `editor.recipe`). `StatsHeader.tsx` is the "Live Recipe Statistics" card that already receives `stats={editor.stats}`. The roadmap's "RecipeEditor.tsx / StatsHeader.tsx" file names are pre-split approximations; the real host is `App.tsx`. This spec anchors the new UI to `App.tsx` and deliberately **does not modify `StatsHeader.tsx`** (see Resolved Ambiguity RA-P3-3) — it renders the new style-target panel immediately below `StatsHeader` in `App.tsx`.

### Key Behaviors
1. A brewer selects a BJCP 2021 style (from the 86-style `BJCP_STYLES` dataset) in the Recipe Designer; the choice is a **persisted, structured `bjcpStyleId`** on the recipe that round-trips through save/load, independent of the existing free-text `styleName`.
2. Below the live statistics, five per-vital gauges (Original Gravity, Final Gravity, ABV, IBU, Color/SRM) compare the **live-computed recipe vitals** against the selected style's inclusive guideline ranges, color each vital in-range/out-of-range, and show a composite verdict (Full / Partial / No match) — recomputing in the same render as any vitals or style change.
3. When no BJCP style is selected, or the stored id is not in the dataset, the panel renders a **neutral state** — it never fabricates a range, a match, or a verdict.
4. The editor's folder `Input` (RA-9) offers a datalist of existing folder names, sourced by fetching the full recipe-summary list on editor entry and deriving distinct, sorted, non-null folder names client-side. Free-text folder entry remains fully supported (a datalist is a suggestion list, never a constraint).

### Resolved Ambiguities (Binding)

- **RA-P3-1 — Style storage: NEW nullable persisted `bjcpStyleId` (NOT a mapping of `styleName` text).** A stable, structured style identity is required to drive gauge comparison deterministically; fuzzy text→id matching of the free-text `styleName` ("IPA" is ambiguous across ~10 styles) is rejected as fragile and non-round-trippable. Binding: add an **optional** `bjcpStyleId?: string | null` field across `Recipe` (`packages/shared-types/src/brewing.ts`) and `RecipeWriteInput` (`packages/shared-types/src/api.ts`), a nullable `recipes.bjcp_style_id` DB column via an **additive** migration, and full write/read wiring in the repository, route schema, and editor save/load path. It is **optional on every type** per the M38_P1 Amendment 1 RA-8 precedent (dozens of pre-existing `Recipe`-typed literals across `packages/calculations` fixtures and web modules outside this phase's Authorized Files never set it — optionality avoids an out-of-scope fixture sweep). `null` / omitted = "no BJCP style". It is **NOT** added to `RecipeSummary`/`listRecipeSummaries` in P3 (the library in-range surface is deferred — RA-P3-7); the summary endpoint selects columns explicitly and therefore does not pick up the new column automatically. `styleName` remains an independent free-text field; **selecting a BJCP style does NOT write `styleName`** (decoupled classification vs. structured target).
- **RA-P3-2 — Vitals source & units: adapter from `CalculatedStats` with NO unit conversion.** The gauge compares the **live-computed editor vitals** (`editor.stats`, a `CalculatedStats`), not saved recipe stats. `stats.og`/`stats.fg` are canonical **specific gravity** (SG), `stats.abv` is **percent**, `stats.ibu` is **IBU**, `stats.srm` is **SRM** — every one already matches the BJCP dataset's published units byte-for-byte (M1 canonical-metric storage; color is SRM not EBC; gravity is SG regardless of the display `gravityUnit`, which only affects `formatGravity` presentation). Binding: the pure adapter `statsToStyleVitals(CalculatedStats): RecipeVitals` is a **field pass-through** (`og`,`fg`,`abv`,`ibu`,`srm`) with **no `platoToSg`/`sgToPlato`/`ebcToSrm`/`srmToEbc` anywhere** (M38_P2's "no internal conversion" contract extended to the UI boundary).
- **RA-P3-3 — Placement deviation (binding): new `StyleTargetPanel` in `App.tsx`; `StatsHeader.tsx` NOT modified.** The panel (selector + gauges) is a **new component** rendered in `App.tsx` directly below `<StatsHeader/>` (line ~833), where `recipe` and `editor` are in scope. `StatsHeader.tsx` keeps its existing `{stats, equipment, config}` presentational contract untouched (it is display-only and reused in its own test file; threading recipe-editing through it would couple a display component to editor state and invalidate existing tests). The editor-view host is `App.tsx`, not a `RecipeEditor.tsx` file.
- **RA-P3-4 — "Real-time" semantics.** `editor.stats` is a `useMemo` in `useRecipeEditor` recomputed on **every recipe OR config change** (unconditional on save state). The panel derives its comparison via a `useMemo` keyed on `[bjcpStyleId, vitals]` where `vitals = statsToStyleVitals(stats)`. Because `App.tsx` re-renders on every `editor` state change and passes fresh `stats`/`bjcpStyleId`, editing any gravity/ABV/IBU/color field flips the gauges **in the same render** — no debounce, no manual recompute, no separate "compare" button.
- **RA-P3-5 — Inclusive range semantics; P3 never re-implements thresholds.** M38_P2's `evaluateStyleMatch`/`isValueInRange` use inclusive `low <= value <= high` (both ends, no epsilon, no rounding). P3 consumes `VitalMatchResult.inRange` and the composite `verdict`/`allInRange` fields **verbatim**; it does not recompute ranges or boundaries. A vital exactly equal to `low` or `high` is **in range**. A vital value `low - 0.001` or `high + 0.001` is **out of range**. Test expectations must be derived from the live `BJCP_STYLES` entries (read the real style's `low`/`high` in-test), never from hardcoded numbers that could drift from the dataset (M38_P2 Amendment 1 lesson).
- **RA-P3-6 — Style selector is a constrained `ui/Select`, flat 86 options + null.** The selector uses the `components/ui` `Select` primitive (primitive-only rule, M38 AC-20 precedent). It renders 86 options labeled `"{id} — {name}"` (dataset order) plus a leading null option labeled `"No BJCP Style"` (value `''`). Selecting the null option writes `null`. An unknown/absent stored `bjcpStyleId` (e.g. from a value not in the dataset) yields a **neutral "unknown style"** state — the selector shows no matching option but the panel never fabricates a match.
- **RA-P3-7 — Recipe Library in-range gauges are OUT of scope for P3 and explicitly deferred.** The milestone outcome sentence also names "and Recipe Library", but P3 is scoped to the Recipe Designer only. The library gauge surface, and the `RecipeSummary.bjcpStyleId` addition it would require, are **deferred** to a later milestone/phase (recorded in the roadmap Deferred section and here); they are not silently ballooned into P3.
- **RA-P3-8 — Folder datalist source & refresh.** The editor has no folder source (the library's folder tabs live inside `RecipeLibrary.tsx`; `App.tsx` holds no summary list). Binding: on **editor entry** (a `useEffect` that runs when the editor view is active and `editor.recipe` is non-null, i.e. when the editor first opens/opens a recipe), the editor calls the existing `listRecipes()` (no args) once, derives distinct folder names via the pure `distinctFolderNames(summaries)`, and stores them in local state; the folder `ui/Input` gains `list="folder-suggestions"` and a `<datalist id="folder-suggestions">` is rendered with those names. Free-text entry of a new folder still works (datalist is a suggestion list, not a constraint — RA-1's free-text folder semantics are unchanged). Refresh = re-fetch on each editor entry (the editor unmounts/remounts across view switches). A **failed fetch degrades to an empty datalist** — the editor remains fully functional and shows **no error banner** (suggestions are an enhancement, not a gate).
- **RA-P3-9 — Fallback / no-match retention.** When `bjcpStyleId` is `null`/empty, or `evaluateStyleMatch` returns `found:false`, the panel shows a neutral hint and renders **no gauge rows, no verdict**. Per-vital `inRange` is `null` when the input is not present or the style is not found — P3 renders such a vital as a neutral "—" (unset) state, never as in-range or out-of-range, and never leaks a placeholder range. A real designed recipe always yields all five finite vitals, so `presentedCount === 5` and every gauge is either `in-range` or `out-of-range`; the neutral per-vital path exists only for defensive/hydration edge cases.
- **RA-P3-10 — Primitive-only usage & native datalist exemption.** The style selector is a `ui/Select`; the folder field stays a `ui/Input`; tag chips stay `ui/Badge`. `<datalist>`/`<option>` are **non-interactive native suggestion elements**, not controls, and have no UI primitive — their use inside the folder field is allowed and does not violate the "no raw controls" sweep (which targets buttons/selects/text inputs, not suggestion lists). The new `StyleTargetPanel` must itself contain **no raw `<select>`/`<input>`/`<button>`** — the selector is the only control and it is a `ui/Select`.
- **RA-P3-11 — No server-side dataset validation of `bjcpStyleId`.** The API package does not import the BJCP dataset; the DB column stores text. The repository only trims/empties-normalizes the value (`normalizeBjcpStyleId`, mirroring `normalizeFolder`). An invalid/unknown stored id is handled gracefully at read time by `evaluateStyleMatch` (`found:false` → neutral panel). The client selector constrains input to valid ids.

---

## 1. Data Schema & Contracts

### Exported Constants & Types (consumed, unchanged from M38_P2)
Imported by the web from the top-level `@truchabrew/calculations` barrel (already exported by name — no calculations change):
`BJCP_STYLES: readonly BJCPStyle[]`, `BJCPStyle`, `RangeSpec { low, high }`, `StyleVitalKey = 'og'|'fg'|'abv'|'ibu'|'srm'`, `RecipeVitals`, `VitalMatchResult`, `StyleMatchResult`, `StyleMatchVerdict = 'full'|'partial'|'none'`, `evaluateStyleMatch(styleId, vitals, styles?)`, `isValueInRange(value, range)`. `packages/calculations/**` is **NOT** authorized to change in P3 (the M38_P2 critic's optional `Readonly<BJCPStyle>` hygiene note is not needed: P3 only reads style fields and never mutates the dataset).

### Modified Shared Types
- `Recipe` (`brewing.ts`): add **optional** `bjcpStyleId?: string | null` — comment mirrors the `folder`/`tags` optionality rationale (RA-8).
- `RecipeWriteInput` (`api.ts`): add **optional** `bjcpStyleId?: string | null`.
- `RecipeSummary` (`api.ts`): **UNCHANGED** in P3 (library surface deferred — RA-P3-7).

### DB Schema & Migration
- `recipes` table (`apps/api/src/db/schema.ts`): add `bjcpStyleId: text('bjcp_style_id')` — **nullable, no default** (`NULL` = no BJCP style; mirrors `folder`).
- New **additive** migration `apps/api/drizzle/0017_recipe_bjcp_style.sql`:
  `ALTER TABLE "recipes" ADD COLUMN "bjcp_style_id" text;`
  Applied via the drizzle migrator (`apps/api/src/db/migrate.ts` reads `apps/api/drizzle`). Existing rows backfill to `NULL` (no BJCP style) with zero data loss. The drizzle `meta/_journal.json` (+ a new snapshot entry) are updated by the standard generate step and are authorized artifacts of this migration.

### API Validator
- `recipeWriteBodySchema` (`apps/api/src/routes/schemas.ts`): add optional property `bjcpStyleId: { type: ['string', 'null'], maxLength: 20 }`. **Not** added to the `required` array (it is fully optional, following the `folder`/`tags` precedent, not the required-nullable `mashProfileId` pattern). `additionalProperties: false` means this MUST be declared or a client sending it would 400.

### Repository (`apps/api/src/repositories/recipeRepository.ts`)
- Add pure `normalizeBjcpStyleId(value: string | null | undefined): string | null` — trims; `null`/`undefined`/`''` (after trim) → `null`; else the trimmed string (mirror of `normalizeFolder`, no dataset membership check — RA-P3-11).
- `createRecipe`: add `bjcpStyleId: normalizeBjcpStyleId(input.bjcpStyleId)` to the `recipes` insert.
- `updateRecipe`: add `bjcpStyleId: normalizeBjcpStyleId(input.bjcpStyleId)` to the `.set(...)` (a full-replace PUT: omitted/empty/null sets the column to `NULL`, never leaves a stale value).
- `duplicateRecipe`: add `bjcpStyleId: source.bjcpStyleId ?? null` to the insert (carries forward unchanged, like `folder`/`tags`, RA-3 pattern).
- `assembleStoredRecipe`: spread `bjcpStyleId: row.bjcpStyleId ?? null` onto the `toStoredRecipe(...)` return — **inside `recipeRepository.ts`**, exactly as M38_P1 added `folder`/`tags` there rather than editing `mappers/recipeMapper.ts` (which stays untouched).
- `listRecipeSummaries`/`RecipeSummary`: **UNCHANGED** (column not selected; deferred — RA-P3-7).

### Editor Hook (`apps/web/src/hooks/useRecipeEditor.ts`)
- `toWriteInput`: add `bjcpStyleId: recipe.bjcpStyleId ?? null` (always emitted, never omitted, so `isDirty` reacts like every other field — M38_P1 AC-17 pattern).
- The two `Recipe` literals (`EMPTY_RECIPE_FOR_STATS`, `startNewRecipe`) add `bjcpStyleId: null` (mirrors `folder: null`/`tags: []`). `isDirty`/`save`/`loadRecipe` otherwise unchanged (they operate through `toWriteInput` and the server's `StoredRecipe` response, which now carries `bjcpStyleId`).

### New UI Components & Utils (contracts)
- `apps/web/src/components/StyleTargetPanel.tsx` — presentational-ish but stateful via callbacks:
  - Props: `{ bjcpStyleId: string | null; stats: CalculatedStats; onStyleChange: (bjcpStyleId: string | null) => void }`.
  - Internal: `vitals = statsToStyleVitals(stats)` (memo on `stats`); `match = evaluateStyleMatch(bjcpStyleId ?? '', vitals)` (memo on `[bjcpStyleId, vitals]`).
  - Renders a `ui/Select` (`aria-label="BJCP Style"`) with the 86 dataset options plus the `''`→null option; `onChange` maps `''`→`null` else the id and calls `onStyleChange`.
  - Renders the gauge rows + verdict per the render contract in §2.
- `apps/web/src/utils/styleTargets.ts` — pure: `statsToStyleVitals(stats: CalculatedStats): RecipeVitals` (field pass-through of `og`,`fg`,`abv`,`ibu`,`srm`; see §2).
- `apps/web/src/utils/folderSuggestions.ts` — pure: `distinctFolderNames(summaries: RecipeSummary[]): string[]` (see §2).

### Symbol Inventory
- **NEW source**: `StyleTargetPanel.tsx`, `utils/styleTargets.ts`, `utils/folderSuggestions.ts`, `drizzle/0017_recipe_bjcp_style.sql`.
- **NEW generated**: `drizzle/meta/_journal.json` entry, `drizzle/meta/0017_snapshot.json`.
- **MODIFIED source**: `packages/shared-types/src/brewing.ts`, `packages/shared-types/src/api.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/routes/schemas.ts`, `apps/api/src/repositories/recipeRepository.ts`, `apps/web/src/hooks/useRecipeEditor.ts`, `apps/web/src/App.tsx`.
- **MODIFIED tests**: `apps/web/test/App.test.tsx`, `apps/web/test/useRecipeEditor.test.tsx`, `apps/web/test/uiPrimitives.test.tsx`, `apps/api/test/recipes.crud.test.ts`.
- **NEW tests**: `apps/web/test/StyleTargetPanel.test.tsx`, `apps/web/test/styleTargets.test.ts`, `apps/web/test/folderSuggestions.test.ts`.
- **UNTOUCHED (explicit)**: `packages/calculations/**` (all), `packages/shared-types/src/brewing.ts`'s other types, `mappers/recipeMapper.ts`, `StatsHeader.tsx`, `RecipeLibrary.tsx`, `TopBar.tsx`, `Sidebar.tsx`, all `apps/web/src/components/ui/**` (no primitive changes), `apps/api/drizzle/0000..0016_*.sql` + their `meta` snapshots (only the new 0017 + journal entry), and every other source/test file in the repo.

---

## 2. Transformations & Pure Logic

### Pure Function Contracts
- `statsToStyleVitals(stats: CalculatedStats): RecipeVitals`
  - Returns `{ og: stats.og, fg: stats.fg, abv: stats.abv, ibu: stats.ibu, srm: stats.srm }`. Every field is a finite number (a `CalculatedStats` from a real recipe always has all five). **No unit conversion** (RA-P3-2). Deterministic; never throws; never returns `null` fields for a real recipe (though the `RecipeVitals` type allows it).
- `distinctFolderNames(summaries: RecipeSummary[]): string[]`
  - Collects each non-null, non-empty `summary.folder`; dedupes by **exact, case-sensitive** string equality (first occurrence's casing wins, matching `RecipeLibrary.tsx`'s `folderTabs` semantics); sorts ascending via `localeCompare`. Returns `[]` for empty/`null`/all-unfiled input. Never returns `null` or `''` entries.
- `normalizeBjcpStyleId(value: string | null | undefined): string | null` (repository)
  - As in §1. Deterministic trim + empty→null.

### No-Match / Fallback Contracts
- `evaluateStyleMatch(bjcpStyleId ?? '', vitals)` with no style (`''` or `null`) returns `found:false`, `style:null`, `verdict:null`, `allInRange:null`, every `inRange:null` — the panel's neutral state, **never** a fabricated range or verdict.
- Caller branching (StyleTargetPanel render):
  - `bjcpStyleId === null || bjcpStyleId === ''` OR `match.found === false` → render the neutral hint (`data-testid="style-neutral"`); **do not** render gauge rows or the verdict.
  - Otherwise (`found === true`): render exactly five vital rows and the verdict from `match`.
- Per-vital `VitalMatchResult`:
  - `present:true, inRange:boolean` (style found) → gauge `data-state` = `'in-range'` (when `inRange===true`) or `'out-of-range'` (when `inRange===false`).
  - `present:false` or `inRange:null` (defensive/hydration edge) → gauge `data-state` = `'unset'`, value shown as `—`; never green/red.
- Verdict label mapping (binding): `'full'` → `"Full Match"`, `'partial'` → `"Partial Match"`, `'none'` → `"No Match"`; `verdict === null` → no verdict element rendered. Verdict element `data-testid="style-verdict"`.

### Render Contract (StyleTargetPanel)
- Style `ui/Select`: value = `bjcpStyleId ?? ''`; option for the null case has value `''` and label `"No BJCP Style"`; the 86 dataset options have `value = style.id`, `label = \`${style.id} — ${style.name}\``. `aria-label="BJCP Style"`. `onChange` → `onStyleChange(value === '' ? null : value)`.
- Five gauge rows in fixed order `og, fg, abv, ibu, srm`, each `data-vital={key}` and `data-state` as above, displaying the vital's value and the style's inclusive `[low, high]` guideline range (from `match.vitals[key].low/high`).
- A `data-testid="style-verdict"` element carrying the mapped verdict when `found && presentedCount > 0`.
- A neutral container `data-testid="style-neutral"` when no style or unknown style.

### Stateful Integration Contract (App.tsx, editor view)
1. **Folder datalist state**: add `const [folderSuggestions, setFolderSuggestions] = useState<string[]>([])`.
2. **Fetch effect**: on editor entry (effect depending on the editor being active / `editor.recipe` becoming non-null), call `listRecipes()` (no args); on resolve `setFolderSuggestions(distinctFolderNames(data))`; on reject `setFolderSuggestions([])` (silent — no error banner, RA-P3-8).
3. **Folder input wiring**: the folder `ui/Input` (`aria-label="Folder"`, in the identity-card metadata strip) additionally gets `id="folder-suggestions-input"` and `list="folder-suggestions"`; its existing `value`/`onChange` free-text wiring is unchanged. Render `<datalist id="folder-suggestions" data-testid="folder-suggestions">` with one `<option value={name} key={name}/>` per suggestion. (Only when the datalist has entries it may still render empty; an empty datalist is inert.)
4. **Style panel wiring**: after `<StatsHeader .../>` (line ~833), render `<StyleTargetPanel bjcpStyleId={recipe.bjcpStyleId ?? null} stats={editor.stats} onStyleChange={(id) => editor.setRecipe((prev) => (prev ? { ...prev, bjcpStyleId: id } : prev))} />`. `recipe.bjcpStyleId` derives from the loaded/edited recipe; `editor.stats` is the live `CalculatedStats`.
5. **Lockstep sync**: because `stats` and `bjcpStyleId` both come from `editor` state and the panel derives via `useMemo`, a gravity/ABV/IBU/color edit and a style change each recompute the panel in the same render; the folder datalist is static within an editor session (mount-time fetch), which is correct because free-text entry is still allowed.

### Refactoring & Legacy Cleanup
- **No obsolete registration loops or legacy aliases to purge.** The recipe write path is a single `RecipeWriteInput` full-replace PUT/POST; adding `bjcpStyleId` to `toWriteInput`, the schema validator, and the two repository write sites is the complete, non-duplicated path. `recipeMapper.ts` is deliberately left alone (M38_P1 precedent). No existing type, constant, or control is removed or renamed. The `EMPTY_RECIPE_FOR_STATS` and `startNewRecipe` literals gain the field to keep the new `isDirty` field stable across fresh and loaded recipes.

---

## 3. Acceptance Criteria & Test Matrix

Baseline (M38_P2 Layer 1, authoritative): **2,539 passed / 2 skipped across 127 files**. P3 must exceed this total (executor's own + new suites). Typecheck (4/4 packages), build, and lint all exit 0 with **no new** warnings/errors (existing fast-refresh warnings may remain).

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | `bjcpStyleId` optional type added to `Recipe` and `RecipeWriteInput` | Unit/Type | Both declare `bjcpStyleId?: string \| null`; a `Recipe`/`RecipeWriteInput` literal without it typechecks (RA-8 — no fixture sweep). |
| AC-2 | Migration additive + nullable, no default | Migration | `0017_recipe_bjcp_style.sql` = `ALTER TABLE "recipes" ADD COLUMN "bjcp_style_id" text;`; applies cleanly over the 0016 state; existing (seed) rows read back `bjcpStyleId: null`. |
| AC-3 | `recipes` schema column added | Unit/Type | `recipes` in `apps/api/src/db/schema.ts` declares `bjcpStyleId: text('bjcp_style_id')` nullable, no default. |
| AC-4 | POST /api/recipes persists `bjcpStyleId` | API | Create with `bjcpStyleId: '21A'` returns `bjcpStyleId: '21A'`; refetch (GET /:id) returns `'21A'`. |
| AC-5 | Omitted / null / empty `bjcpStyleId` → stored `null` | API | Create omitting the field, with `null`, and with `''` each yield `bjcpStyleId: null` (RA-P3-1 / normalize). |
| AC-6 | PUT /api/recipes/:id updates `bjcpStyleId` | API | Update to `'1C'` persists; clearing (empty/null) sets the DB column back to `NULL` (full-replace, no stale value). |
| AC-7 | Duplicate carries `bjcpStyleId` forward | API | Duplicating a recipe with `bjcpStyleId: '21A'` yields a copy with `bjcpStyleId: '21A'`. |
| AC-8 | GET /api/recipes summary list unaffected | API | `listRecipeSummaries`/`GET /api/recipes` response objects have **no** `bjcpStyleId` key (deferred — RA-P3-7), and folder/tags/other summary fields are unchanged. |
| AC-9 | Recipe validator accepts optional `bjcpStyleId` | API | POST/PUT body including `bjcpStyleId: '21A'` passes `recipeWriteBodySchema` (not 400); a body omitting it still passes; `bjcpStyleId: 'x'.repeat(30)` is 400 VALIDATION_FAILED (maxLength 20). |
| AC-10 | `normalizeBjcpStyleId` pure semantics | Unit | `' 21A '`→`'21A'`; `''`→`null`; `'   '`→`null`; `null`→`null`; `undefined`→`null`. No membership validation (RA-P3-11). |
| AC-11 | Editor `toWriteInput` always emits `bjcpStyleId ?? null` | Unit (hook) | Loaded recipe without the field → `toWriteInput` output has `bjcpStyleId: null`; changing it dirties the editor; saving resets `isDirty` (M38_P1 AC-17 pattern). |
| AC-12 | Fresh recipe starts `bjcpStyleId: null` | Unit (hook) | `startNewRecipe` and `EMPTY_RECIPE_FOR_STATS` initialize `bjcpStyleId: null`; not dirty on creation. |
| AC-13 | Save → reload round-trips `bjcpStyleId` | Integration (App) | Set style in editor, save, close, reopen → Select shows the same style; `bjcpStyleId` intact. |
| AC-14 | `statsToStyleVitals` passes five vitals through unchanged | Unit | For a `CalculatedStats` with known `og/fg/abv/ibu/srm`, output equals those exact five values (no conversion — RA-P3-2); source not mutated. |
| AC-15 | `statsToStyleVitals` returns no conversion code path | Unit (source) | `styleTargets.ts` references no `*To*` conversion function and imports none from calculations' conversion surface. |
| AC-16 | `distinctFolderNames` distinct + sorted + excludes unfiled | Unit | `[IPAs, Lagers, IPAs, null, '']`-style summaries → `['IPAs','Lagers']` (case-sensitive distinct, `localeCompare` order, null/'' excluded); empty input → `[]`. |
| AC-17 | StyleTargetPanel selector lists 86 + null option | Component | Select `aria-label="BJCP Style"` offers `"No BJCP Style"` plus 86 options; each non-null option label matches `"{id} — {name}"` from `BJCP_STYLES`; values are dataset ids. |
| AC-18 | Selecting a style calls `onStyleChange(id)`; null option calls `onStyleChange(null)` | Component | `fireEvent.change` on the null option → `onStyleChange(null)`; on a style option → `onStyleChange('<id>')`. |
| AC-19 | All-five-vitals gauges render when style found | Component | With `bjcpStyleId` set to a dataset id and a full `CalculatedStats`, exactly five rows `data-vital=og/fg/abv/ibu/srm` render, each `data-state` ∈ `in-range`/`out-of-range`. |
| AC-20 | In-range at inclusive lower bound | Component (boundary) | For a style `S` read live from `BJCP_STYLES`, set the matching vital to `S.og.low` → OG gauge `data-state="in-range"`. |
| AC-21 | Out-of-range just below lower bound | Component (boundary) | Same style, OG `= S.og.low - 0.001` → `data-state="out-of-range"`; and at `S.og.low + 0.001` → `in-range` (no epsilon). |
| AC-22 | In-range at inclusive upper bound | Component (boundary) | Set the vital to `S.ibu.high` → IBU gauge `in-range`; at `S.ibu.high + 0.001` → `out-of-range`. |
| AC-23 | Out-of-range vital is red / in-range is green (distinct states) | Component | Per-vital `data-state` drives distinct visual classes; assert the mapping (out→red-*, in→emerald/green-*) from the rendered className/state, not from arbitrary text. |
| AC-24 | Verdict full match | Component | A vitals set entirely within a live style's ranges → `style-verdict` text `"Full Match"`. |
| AC-25 | Verdict partial match | Component | A vitals set with ≥1 in-range and ≥1 out-of-range → `"Partial Match"`. |
| AC-26 | Verdict no match | Component | A vitals set with every vital out-of-range → `"No Match"`. |
| AC-27 | Neutral state when no style selected | Component | `bjcpStyleId: null` → `style-neutral` present; **no** gauge rows, **no** `style-verdict`. |
| AC-28 | Neutral state for unknown style id | Component | `bjcpStyleId: 'ZZ9'` (not in dataset) → `style-neutral` present; no gauges, no verdict; no fabricated range (evaluateStyleMatch `found:false`). |
| AC-29 | Real-time recompute on vitals change | Component | Render with `bjcpStyleId='S'`; rerender with an OG edited from in-range to out-of-range → OG gauge flips state without changing `bjcpStyleId` (recompute on `stats` change). |
| AC-30 | Real-time recompute on style change | Component | Keep stats fixed, switch `bjcpStyleId` from a style where OG is in-range to one where it is out-of-range → OG gauge flips (recompute on style change). |
| AC-31 | Selecting a BJCP style does NOT write `styleName` | Integration (App) | Change the BJCP Select → `recipe.bjcpStyleId` updates and `recipe.styleName` is unchanged (RA-P3-1 decoupling). |
| AC-32 | Folder datalist offers existing folder names on editor entry | Integration (App) | Mock `listRecipes()` to return summaries with folders `['IPAs','Lagers']` → opening the editor renders `<datalist data-testid="folder-suggestions">` with option values `IPAs`,`Lagers` (and the folder input carries `list="folder-suggestions"`). |
| AC-33 | Folder datalist excludes unfiled and free text still allowed | Integration (App) | Summaries include a null-folder recipe → not in datalist; typing a brand-new folder into the Folder input still sets `recipe.folder` and persists (datalist is not a constraint). |
| AC-34 | Folder fetch failure degrades silently | Integration (App) | Mock `listRecipes()` to reject → editor opens normally, datalist has zero options, no error banner, folder field functional. |
| AC-35 | UI-primitive-only usage | Verification (source) | `StyleTargetPanel.tsx` contains no raw `<select>`/`<input>`/`<button>` (selector is `ui/Select`); `App.tsx` editor header gains **no** new raw controls; existing M38 AC-20 primitive-adherence assertions still pass (only `ui/Select`, `ui/Input`, native `<datalist>`/`<option>` suggestion elements added). `StatsHeader.tsx` is not modified. |
| AC-36 | Layer 1 gates | Verification | `pnpm test` total **> 2,539 passed / 2 skipped** (monotonic increase across 127 files, exit 0); typecheck 4/4 exit 0; build exit 0 (no new warnings); lint 0 errors, no new warnings (existing fast-refresh warnings only). |
| AC-37 | Scope Guardrail — SHA-256 content-manifest diff | Verification | **`git diff --name-only` is NOT viable in this repo** (no meaningful base commit covering this work), so scope is enforced by a **pre/post-execution SHA-256 content-manifest diff**: the executor captures `git ls-files -co --exclude-standard -z | xargs -0 sha256sum` immediately **before the first edit** and again **after the final edit**. The diff between the two manifests must show **exactly** the Authorized Files below added/changed and **zero** other paths. Authorized: NEW — `apps/web/src/components/StyleTargetPanel.tsx`, `apps/web/src/utils/styleTargets.ts`, `apps/web/src/utils/folderSuggestions.ts`, `apps/web/test/StyleTargetPanel.test.tsx`, `apps/web/test/styleTargets.test.ts`, `apps/web/test/folderSuggestions.test.ts`, `apps/api/drizzle/0017_recipe_bjcp_style.sql` (+ drizzle `meta/_journal.json` entry + `meta/0017_snapshot.json`); MODIFIED — `packages/shared-types/src/brewing.ts`, `packages/shared-types/src/api.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/routes/schemas.ts`, `apps/api/src/repositories/recipeRepository.ts`, `apps/api/test/recipes.crud.test.ts`, `apps/web/src/hooks/useRecipeEditor.ts`, `apps/web/src/App.tsx`, `apps/web/test/App.test.tsx`, `apps/web/test/useRecipeEditor.test.tsx`, `apps/web/test/uiPrimitives.test.tsx`. Every file outside this list must be byte-identical between the two manifests. `packages/calculations/**`, `StatsHeader.tsx`, `mappers/recipeMapper.ts`, `RecipeLibrary.tsx`, `apps/web/src/components/ui/**`, and `apps/api/drizzle/0000..0016_*.sql` are explicitly among the must-be-untouched paths. |

---
> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
