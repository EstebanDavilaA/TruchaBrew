# FEATURE SPECIFICATION: M24_P1 — One Visual Language (Button/Input Token Sweep + Metadata Contrast)

## Phase Summary

Milestone 24's roadmap entry carries **two independent workstreams**: (1) a button/input design-token sweep, and (2) standardizing user-facing vocabulary on "Profile" instead of "Schedule". The roadmap left the split to `/plan` ("Estimated phases: 1–2, TBD at `/plan`").

**This phase covers workstream (1) only.** Workstream (2) becomes **M24_P2**. The rationale is recorded in §0 below and is binding on how the roadmap's "Estimated phases" line reads after this spec.

What a brewer sees when this phase lands: a primary button on the Sensory Evaluation panel, the Post-Brew Calibration modal, the Recipe Import modal and the Water Calculator modal are literally the same button — same corner radius, same weight, same disabled treatment — instead of four lookalikes that drift by a radius step and a font weight. Number and text inputs across Batch Detail, Sensory Evaluation, Split Packaging and the Water Calculator resolve to one input treatment (plus one deliberate compact variant for dense log rows). And the small grey metadata text that currently sits at `slate-500` (a ~4.0:1 ratio against the app's `slate-900` surfaces — below the WCAG AA 4.5:1 floor for small text) moves to `slate-400` (~7.0:1) everywhere it appears as text.

### Key Behaviors

1. `designSystem.ts` gains five new frozen class-string constants (`BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `FORM_SELECT_COMPACT_CLASS`) and changes exactly one existing string (`METADATA_TEXT_CLASS`). Export count goes 17 → 22.
2. Every file in the **drift set** (§1.3 — the seven files that today declare their *own* local button/input/select class-string constant) deletes that local constant and imports the shared token instead. After this phase, `designSystem.ts` is the only file in `apps/web/src` that declares a button, input, or select class-string constant.
3. All 76 inline `text-slate-500` occurrences in `apps/web/src` (plus the one inside `METADATA_TEXT_CLASS`) become `text-slate-400`. `text-slate-600` is deliberately **not** swept (RA-7).
4. Two existing M23_P1 palette-survival test blocks are structurally coupled to the literals that this phase deletes and are reconciled, not deleted (RA-9, AC-24/AC-25).
5. Zero behavioral change. No component gains, loses, or reorders a control; no handler, no state, no data flow, and no API call is touched. This is a styling-source-of-truth refactor plus one color-value change.

---

## §0. Phase-split decision (binding on scope)

**Decision: this phase is the token sweep + contrast fix. Naming standardization is M24_P2.**

Four reasons, from what is actually on disk:

1. **Different verification instruments.** This workstream is verified by exact-string equality pins plus a cross-file source sweep (the `designSystem.test.ts` AC-20 `walk()` precedent). The naming workstream is verified by a file-by-file, line-by-line enumerated copy matrix — precisely *because* a global grep for zero "Schedule" occurrences is a milestone failure (the roadmap says so, and §0.1 below confirms it with counts). Fusing them produces one matrix in which a red gate cannot be attributed.
2. **Diagnosability under rule 4.** Both workstreams touch four of the same files (`MashProfileForm.tsx`, `FermentationProfileForm.tsx`, `MashProfileManager.tsx`, `FermentationProfileManager.tsx` all carry inline `bg-amber-600` primary buttons *and* "Schedule" copy). A single failing render assertion in a combined phase is ambiguous between "the token canonicalization changed the markup" and "the copy change broke the query" — the same argument the roadmap itself uses to keep the Modal wrapper and the router in separate milestones.
3. **Ordering.** The token sweep rewrites `className` attributes on the Manager/Form files. Doing naming first would re-open the same lines twice. Tokens first, copy second, is strictly cheaper.
4. **Net-new test authorship is its own risk class.** M24_P2 must write `MashProfileForm.test.tsx` and `FermentationProfileForm.test.tsx` **from scratch** (confirmed: `apps/web/test/` contains `EquipmentForm.test.tsx` and `WaterProfileForm.test.tsx` but no `*ProfileForm.test.tsx` for mash/fermentation). Authoring two new suites is a different activity from a mechanical refactor and does not belong in the same acceptance surface.

### §0.1 Findings handed forward to M24_P2 (not built in this phase)

Recorded here so M24_P2's planner does not re-derive them, and so this phase's critic does not read them as misses:

- **The naming drift set is 7 src files, not the roadmap's 5.** Beyond `Sidebar.tsx`, `MashProfileForm.tsx`, `FermentationProfileForm.tsx`, `MashProfileManager.tsx`, `FermentationProfileManager.tsx`, two more carry user-facing entity-label uses: `MashSection.tsx` (8 occurrences — including `"create one from the Mash Schedules manager"` at :59 and `"the Fermentation Schedules manager"` at :184, which name *screens* and must follow the screen rename) and `App.tsx` (:99 `'Failed to load mash schedules.'`, :110 `'Failed to load fermentation schedules.'` — user-visible error copy).
- **The test drift set is 5 test files, not the roadmap's 4.** `TopBar.test.tsx:55` asserts `const navLabels = ['Recipes', 'Equipment Profiles', 'Mash Schedules', 'Fermentation Schedules', 'Batches']`. Renaming `Sidebar.tsx`'s `NAV_ITEMS` labels breaks it. Missing this would put M24_P2's Layer 1 red. Counts per file: `App.test.tsx` 16, `FermentationProfileManager.test.tsx` 20, `MashProfileManager.test.tsx` 19, `Sidebar.test.tsx` 2, `TopBar.test.tsx` 1.
- **Internal identifiers are already on "Profile."** `Sidebar.tsx`'s `NavDestination` values are already `mashProfiles` / `fermentationProfiles`; the API is already `/api/mash-profiles`. The roadmap's "and internal identifiers" clause is already satisfied — only display strings are left.
- **`test/helpers/fixtures.ts`'s `'Test Mash Schedule'` / `'Test Fermentation Schedule'` are fixture *data values*, not copy.** Some of the "~57" assertions match those fixture names rather than app copy. Recommend M24_P2 leave the fixtures alone and treat ~57 as an upper bound rather than a target line count.
- **Preserve deliberately** (ordered-step-sequence sense, correct brewing English): `BrewSheet.tsx:167` "Mash Schedule", `BrewSheet.tsx:331` "Fermentation Schedule", `HopSection` "Hop Schedule", `BrewDayTracker.tsx:587` "Additions Schedule", `EquipmentForm.tsx:591` "Hopstand & Whirlpool Schedule", and all of `CellarActionFeed.tsx` / `calculateCellarSchedule` / `CellarScheduleEvent` (a schedule of dated cellar events).

---

## Resolved Ambiguities (Binding)

- **RA-1 — Canonical `designSystem.ts` path.** The module is `apps/web/src/components/designSystem.ts`, **not** `apps/web/src/utils/designSystem.ts`. Its test is `apps/web/test/designSystem.test.ts`. Import specifier from `components/*` is `'./designSystem'`; from `pages/*` it is `'../components/designSystem'` (the form `designSystem.test.ts:97` already pins for `BatchList`/`BatchDetail`).

- **RA-2 — "Drift set" means *declared local constants*, not every inline literal.** The roadmap estimated "~13–20 files carrying real local duplicates." The verified on-disk count of files declaring a local button/input/select class-string constant is **seven** (§1.3). Separately, 25 files carry *inline* `bg-amber-600 hover:bg-amber-500` literals across **17 mutually distinct class-string shapes**, and inline secondary buttons span 12+ distinct shapes. Normalizing that inline space is not a token sweep — it is a visual redesign of two dozen call sites with no single dominant target, and it is exactly what the roadmap's *Deferred / not scheduled* "Full-app design-token coverage" item exists to hold. **Binding: the seven files of §1.3 are the drift set. Inline literals in files outside §1.3 are out of scope and their presence is not a defect for this phase's critic.**

- **RA-3 — Inline literals *inside* the seven drift files are in scope.** Within the drift set only, a `className` that inlines the same role styling the file's now-deleted local constant expressed must also move to the token. Enumerated call-site-by-call-site in §1.4. This prevents the degenerate outcome where the constant is deleted and its string is pasted inline three lines down.

- **RA-4 — Canonical token values are chosen for minimum visual delta, and are layout-free.** Each token carries *role* styling only (surface, border, radius, text color, weight, padding, transition, cursor, disabled). It carries **no** layout utility (`flex`, `gap-*`, `w-full`, `block`, `mb-*`, `mt-*`, `items-*`) except where that utility is already part of the majority string being adopted verbatim (`INPUT_CLASS` keeps `block w-full` because 3 of 5 sites already declare it identically and dropping it would be a visual regression at all three). Call sites compose layout by template literal (RA-5).

- **RA-5 — Composition rule.** A call site MAY append utilities to a token via template literal (`` className={`${BUTTON_PRIMARY_CLASS} flex items-center gap-2`} ``). It MAY append utilities in an orthogonal property family (layout, `placeholder-*`, `w-*`, `text-left`). It MUST NOT append a utility that overrides a token-supplied property family — specifically not `bg-*`, `hover:bg-*`, `border-*` (color), `rounded-*`, `px-*`, `py-*`, `font-{medium,semibold,bold}`, `text-{white,slate-*}`, or `disabled:opacity-*`. A site needing a different value in an overridden family must instead use the compact variant, or be left out of scope. There is no third button tier in this phase.

- **RA-6 — Two compact variants are added, and this is a deliberate deviation from the roadmap's three-token list (D-1).** The roadmap named `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `INPUT_CLASS` only. On disk, two drift sites carry a genuinely denser control that is correct as-is: `ReadingLog.tsx`'s input sits in a dense inline log row (`text-sm px-2 py-1.5`, no `block w-full`), and `RecipeImportModal.tsx`'s local select is a compact toolbar select (`text-xs px-3 py-1.5`). Forcing them onto the standard tier is a visual regression, not a consistency win. They become `INPUT_COMPACT_CLASS` and `FORM_SELECT_COMPACT_CLASS`. **Both are still shared tokens** — the milestone's requirement (no file declares its own) holds.

- **RA-7 — `text-slate-600` is NOT swept; only `text-slate-500` is.** The roadmap text says "`text-slate-500/600` → `slate-400`". Verified on disk: `METADATA_TEXT_CLASS` is `'text-xs text-slate-500'` — the `600` tier does not appear in the token at all. All 13 inline `text-slate-600` occurrences are **decorative or non-informational**: empty-state glyph icons (`<Beaker className="w-8 h-8 ... text-slate-600" />` in `EquipmentManager`, `FermentationProfileManager`, `MashProfileManager`, `RecipeLibrary`, `WaterProfileManager`, `InventoryManager`, `BatchList`, `SettingsManager`), em-dash "no value" placeholders (`MashSection.tsx:133`, `:213`), directional arrows (`WaterCalculatorModal.tsx:590`, `:593`), and the unfilled-star state (`SensoryEvaluationPanel.tsx:91`). WCAG 1.4.3 does not apply to these. They are preserved deliberately, the same reasoning class as preserving "Hop Schedule" in M24_P2. **A critic finding of "13 `text-slate-600` remain" is expected and correct.**

- **RA-8 — The contrast fix covers inline occurrences, not just the token.** Changing `METADATA_TEXT_CLASS` alone reaches only the 4 files that import it, while 76 inline `text-slate-500` occurrences across 31 other files stay below the AA floor — i.e. the milestone's stated outcome ("Low-contrast metadata text is legible") would be false at the end of the phase. The sweep is therefore **all 77 occurrences** (76 inline + 1 in the token). Verified safe: zero occurrences co-occur with `print:`, `bg-white`, `bg-slate-50`, or `bg-slate-100`; zero opacity variants (`text-slate-500/NN`) exist; `placeholder-slate-500` (4 occurrences) and `border-slate-500/30` (in `STATUS_BADGE_CLASS.Completed`) share the substring `slate-500` but a different property prefix and MUST NOT be touched.

- **RA-9 — Two M23_P1 tests are structurally coupled to strings this phase deletes, and are reconciled in the same change.** Both read their component's source text and assert a literal that today lives inside the local constant being removed:
  - `RecipeImportModal.test.tsx:284` — `expect(SOURCE).toContain('bg-amber-600 hover:bg-amber-500 text-white')`; and `:299` — `SOURCE.split('\n').find((l) => l.includes('const FORM_SELECT_CLASS ='))` then `expect(line).toContain('bg-slate-800')`. After migration the local `const FORM_SELECT_CLASS =` line no longer exists, `find()` returns `undefined`, and `expect(undefined).toContain(...)` throws.
  - `WaterCalculatorModal.test.tsx:110` — same `toContain` on the amber triplet; and `:117-122` — the same `find()` pattern over `const INPUT_CLASS =` and `const SELECT_CLASS =`.

  **Binding reconciliation**: these assertions are **rewritten in place, not deleted**, to assert the invariant they were protecting (this file's controls are on the app-standard palette, not `amber-500`/`slate-950`) against the now-authoritative source: assert the file imports the relevant token from `./designSystem`, and assert the token's own value carries `bg-slate-800` and not `bg-slate-950` / `bg-amber-500 hover:bg-amber-400` / `text-slate-950`. The negative assertions in those same blocks (`not.toContain('text-slate-950')`, the `red-*` regex, the `bg-slate-950/60` grist-card survivor at `WaterCalculatorModal.test.tsx:126`) are **unchanged** — they still pass and must keep passing.

- **RA-10 — `FORM_SELECT_CLASS`'s existing string is not changed.** It stays `'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer'`, pinned unchanged at `designSystem.test.ts:38-40`. Note this leaves a *shape* divergence with the new `INPUT_CLASS` (`rounded-lg` + `focus:outline-none` vs `rounded-md` + `focus:ring-amber-500`). Harmonizing select-vs-input shape would change every select in the app and is **out of scope for this phase** — logged in §4 as a follow-up, not a defect.

- **RA-11 — `RecipeImportModal.tsx`'s local `FORM_SELECT_CLASS` shadows the designSystem export of the same name with a divergent value.** This is the purest instance of the drift this milestone exists to remove and is therefore in scope even though the roadmap's Hardening bullet says only "button/input". It becomes `FORM_SELECT_COMPACT_CLASS` (RA-6), which is a *different* name — after this phase no file re-declares an identifier that `designSystem.ts` also exports.

- **RA-12 — Accepted visual deltas.** The following are *intended* and must not be reported as regressions. Everything not listed here is pixel-identical.
  - `RecipeImportModal` + `WaterCalculatorModal` primary buttons: `font-bold` → `font-medium`, `rounded-xl` → `rounded-lg`, `shadow` dropped; `WaterCalculatorModal`'s primary additionally gains `disabled:opacity-50`.
  - `RecipeImportModal` + `WaterCalculatorModal` secondary buttons: `rounded-xl` → `rounded-lg`, gain `font-medium` and `disabled:opacity-50`.
  - `BatchDetail` secondary buttons: `px-3.5` → `px-4`.
  - `WaterCalculatorModal` inputs: `rounded-lg` → `rounded-md`, gain `shadow-sm` + `focus:ring-amber-500` + `block sm:text-sm`, `text-slate-100` retained; `placeholder-slate-500` is re-attached at the call site per RA-5.
  - `WaterCalculatorModal` selects: gain `text-sm` + `font-medium` + `disabled:opacity-50`, `text-slate-100` → `text-slate-200`; `w-full` re-attached at the call site.
  - All `text-slate-500` text → `text-slate-400` (the point of the contrast fix).
  - Zero visual delta at: `PostBrewCalibrationModal` (both buttons), `SensoryEvaluationPanel` (input + primary), `SplitPackagingPanel` (input), `BatchDetail` (input), `ReadingLog` (input) — these five adopt strings byte-identical to what they declare today.

- **RA-13 — Scope guardrail baseline is a SHA-256 content manifest, not `git diff`.** This repo has exactly **one** commit (`7d88e64`), and the entire `apps/web` tree is uncommitted working-tree/index content. `git diff --name-only <base>` against any meaningful base commit would report the whole application as changed and is therefore **not viable** as a scope guardrail here. AC-30 uses a pre/post content manifest instead (exact command in AC-30).

- **RA-14 — Zero behavior change is binding.** No `onClick`, `onChange`, `useState`, `useEffect`, API call, prop signature, or conditional-render branch may change. If a token migration appears to require a behavioral edit, that call site is dropped from scope and reported — it is not a license to refactor.

### Deviations from the roadmap text (flagged for sign-off)

- **D-1** — Five new tokens, not three (RA-6): the two compact variants are added so that `ReadingLog` and `RecipeImportModal` can leave local declarations without a visual regression.
- **D-2** — Drift set is 7 files, not "~13–20" (RA-2). The roadmap's estimate counted files with inline literals; the verified count of files declaring local constants is 7.
- **D-3** — Select-class constants are in scope (RA-11), though the roadmap's bullet named only button and input.
- **D-4** — The contrast fix sweeps 77 occurrences across 32 files, not only the token (RA-8); without this the milestone's own user-visible outcome is not achieved.
- **D-5** — `text-slate-600` is excluded (RA-7), contradicting the roadmap's literal "`text-slate-500/600`" phrasing, on decorative-usage evidence.
- **D-6** — Naming standardization is deferred to M24_P2 (§0); the roadmap's "Estimated phases: 1–2, TBD at `/plan`" resolves to **2**.

---

## 1. Data Schema & Contracts

### 1.1 Exported constants — `apps/web/src/components/designSystem.ts`

**NEW (5).** Exact strings, binding by equality:

| Symbol | Exact value |
|---|---|
| `BUTTON_PRIMARY_CLASS` | `bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50` |
| `BUTTON_SECONDARY_CLASS` | `bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50` |
| `INPUT_CLASS` | `shadow-sm bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:ring-amber-500 focus:border-amber-500 block w-full sm:text-sm px-3 py-2` |
| `INPUT_COMPACT_CLASS` | `shadow-sm bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:ring-amber-500 focus:border-amber-500 text-sm px-2 py-1.5` |
| `FORM_SELECT_COMPACT_CLASS` | `bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer` |

Provenance (each value is the already-dominant existing convention, per the M13_P1 §3.4 D-1 precedent, not a new aesthetic): `BUTTON_PRIMARY_CLASS` is byte-identical to the strings already declared in `PostBrewCalibrationModal.tsx:7` and `SensoryEvaluationPanel.tsx:10`. `BUTTON_SECONDARY_CLASS` is byte-identical to `PostBrewCalibrationModal.tsx:9`. `INPUT_CLASS` is byte-identical to the string declared identically at `SensoryEvaluationPanel.tsx:8`, `SplitPackagingPanel.tsx:8`, and `BatchDetail.tsx:98`. `INPUT_COMPACT_CLASS` is byte-identical to `ReadingLog.tsx:27`. `FORM_SELECT_COMPACT_CLASS` is byte-identical to `RecipeImportModal.tsx:11`.

**MODIFIED (1):**

| Symbol | Before | After |
|---|---|---|
| `METADATA_TEXT_CLASS` | `text-xs text-slate-500` | `text-xs text-slate-400` |

**UNTOUCHED (16), values unchanged and their `designSystem.test.ts` pins unchanged:** `CARD_CLASS`, `CARD_STACK_GAP_CLASS`, `SUBPANEL_CLASS`, `SECTION_HEADING_CLASS`, `SUBSECTION_HEADING_CLASS`, `BODY_TEXT_CLASS`, `FORM_SELECT_CLASS`, `SETTINGS_ROW_CLASS`, `METRIC_TILE_CLASS`, `METRIC_LABEL_CLASS`, `METRIC_VALUE_CLASS`, `EMPTY_STATE_CLASS`, `LOADING_STATE_CLASS`, `ERROR_STATE_CLASS`, `STATUS_BADGE_WRAPPER_CLASS`, `STATUS_BADGE_CLASS`.

**Export count: 17 → 22.** All new exports are `string` literals. No new type, no `Record`, no function, no component, no hook, no side effect — `designSystem.test.ts:44-49` ("module exports no React component and no hook") must continue to pass **unmodified**.

### 1.2 Types

None added, none changed. This phase introduces no interface, no type alias, and no prop-signature change anywhere.

### 1.3 The drift set — 7 files, 12 local constants to delete

| # | File | Local constants declared today | Replaced by |
|---|---|---|---|
| 1 | `src/components/PostBrewCalibrationModal.tsx` | `BUTTON_PRIMARY_CLASS` (:6-7), `BUTTON_SECONDARY_CLASS` (:8-9) | `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS` |
| 2 | `src/components/ReadingLog.tsx` | `INPUT_CLASS` (:26-27) | `INPUT_COMPACT_CLASS` |
| 3 | `src/components/RecipeImportModal.tsx` | `BUTTON_PRIMARY_CLASS` (:9), `BUTTON_SECONDARY_CLASS` (:10), `FORM_SELECT_CLASS` (:11) | `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `FORM_SELECT_COMPACT_CLASS` |
| 4 | `src/components/SensoryEvaluationPanel.tsx` | `INPUT_CLASS` (:7-8), `BUTTON_PRIMARY_CLASS` (:9-10) | `INPUT_CLASS`, `BUTTON_PRIMARY_CLASS` |
| 5 | `src/components/SplitPackagingPanel.tsx` | `INPUT_CLASS` (:7-8) | `INPUT_CLASS` |
| 6 | `src/components/WaterCalculatorModal.tsx` | `BUTTON_PRIMARY_CLASS` (:17), `BUTTON_SECONDARY_CLASS` (:18), `INPUT_CLASS` (:19), `SELECT_CLASS` (:20) | `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `INPUT_CLASS`, `FORM_SELECT_CLASS` |
| 7 | `src/pages/BatchDetail.tsx` | `INPUT_CLASS` (:97-98), `BUTTON_SECONDARY_CLASS` (:100-101) | `INPUT_CLASS`, `BUTTON_SECONDARY_CLASS` |

Because every local identifier is replaced by an import of the **same name** (except `ReadingLog`'s `INPUT_CLASS` → `INPUT_COMPACT_CLASS`, `RecipeImportModal`'s `FORM_SELECT_CLASS` → `FORM_SELECT_COMPACT_CLASS`, and `WaterCalculatorModal`'s `SELECT_CLASS` → `FORM_SELECT_CLASS`), the majority of call sites need no edit at all — only the declaration block changes to an import. Line numbers above are as-found and are advisory; the constant names are binding.

### 1.4 In-scope call-site rewrites within the drift set (RA-3)

Only these, and only where the site expresses the same role as a deleted constant:

- `WaterCalculatorModal.tsx` — the input call sites re-attach `placeholder-slate-500` via RA-5 composition; the select call sites re-attach `w-full` via RA-5 composition.
- `RecipeImportModal.tsx` — any `className` inlining the amber primary or slate secondary triplet moves to the token (the file today has 1 inline `bg-amber-600 hover:bg-amber-500` occurrence in addition to the constant).
- `ReadingLog.tsx`, `SensoryEvaluationPanel.tsx`, `PostBrewCalibrationModal.tsx`, `SplitPackagingPanel.tsx`, `BatchDetail.tsx` — inline occurrences of the exact string the file's own deleted constant carried move to the token. Any inline button/input string in these files that is **not** byte-equal to a deleted constant's value and would require overriding a token-supplied property family (RA-5) is **left alone** and listed by the executor in its completion report.

### 1.5 Files modified vs. untouched — explicit inventory

**Modified — source (9):** `designSystem.ts`, plus the 7 drift-set files of §1.3, plus **every file in the §1.6 contrast list** (which overlaps the drift set; the union is 33 source files).

**Modified — tests (4):** `test/designSystem.test.ts` (token pins), `test/RecipeImportModal.test.tsx` (RA-9 reconcile), `test/WaterCalculatorModal.test.tsx` (RA-9 reconcile), and **one new file** `test/designTokens.test.ts` (§3 sweep suite).

**Explicitly untouched — must be byte-identical at AC-30:** `test/ScopeGuardrail.test.tsx`, `test/accessibilityAndPolish.test.tsx`, `test/App.test.tsx`, `test/Sidebar.test.tsx`, `test/TopBar.test.tsx`, `test/BatchDetail.test.tsx`, `test/MashProfileManager.test.tsx`, `test/FermentationProfileManager.test.tsx`, `test/helpers/fixtures.ts`, `test/ReadingLog.test.tsx`, `test/SensoryEvaluationPanel.test.tsx`, `test/SplitPackagingPanel.test.tsx`, `test/PostBrewCalibrationModal.test.tsx`, `src/components/Sidebar.tsx`, `src/components/MashSection.tsx`, `src/hooks/useRecipeEditor.ts`, `packages/calculations/**`, `packages/shared-types/**`, `apps/api/**`, `.gsd/**` (other than this spec and `STATE.json`/`ROADMAP.md`), `CLAUDE.md`, `.claude/**`, `.agents/**`.

> `src/components/Sidebar.tsx` and `src/components/MashSection.tsx` appear on the untouched list *even though* `MashSection.tsx` carries 3 `text-slate-500` occurrences. **Correction to that reading:** they are untouched with respect to *naming* (M24_P2). `MashSection.tsx` IS in the §1.6 contrast list. `Sidebar.tsx` has zero `text-slate-500` occurrences and is untouched outright.

### 1.6 Contrast sweep target list (RA-8) — 32 files, 77 occurrences

`components/`: `InventoryManager.tsx` (6), `SensoryEvaluationPanel.tsx` (5), `RecipeImportModal.tsx` (5), `BatchNutritionPanel.tsx` (5), `RefractometerFermentationModal.tsx` (4), `MashProfileForm.tsx` (4), `EquipmentForm.tsx` (4), `StockCheckPanel.tsx` (3), `PresetPickerModal.tsx` (3), `MiscSection.tsx` (3), `MashSection.tsx` (3), `HopSection.tsx` (3), `FermentationProfileForm.tsx` (3), `YeastSection.tsx` (2), `WaterCalculatorModal.tsx` (2), `RecipeLibrary.tsx` (2), `InventoryForm.tsx` (2), `FermentableSection.tsx` (2), `BrewSheet.tsx` (2), `BrewDayTracker.tsx` (2), `WaterProfileForm.tsx` (1), `StatsHeader.tsx` (1), `SettingsManager.tsx` (1), `ReadingLog.tsx` (1), `MeasuredComparison.tsx` (1), `ListRow.tsx` (1), `CellarActionFeed.tsx` (1), `BatchRecipeAdjustModal.tsx` (1), `BatchNoteLog.tsx` (1), `BatchCostPanel.tsx` (1), `designSystem.ts` (1, inside `METADATA_TEXT_CLASS`). `pages/`: `BatchDetail.tsx` (1).

Total 77. The transformation is textual and exact: the token `text-slate-500` → `text-slate-400`, matched on that full token only. `placeholder-slate-500` and `border-slate-500/30` do not match and are preserved.

---

## 2. Transformations & Pure Logic

### 2.1 Pure function contracts

**None.** This phase adds no function of any kind. `designSystem.ts` remains a constants-only module, and `designSystem.test.ts:44-49` enforces that by iterating `Object.entries(designSystem)` and asserting `typeof value !== 'function'` for every export — that assertion is untouched and its continued pass is AC-6.

The only "logic" in this phase is the composition rule (RA-5), which is expressed at call sites as template literals, not as a helper. **A `cx()` / `classNames()` helper MUST NOT be introduced** — it would be a function export from, or a new dependency of, the design-system layer and defeats the module's own contract.

### 2.2 No-match / fallback contracts

**None.** There is no runtime branching, no lookup, and no default. A token is a frozen string constant; there is no "no-match" state to define. Any call site that cannot adopt a token (RA-5 conflict) is **excluded at authoring time**, not fallen back to at runtime.

### 2.3 Stateful integration contract

**None.** No render loop, no frame integration, no state synchronization. Every change in this phase is confined to (a) a module's constant declarations, (b) an import statement, or (c) the text of a `className` attribute. `React.useState` / `useEffect` / `useMemo` call graphs in all 33 modified files are byte-identical before and after, except where a deleted module-scope `const` shifts line numbers.

### 2.4 Refactoring & legacy cleanup — explicit purge list

1. **Twelve module-scope `const` declarations deleted** across the 7 drift files (§1.3). Each deletion removes the declaration *and* any now-orphaned comment that documented it. None may survive as a renamed local, a re-export, or a commented-out block.
2. **The identifier shadowing purged**: `RecipeImportModal.tsx`'s local `FORM_SELECT_CLASS` currently shadows the `designSystem` export of the same name with a *different* value (`px-3 py-1.5 text-xs text-slate-100` vs the token's `px-3 py-2 text-sm text-slate-200 font-medium disabled:opacity-50`). After this phase, no file in `apps/web/src` declares an identifier that `designSystem.ts` also exports — asserted by AC-22.
3. **Two source-text-coupled test blocks reconciled, not deleted** (RA-9). Deleting them would silently drop M23_P1's palette guarantee for those two modals, which is a regression of a completed milestone.
4. **No dead import left behind**: any `designSystem` import in a drift file that becomes unused after migration is removed; lint (`oxlint`) is one of the four gates and will catch it.
5. **No new abstraction introduced**: no `Button.tsx`, no `Input.tsx`, no `cx()` helper, no barrel re-export module. Shared *components* are Milestone 25's business (and the roadmap explicitly requires them to land in a new module, not this one).

---

## 3. Acceptance Criteria & Test Matrix

New test file: `apps/web/test/designTokens.test.ts` (follows the M23_P1 precedent of adding a dedicated sweep suite rather than editing an existing pinned one; uses the `walk()` recursive-source-read pattern already proven at `designSystem.test.ts:76-83`).

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | `BUTTON_PRIMARY_CLASS` exact value | Unit (`designSystem.test.ts`) | `toBe('bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50')` |
| AC-2 | `BUTTON_SECONDARY_CLASS` exact value | Unit | `toBe('bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50')` |
| AC-3 | `INPUT_CLASS` exact value | Unit | `toBe('shadow-sm bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:ring-amber-500 focus:border-amber-500 block w-full sm:text-sm px-3 py-2')` |
| AC-4 | `INPUT_COMPACT_CLASS` exact value | Unit | `toBe('shadow-sm bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:ring-amber-500 focus:border-amber-500 text-sm px-2 py-1.5')` |
| AC-5 | `FORM_SELECT_COMPACT_CLASS` exact value | Unit | `toBe('bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer')` |
| AC-6 | Constants-only contract survives | Unit | `designSystem.test.ts:44-49` passes **with its body unmodified**; every one of the 22 exports has `typeof !== 'function'` |
| AC-7 | Export count is exactly 22 | Unit (new) | `Object.keys(designSystem)` has length 22, and its sorted contents equal the exact 22-name list of §1.1 |
| AC-8 | `METADATA_TEXT_CLASS` contrast fix | Unit | `toBe('text-xs text-slate-400')`; `designSystem.test.ts:18`'s pin is updated in the same change, not deleted |
| AC-9 | 16 untouched tokens unchanged | Unit | Every pin at `designSystem.test.ts:9-11,15-17,22-24,28-30,34,38-41,65-69` passes with its expected literal **unmodified** |
| AC-10 | `FORM_SELECT_CLASS` specifically unchanged (RA-10) | Unit | Its `designSystem.test.ts:38-40` pin is byte-identical to before the phase |
| AC-11 | `STATUS_BADGE_CLASS.Completed` keeps `border-slate-500/30` | Unit | The contrast sweep did not touch it; `designSystem.test.ts:69` passes unmodified |
| AC-12 | No local button/input/select constant survives in `src` | Source sweep (new) | Recursive walk of `apps/web/src`: zero files other than `components/designSystem.ts` match `/^\s*(export\s+)?const\s+[A-Z_]*(BUTTON|INPUT|SELECT)[A-Z_]*_CLASS\s*=/m` |
| AC-13 | All 7 drift files import from `designSystem` | Source sweep (new) | Each of the 7 §1.3 paths matches an import of its §1.3-mapped token(s) from `'./designSystem'` (or `'../components/designSystem'` for `pages/BatchDetail.tsx`) |
| AC-14 | Deleted literal — old `rounded-xl` primary gone | Source sweep (new) | The literal `bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl shadow transition-colors cursor-pointer` appears **zero** times anywhere in `apps/web/src` |
| AC-15 | Deleted literal — old `rounded-xl` secondary gone | Source sweep (new) | `bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl transition-colors cursor-pointer` appears **zero** times in `apps/web/src` |
| AC-16 | Deleted literal — `px-3.5` secondary gone | Source sweep (new) | `bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3.5 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50` appears **zero** times in `apps/web/src` |
| AC-17 | Deleted literal — WaterCalculator input shape gone | Source sweep (new) | `bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full` appears **zero** times in `apps/web/src` |
| AC-18 | Contrast sweep complete | Source sweep (new) | Zero occurrences of the exact token `text-slate-500` remain in `apps/web/src` (regex `/(?<![\w-])text-slate-500(?![\w\/-])/`), across every `.ts`/`.tsx` file |
| AC-19 | Contrast sweep did not over-reach — placeholders | Source sweep (new) | `placeholder-slate-500` still appears exactly **4** times in `apps/web/src` |
| AC-20 | Contrast sweep did not over-reach — `slate-600` preserved (RA-7) | Source sweep (new) | `text-slate-600` still appears exactly **13** times in `apps/web/src`; the 13 sites are the decorative ones enumerated in RA-7 |
| AC-21 | Contrast sweep did not over-reach — borders | Source sweep (new) | `border-slate-500/30` still appears exactly **1** time in `apps/web/src` (`STATUS_BADGE_CLASS.Completed`), and the four sibling `border-{amber,blue,emerald,purple}-500/30` entries are likewise unchanged |
| AC-22 | No identifier shadows a `designSystem` export | Source sweep (new) | For every export name in `designSystem.ts`, zero files in `apps/web/src` other than `designSystem.ts` contain a matching `/^\s*const <NAME>\s*[=:]/m` declaration |
| AC-23 | Degenerate/empty input — walk covers a real file set | Source sweep (new) | The recursive `walk()` used by AC-12/AC-18/AC-22 returns **≥ 60** `.ts`/`.tsx` paths; a sweep that silently walked an empty or wrong directory fails rather than vacuously passing |
| AC-24 | RA-9 reconcile — `RecipeImportModal.test.tsx` | Unit (modified) | The file's AC-5 and AC-7 blocks pass by asserting the imported token's palette + the file's import of it; the negative assertions (`not.toContain('bg-amber-500 hover:bg-amber-400')`, `not.toContain('text-slate-950')`, the `red-*` regex, and the `bg-rose-950/80` / `border-rose-800` / `text-rose-300` positives) are present and passing, unmodified |
| AC-25 | RA-9 reconcile — `WaterCalculatorModal.test.tsx` | Unit (modified) | Its AC-2 and AC-3 blocks pass on the same basis; the `bg-slate-950/60` grist-card survivor assertion at `:125-127` is present and passing, unmodified |
| AC-26 | Zero behavior change (RA-14) | Integration | Every pre-existing test in `ReadingLog.test.tsx`, `SensoryEvaluationPanel.test.tsx`, `SplitPackagingPanel.test.tsx`, `PostBrewCalibrationModal.test.tsx`, `BatchDetail.test.tsx`, `RecipeImportModal.test.tsx`, `WaterCalculatorModal.test.tsx` passes **with no change other than the AC-24/AC-25 blocks** |
| AC-27 | M23 invariants preserved | Integration | `ScopeGuardrail.test.tsx` passes byte-unmodified — all 8 dialogs still declare `role="dialog"` + `aria-modal="true"`, and the `window.confirm` counts are unchanged |
| AC-28 | M13 invariant preserved | Integration | `designSystem.test.ts`'s AC-20 block (single `STATUS_BADGE_CLASS` definition site; `BatchList`/`BatchDetail` import pins) passes with its body unmodified |
| AC-29 | Four Layer 1 gates | Verification | `npm test` (all workspaces), `npm run typecheck`, `npm run build`, `npm run lint` each exit 0. Web suite passes with **net-zero** test-count regression against the 2026-08-20 M23_P3 baseline (114 files / 1778 passed / 2 skipped, web 738 passed), plus only the new `designTokens.test.ts` cases. Lint's 3 known baseline warnings are permitted; zero new warnings |
| AC-30 | **Scope guardrail** | Verification | `git diff --name-only` against a base commit is **not viable in this repo** (single commit `7d88e64`; the whole `apps/web` tree is uncommitted — RA-13). Instead: the executor runs `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum \| sort > <scratch>/pre.txt` **before its first edit**, repeats it into `post.txt` at the end, and diffs. The only differing paths permitted are the 33 source files of §1.5, the 3 modified test files, the 1 new test file, `.gsd/active/M24_P1_feature_spec.md`, `.gsd/STATE.json`, and `.gsd/ROADMAP.md`. Every path on §1.5's untouched list must have an identical hash in both manifests |
| AC-31 | Manual visual evidence | Verification | Screenshots in `.gsd/active/manual_verification/M24_P1/` showing (a) the Recipe Import modal and Post-Brew Calibration modal side by side with visually identical primary buttons, (b) the Water Calculator modal's inputs on the standard treatment, (c) one screen with metadata text at `slate-400`. RA-12's accepted deltas are annotated as intended, not flagged |

---

## 4. Follow-ups logged, not built

- **`FORM_SELECT_CLASS` vs `INPUT_CLASS` shape divergence** (RA-10): selects are `rounded-lg` + `focus:outline-none`, inputs are `rounded-md` + `focus:ring-amber-500`. Harmonizing touches every select in the app. Raise at `/steer`.
- **Inline button-literal normalization** across the 25 files outside the drift set, spanning 17 primary and 12+ secondary distinct shapes (RA-2). This is the roadmap's existing *Deferred / not scheduled* "Full-app design-token coverage" item; the shape counts above are new evidence for sizing it.
- **No destructive/danger button token** (`rose-*`) exists. Not named by the roadmap; several call sites would want one.
- **`.gsd/FEATURES.md` / `.gsd/BUGS.md`**: no open item was marked `IN_PLANNING` for this phase. The two nearest bugs, `BUG-009` (TopBar action-button styles inconsistent) and `BUG-020` (WaterProfileForm card/input token mismatch), are both already `VERIFIED_RESOLVED`. `FEAT-005` (App-Wide UI/UX Redesign, Form Sectioning & Field Caption System, status `LOGGED`) is adjacent but materially larger — captions, accordions, sticky jump-nav, a `FormField.tsx`/`SectionCard.tsx` component system — and is **not** taken on by this phase; marking it `IN_PLANNING` here would misrepresent what ships.

---
> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
