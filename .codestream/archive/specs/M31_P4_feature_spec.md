# FEATURE SPECIFICATION: M31_P4 - The Label Sweep, the Explanatory Text, and the Milestone's Adoption Assertion

## Phase Summary

This is the **closing phase of Milestone 31** ("The forms for your kit and your stock introduce themselves"). Phases P1–P3 migrated all five target forms onto the `components/ui/` primitives:

- **M31_P1** — `EquipmentForm.tsx`, `FermentationProfileForm.tsx`
- **M31_P2** — `MashProfileForm.tsx`, `WaterProfileForm.tsx`
- **M31_P3** — `InventoryForm.tsx` main form **and all 24 category-detail fields** (Hop 6, Fermentable 7, Yeast 7, Misc 4)

### Reconciliation against the roadmap bullet (binding — read this before planning any work)

The roadmap's P4 bullet (`.gsd/ROADMAP.md` line 489) was written **before** P1–P3 ran and its numbers are now stale. A grounded re-count of the current working tree (2026-08-25) establishes the following facts, which supersede the roadmap's figures:

| Roadmap claim (stale) | Grounded current reality |
|---|---|
| "M12_P1's per-category Hop/Fermentable/Yeast/Misc detail cards" remain to migrate | **Already done in M31_P3.** All 24 category-detail fields render through `<FormField>`. `InventoryForm.tsx` contains **zero** `<label className=` occurrences and **zero** statically-unnamed controls. There is no detail-card migration left to perform. |
| Retire `block text-xs font-semibold text-slate-400 mb-1` ×42 | **0 literal occurrences** remain in any `.tsx` file — it now exists only as `FORM_LABEL_CLASS` in `designSystem.ts` (M30_P1). Already retired. |
| Retire `block text-[11px] text-slate-400 mb-1` ×13 | **0 occurrences** remain app-wide. Already retired. |
| Retire `block text-sm font-medium text-slate-300` ×10 | **10 occurrences remain, all in `pages/BatchDetail.tsx`** — none in Milestone 31's five files, and every one already carries `htmlFor`. **Out of scope** (see §2 Deferrals). |
| Retire `block text-xs font-medium text-slate-300 mb-1` ×7 | **1 occurrence remains, in `App.tsx`** (line 963, as `mb-1.5`). Out of scope (M32_P4 owns `App.tsx`). |
| Retire `block text-xs font-medium text-slate-400 mb-1` ×6 | **6 occurrences remain, all in `components/SplitPackagingPanel.tsx`**, every one already carrying `htmlFor`. Out of scope. |
| "the 78→≤23 app-wide count" | The 78 baseline and the ≤23 target both predate P1–P3. The grounded pre-phase count is **21** (corrected 2026-08-25 — see the counting-methodology-defect bullet in §Resolved Ambiguities; an earlier draft of this spec said 33, which was an artifact of a faulty parser, not of the source). This phase removes 4, leaving **17**. Corrected target: **≤21 as the AC-14 ceiling, with the full 17-control remainder enumerated file-by-file** (AC-14/AC-15). |

**Therefore P4's genuine remaining scope is:**

1. Close the **one** remaining bare `<label className=…>` inside the five milestone files (`EquipmentForm.tsx` line 532, a checkbox wrapper) by giving it explicit `id`/`htmlFor` association.
2. Close the Inventory screen's surrounding shell — `InventoryManager.tsx`'s 3 statically-unnamed filter controls and its 1 bare `<label className=…>` — so the milestone's user-visible outcome ("Add/Edit Inventory Item" and the screen you reach it from) is genuinely complete.
3. Retire the **ad-hoc explanatory-text class strings** in the five files onto the canonical helper-text token `METADATA_TEXT_CLASS`, including the one hardcoded copy living inside `ui/FormField.tsx` itself.
4. Write the **milestone's adoption assertion and count pins** into `test/ScopeGuardrail.test.tsx`, and the per-file `getByLabelText` / label-click-focus assertions into each of the five form test suites — this is the milestone-closing verification threshold and it is the largest single deliverable of this phase.

### Key Behaviors

1. Every form control in all five Milestone 31 files resolves to an accessible name via `getByLabelText`, asserted **per file**, not by one sweeping count.
2. Clicking a label focuses its control, proven per file in a test.
3. Zero `<label` elements lacking `htmlFor` remain in the five files plus `InventoryManager.tsx`.
4. Helper/explanatory text in the five files renders through `METADATA_TEXT_CLASS` rather than a hand-typed near-miss of it. The rendered class strings are **byte-identical to today** in three of four cases — this is token adoption, not a visual change.
5. The Inventory list screen's search box, category filter and out-of-stock toggle announce themselves to a screen reader.
6. `designSystem.ts` is **not modified** — `METADATA_TEXT_CLASS = 'text-xs text-slate-400'` already exists and is exactly the canonical helper-text typography this phase adopts. No new token is required, so M30_P1's `designSystem.test.ts` exact-string pins and `designTokens.test.ts` AC-7's 28-key list stay untouched.

### Resolved Ambiguities (Binding)

- **What "bare `<label className=…>`" means for the adoption assertion.** A `<label>` is compliant if and only if it carries an explicit `htmlFor` attribute whose value matches an `id` on a control, **or** is rendered by `<FormField>`. An implicitly-associating wrapper label (a `<label>` whose control is a descendant, with no `htmlFor`) does **not** satisfy the assertion even though `getByLabelText` finds it — the assertion is a static grep and the association must be structurally explicit. Both remaining wrapper labels (`EquipmentForm.tsx` line 532, `InventoryManager.tsx` line 220) gain explicit `id`/`htmlFor` **while keeping the wrapping structure intact**, so association is doubly guaranteed.
- **`aria-label` vs. a visible label for `InventoryManager.tsx`'s search and filter.** These two controls have no visible label today and this phase does **not** introduce one — adding visible labels to a filter toolbar is a layout change outside the milestone's scope. They receive `aria-label` (`"Search inventory"` and `"Filter by category"` — exact strings, binding). The out-of-stock checkbox already has visible text and gets `id`/`htmlFor` instead. Do **not** wrap any of the three in `<FormField>`.
- **`text-[11px]` → `METADATA_TEXT_CLASS` is a deliberate 11px→12px change.** Two explanatory notes (`InventoryForm.tsx` line 366, `EquipmentForm.tsx` line 516) currently use `text-[11px] text-slate-400`. Adopting `METADATA_TEXT_CLASS` moves them to `text-xs` (12px). This one-pixel growth is **accepted and intended** — it is precisely the near-miss retirement the milestone exists to perform. Do not preserve `text-[11px]` via an override.
- **The two empty-state notes are a byte-identical swap.** `FermentationProfileForm.tsx` line 274 and `MashProfileForm.tsx` line 323 use `"text-xs text-slate-400 italic bg-slate-950/40 border border-slate-800 rounded-lg p-4 text-center"`. The replacement must produce a class string **byte-identical to that value** with `text-xs text-slate-400` sourced from `METADATA_TEXT_CLASS` and the remainder appended verbatim, in that order. Zero visual change. Do **not** substitute `EMPTY_STATE_CLASS` — its value differs (`p-10`, no italic) and would change the rendering.
- **`FormField`'s hint span is a byte-identical swap; its error span is not touched.** `ui/FormField.tsx` hardcodes `className="text-xs text-slate-400"` for `hint` — byte-identical to `METADATA_TEXT_CLASS`, so this is a pure token adoption with no rendered-output change. The adjacent `error` span uses `text-xs text-rose-400`, for which **no token exists**; it is left exactly as-is and `designSystem.ts` is not extended to create one.
- **`InventoryForm.tsx`'s category-locked note stays a sibling `<p>`.** It is tempting to fold it into `FormField`'s `hint` prop; do **not**. It is conditionally rendered outside the `<FormField>` and carries `data-testid="inventory-form-category-locked-note"`. Only its `className` changes. Element type, position, conditional, and `data-testid` all stay byte-identical.
- **`WaterProfileForm.tsx`'s source is not modified.** It has no bare labels, no statically-unnamed controls and no ad-hoc explanatory text. Only `test/WaterProfileForm.test.tsx` gains the milestone's per-file assertions. This is deliberate and is itself asserted by AC-19.
- **Counting methodology for the app-wide statically-unnamed count (binding).** A "statically-unnamed control" is an `<input`, `<select` or `<textarea` opening tag in `apps/web/src/**/*.tsx` whose tag text contains neither an `aria-label` attribute nor an `id` attribute, where `id` is matched with a preceding-character guard so that `data-testid=` does **not** count as an `id`. Two exemptions apply: (a) files under `apps/web/src/components/ui/` are excluded — those primitives receive `id` via `{...props}` spread and via `FormField`'s `cloneElement`, so a static read of them is structurally meaningless; (b) a control that is the direct child of a `<FormField>` opening tag is exempt, because `FormField` injects the generated `id` at runtime via `cloneElement`. `*.test.tsx` files are excluded. This methodology, not a looser one, is what AC-14/AC-15 measure.
- **The original per-file counts in this spec were wrong; the corrected methodology above is authoritative (binding, added 2026-08-25).** The first draft of AC-14/AC-15 was computed with a naive tag-boundary parser that treated the first literal `>` character after `<input`/`<select`/`<textarea` as the end of the opening tag. That terminates falsely early on any multi-line JSX tag containing an arrow-function handler such as `onChange={(e) => …}` — the `>` in `=>` is not inside a quoted string, so the scan stops at the arrow and never sees attributes declared later in the same tag, silently misclassifying fully-labeled controls (those whose `aria-label` follows the handler) as unnamed. The prose methodology in the preceding bullet — brace/quote-aware tag-boundary detection, word-guarded `id=`, `components/ui/**` excluded, `*.test.tsx` excluded, direct `<FormField>` children exempt — was always correct; only the applied count was not. That prose method, re-implemented independently and run against the real current source, is the authoritative measure going forward, and it is what `apps/web/test/ScopeGuardrail.test.tsx` implements. AC-14/AC-15's figures below are the corrected, independently verified ones; any earlier figure (33 pre-phase, ≤29 target, the 8/6/2/2/1 section-file table) is superseded and must not be reintroduced.
- **Scope-guardrail method: content manifest, not `git diff`.** This repository has **2 commits total** (`git rev-list --count HEAD` = 2) and a working tree with hundreds of uncommitted modifications and untracked files predating this phase. `git diff --name-only` against any base commit therefore reports a vast set of unrelated files and **cannot** verify this phase's scope. AC-20 instead specifies a SHA-256 content manifest taken before the executor's first edit and again at the end.

---

## 1. Data Schema & Contracts

### Exported Constants & Types — none added, none changed

This phase introduces **no** new exported constant, type, interface or component. It consumes one existing export.

- **Consumed (existing, unchanged):** `METADATA_TEXT_CLASS` from `apps/web/src/components/designSystem.ts`, whose value is exactly `'text-xs text-slate-400'`.
- **`designSystem.ts` is not modified.** `Object.keys(designSystem).length` stays **28** and `designTokens.test.ts` AC-7's exact name list is not reconciled, because nothing about it changes.
- **`components/ui/index.ts` is not modified.** No new primitive is exported.
- **`FormFieldProps` is not modified.** No prop is added, removed, renamed or retyped. `label`, `htmlFor`, `id`, `hint`, `error`, `required`, `className`, `children` keep their current optionality and types.

### Symbol Inventory

**Modified symbols (5 source files):**

| File | Symbol | Nature of change |
|---|---|---|
| `apps/web/src/components/ui/FormField.tsx` | `FormField` | `hint` span's hardcoded `"text-xs text-slate-400"` replaced by `METADATA_TEXT_CLASS`; new named import added to the existing `from '../designSystem'` import statement (which already imports `FORM_LABEL_CLASS`). Rendered output byte-identical. |
| `apps/web/src/components/EquipmentForm.tsx` | `EquipmentForm` | Thermal-mass checkbox (line ~532–539) gains explicit `id`/`htmlFor`; altitude explanatory note (line ~516) adopts `METADATA_TEXT_CLASS`; `METADATA_TEXT_CLASS` added to the existing `designSystem` import. |
| `apps/web/src/components/InventoryForm.tsx` | `InventoryForm` | Category-locked note (line ~366) `className` adopts `METADATA_TEXT_CLASS`; import extended. |
| `apps/web/src/components/FermentationProfileForm.tsx` | `FermentationProfileForm` | Empty-steps note (line ~274) `className` adopts `METADATA_TEXT_CLASS`; import extended. |
| `apps/web/src/components/MashProfileForm.tsx` | `MashProfileForm` | Empty-steps note (line ~323) `className` adopts `METADATA_TEXT_CLASS`; import extended. |
| `apps/web/src/components/InventoryManager.tsx` | `InventoryManager` | Search input gains `aria-label="Search inventory"`; category select gains `aria-label="Filter by category"`; out-of-stock checkbox gains `id` with matching `htmlFor` on its wrapping label. No className, no layout, no import change. |

**Explicitly untouched symbols (regression surface):**

- `FormField`'s `useId`/`effectiveId`/`cloneElement` derivation logic, its `label`/`error`/`required` rendering, and its wrapper `div` classes.
- `Input`, `Select`, `NumberInput`, `Button` — no change of any kind.
- Every `data-testid` attribute in every touched file, byte-identical.
- Every form's submit/validation/state logic, every payload shape (`InventoryWriteInput`, `customDetails`, equipment/mash/fermentation profile payloads).
- `InventoryManager.tsx`'s `searchQuery` / `categoryFilter` / `outOfStockOnly` state, its filtering predicate, and its `INPUT_CLASS`/`FORM_SELECT_CLASS` usage.
- `WaterProfileForm.tsx` source — zero bytes changed.

---

## 2. Transformations & Pure Logic

### Pure Function Contracts

**None.** This phase adds no pure logic function, no calculation, and no data transformation. It is an accessibility-attribute and typography-token sweep plus a test-assertion deliverable. Any spec-reading agent expecting a `calculate*` signature here should conclude, correctly, that there is none.

### `id` derivation contract (the only non-trivial mechanic)

The two checkbox fixes must produce a **stable, collision-free, non-generated** `id` — these are singleton controls in singleton forms, so `useId` is unnecessary and a literal string is preferred for testability:

- `EquipmentForm.tsx`: `id="equipment-calc-strike-thermal-mass"`, wrapping label `htmlFor="equipment-calc-strike-thermal-mass"`.
- `InventoryManager.tsx`: `id="inventory-filter-out-of-stock"`, wrapping label `htmlFor="inventory-filter-out-of-stock"`.

These are **binding exact strings**. The wrapping `<label>` element is retained in both cases (implicit association preserved alongside the new explicit one). The checkbox's existing `data-testid` values (`equipment-field-calcStrikeWithThermalMass`, `inventory-filter-out-of-stock`) are unchanged — note that `InventoryManager`'s new `id` deliberately equals its existing `data-testid` value, which is permitted and intended.

### No-Match / Fallback Contracts

Not applicable — there is no matching, no lookup, and no empty-input branch in this phase. The nearest analogue is `FormField`'s existing behavior when `label` is undefined (`effectiveId` stays `undefined` and no `id` is injected); that behavior is **unchanged** and AC-18 pins it so this phase cannot regress it.

### Stateful Integration Contract

No frame loop, no render-loop integration, no lockstep component synchronization exists in this phase. The only stateful surface is React's controlled-input state in `InventoryManager.tsx`, which is untouched: adding `aria-label` and `id` attributes must not alter `value`, `checked`, or `onChange` wiring in any way.

### Refactoring & Legacy Cleanup

- **Purge the last hardcoded copy of the helper-text string.** After this phase, the literal `"text-xs text-slate-400"` must not appear as a hand-typed className anywhere in `ui/FormField.tsx` or in the five milestone form files. It survives elsewhere in the app (out of scope) and as `METADATA_TEXT_CLASS`'s definition in `designSystem.ts` (correct).
- **No obsolete registration loop, legacy alias map, or dead side effect was found** in the six touched files during planning. Nothing is scheduled for deletion. If the executor discovers one, it must be reported at Layer 1 rather than removed silently — an unplanned deletion in a sweep phase is exactly the regression class this milestone's test suite would not catch.
- **Do not "tidy" the `mt-1` / `italic` / layout classes** that sit alongside the swapped typography classes. They are load-bearing spacing and must be preserved verbatim.

### Deferrals (documented, not fixed here)

These are grounded, enumerated, and deliberately out of scope. AC-16 and AC-17 pin them so a future phase can detect drift:

| Item | Where | Owner |
|---|---|---|
| `block text-sm font-medium text-slate-300` ×10 | `pages/BatchDetail.tsx` (all `htmlFor`-carrying) | Unassigned — log for a later design-system milestone |
| `block text-xs font-medium text-slate-400 mb-1` ×6 | `components/SplitPackagingPanel.tsx` (all `htmlFor`-carrying) | Unassigned |
| `block text-xs font-medium text-slate-300 mb-1.5` ×1 | `App.tsx` line 963 | Milestone 32 P4 |
| 8 statically-unnamed controls | `HopSection` 6, `FermentableSection` 1, `App.tsx` 1 (`MiscSection`, `MashSection` and `YeastSection` are already at 0 — corrected 2026-08-25) | Milestone 32 (P1–P4) |
| 9 statically-unnamed controls | `RecipeImportModal` 3, `RecipeLibrary` 2, `BrewDayTracker` 1, `PresetPickerModal` 1, `ReadingLog` 1, `SettingsManager` 1 | Unassigned |

---

## 3. Acceptance Criteria & Test Matrix

Layer 1 gates (all four, per HARD_RULES rule 13) must be green: `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | `FormField` hint adopts the token | Unit Test (`test/` — new assertion) | `ui/FormField.tsx` source contains `METADATA_TEXT_CLASS` and contains zero occurrences of the hand-typed literal `"text-xs text-slate-400"`. Rendering `<FormField label="L" hint="H"><input/></FormField>` produces a hint element whose `className` is exactly `text-xs text-slate-400`. |
| AC-2 | `FormField` error span unchanged | Unit Test | Rendering with `error="E"` produces a span with `className` exactly `text-xs text-rose-400`, and no hint element is rendered when both `hint` and `error` are supplied. |
| AC-3 | EquipmentForm checkbox is explicitly associated | Integration Test (`EquipmentForm.test.tsx`) | The thermal-mass checkbox has `id="equipment-calc-strike-thermal-mass"`; its wrapping `<label>` has a matching `htmlFor`; `getByLabelText(/Calculate Strike with Vessel Thermal Mass/)` resolves to that `<input type="checkbox">`. |
| AC-4 | EquipmentForm checkbox behavior unregressed | Integration Test | Toggling the checkbox still flips `calcStrikeWithThermalMass`; `data-testid="equipment-field-calcStrikeWithThermalMass"` is still present and still resolves to the same element. |
| AC-5 | EquipmentForm altitude note adopts the token | Unit Test | `EquipmentForm.tsx` contains zero occurrences of `text-[11px]`; the altitude derivation note element's `className` contains `text-xs text-slate-400`. |
| AC-6 | InventoryForm category-locked note adopts the token | Integration Test (`InventoryForm.test.tsx`) | With a locked category, the element with `data-testid="inventory-form-category-locked-note"` is still a `<p>`, still renders the same text, and its `className` contains `text-xs text-slate-400` and `mt-1`; `InventoryForm.tsx` contains zero occurrences of `text-[11px]`. |
| AC-7 | Empty-state notes are byte-identical after token adoption | Integration Test (`FermentationProfileForm.test.tsx`, `MashProfileForm.test.tsx`) | With zero steps, each form's empty-state element's `className` equals exactly `text-xs text-slate-400 italic bg-slate-950/40 border border-slate-800 rounded-lg p-4 text-center`, and each file's source references `METADATA_TEXT_CLASS`. |
| AC-8 | InventoryManager search control is named | Integration Test (`InventoryManager.test.tsx`) | `getByLabelText('Search inventory')` resolves to the element with `data-testid="inventory-search"`; typing into it still filters the list. |
| AC-9 | InventoryManager category filter is named | Integration Test | `getByLabelText('Filter by category')` resolves to the element with `data-testid="inventory-filter-category"`; changing it still filters the list. |
| AC-10 | InventoryManager out-of-stock toggle is explicitly associated | Integration Test | The checkbox has `id="inventory-filter-out-of-stock"`; its wrapping `<label>` has a matching `htmlFor`; `getByLabelText(/Out of stock only/)` resolves to it; toggling still filters. |
| AC-11 | **Per-file accessible-name assertion, all five forms** | Integration Test (one assertion block per form test file) | In each of `EquipmentForm`, `FermentationProfileForm`, `MashProfileForm`, `WaterProfileForm`, `InventoryForm`, every rendered `input`/`select`/`textarea` node queried from the container resolves to a non-empty accessible name (via `getByLabelText` for its label text, or a non-empty `aria-label`). Asserted **per file** — five separate `it()` blocks, not one sweeping test. Zero controls unnamed in each. |
| AC-12 | **Per-file label-click-focus assertion, all five forms** | Integration Test (one per form test file) | In each of the five forms, clicking at least one label focuses its associated control. Where jsdom's known label-click-delegation gap applies (documented in M31_P3), the test resolves the label's `.control` property and asserts identity with the expected control, with an inline comment naming the jsdom limitation — the same workaround M31_P3 AC-9/AC-24 established. Five separate `it()` blocks. |
| AC-13 | **Milestone adoption assertion: zero unassociated labels** | Verification Test (`test/ScopeGuardrail.test.tsx`, new `Milestone 31` describe block) | Across `EquipmentForm.tsx`, `FermentationProfileForm.tsx`, `MashProfileForm.tsx`, `WaterProfileForm.tsx`, `InventoryForm.tsx` and `InventoryManager.tsx`, the count of `<label` opening tags that do **not** contain `htmlFor` is exactly **0** in each file, asserted file-by-file (six assertions). |
| AC-14 | **App-wide statically-unnamed control count ≤ 21** | Verification Test (`ScopeGuardrail.test.tsx`) | Using the §Resolved-Ambiguities counting methodology verbatim — the **brace/quote-aware** tag-boundary form, not a first-`>` scan (word-guarded `id=` so `data-testid` does not count; `components/ui/**` excluded; `*.test.tsx` excluded; direct `<FormField>` children exempt) — the total across `apps/web/src/**/*.tsx` is `<= 21`. The corrected pre-phase grounded value is **21**; the phase removes exactly 4 (EquipmentForm 1, InventoryManager 3), landing at an actual **17**, which AC-15 pins exactly. **Ceiling choice (explicit, binding):** the ceiling is tightened from the earlier draft's ≤29 to **≤21** rather than left conservative. ≤29 was derived from the faulty count and is now meaningless slack — a ceiling 12 above the real value would pass even if this phase's 4 fixes were reverted and 8 further unnamed controls were introduced. It is deliberately **not** set to ≤17: AC-15's exact per-file table already pins 17 to the control, so AC-14's job is the coarse app-wide regression ceiling, and ≤21 is the honest corrected pre-phase figure — any change that pushes the app back past its own pre-phase accessibility level fails here even if a file-level count shifts in a way AC-15's table did not anticipate. |
| AC-15 | **The 17-control remainder is enumerated, not implicit** | Verification Test (`ScopeGuardrail.test.tsx`) | The per-file breakdown asserts exactly: `HopSection.tsx` 6, `RecipeImportModal.tsx` 3, `RecipeLibrary.tsx` 2, `App.tsx` 1, `BrewDayTracker.tsx` 1, `FermentableSection.tsx` 1, `PresetPickerModal.tsx` 1, `ReadingLog.tsx` 1, `SettingsManager.tsx` 1 — and **0** for each of the six Milestone 31 files, and **0** for `MiscSection.tsx`, `MashSection.tsx` and `YeastSection.tsx` (all three are already fully named; the earlier draft's 6/2/1 for them was the parser defect, not real). Sum = **17**. |
| AC-16 | Fully-retired label variants stay retired | Verification Test (`ScopeGuardrail.test.tsx`) | Across `apps/web/src/**/*.tsx`, the literal `block text-xs font-semibold text-slate-400 mb-1` occurs **exactly 0** times and `block text-[11px] text-slate-400 mb-1` occurs **exactly 0** times. (The former lives only as `FORM_LABEL_CLASS` in `designSystem.ts`, a `.ts` file, and is not counted.) |
| AC-17 | Deliberately-deferred label variants are pinned, not swept | Verification Test (`ScopeGuardrail.test.tsx`) | `block text-sm font-medium text-slate-300` occurs exactly **10** times and only in `pages/BatchDetail.tsx`; `block text-xs font-medium text-slate-400 mb-1` occurs exactly **6** times and only in `components/SplitPackagingPanel.tsx`; `block text-xs font-medium text-slate-300 mb-1` occurs exactly **1** time and only in `App.tsx`. Deliberate deferral, in the style of `designTokens.test.ts` AC-20/AC-21. |
| AC-18 | Degenerate `FormField` input unregressed | Unit Test | `<FormField><input/></FormField>` with no `label` renders no `<label>` element and injects no `id` onto the child. `<FormField label="L" htmlFor="explicit"><input/></FormField>` uses `"explicit"`, not a generated id. A child with its own `id` keeps it (`cloneElement` must not overwrite). |
| AC-19 | `WaterProfileForm.tsx` source is byte-unchanged | Verification | The SHA-256 of `apps/web/src/components/WaterProfileForm.tsx` is identical in the pre-phase and post-phase manifests (AC-20). Its test file may change; its source may not. |
| AC-20 | **Scope Guardrail — content manifest, not `git diff`** | Verification | `git diff --name-only` against a base commit is **not viable here** (2 commits total, hundreds of pre-existing uncommitted changes) and must not be used. Instead: before the first edit, capture `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum > <scratch>/pre.sha256`; at the end, capture the same into `post.sha256`; `diff pre.sha256 post.sha256` must list **only** the files enumerated in the "Authorized" table below. Any other differing path is a scope violation and a Layer 1 failure. |
| AC-21 | Forbidden paths untouched | Verification | The manifest diff shows **no** change to `apps/web/src/components/designSystem.ts`, `apps/web/test/designSystem.test.ts`, `apps/web/test/designTokens.test.ts`, `package.json`, any `package-lock.json`, anything under `packages/**`, anything under `apps/api/**`, any `*Section.tsx`, `pages/BatchDetail.tsx`, `components/SplitPackagingPanel.tsx`, `App.tsx`, or `components/ui/{Input,Select,NumberInput,Button,index}.{ts,tsx}`. |
| AC-22 | Design token count unchanged | Unit Test (existing, must stay green) | `designTokens.test.ts` AC-7 still passes with `Object.keys(designSystem).length === 28` and its exact name list unmodified — proving no token was added or renamed. |
| AC-23 | Layer 1: four gates green | Verification | `npm test` exit 0 with a test count **greater than** the M31_P3 baseline (1618 passed / 2 skipped across 87 files) and **zero** failures; `npm run typecheck` exit 0 across all 4 workspaces; `npm run build` exit 0; `npm run lint` exit 0 errors. |
| AC-24 | Manual verification evidence | Manual | A screenshot in `.gsd/active/manual_verification/` named `M31_P4_label_sweep.png` showing the Inventory list screen with its filter toolbar, plus one showing a profile form's helper text, confirming no visual regression from the token swaps. |

### Scope Guardrail — Authorized paths

**Authorized to MODIFY (11 files, all under `apps/web/`):**

| Path | Why |
|---|---|
| `apps/web/src/components/ui/FormField.tsx` | hint span → `METADATA_TEXT_CLASS` |
| `apps/web/src/components/EquipmentForm.tsx` | checkbox `id`/`htmlFor`; altitude note token |
| `apps/web/src/components/InventoryForm.tsx` | category-locked note token |
| `apps/web/src/components/FermentationProfileForm.tsx` | empty-state note token |
| `apps/web/src/components/MashProfileForm.tsx` | empty-state note token |
| `apps/web/src/components/InventoryManager.tsx` | 2 × `aria-label`, 1 × `id`/`htmlFor` |
| `apps/web/test/ScopeGuardrail.test.tsx` | new `Milestone 31` describe block (AC-13…AC-17) |
| `apps/web/test/EquipmentForm.test.tsx` | AC-3, AC-4, AC-5, AC-11, AC-12 |
| `apps/web/test/InventoryForm.test.tsx` | AC-6, AC-11, AC-12 |
| `apps/web/test/InventoryManager.test.tsx` | AC-8, AC-9, AC-10 |
| `apps/web/test/FermentationProfileForm.test.tsx` | AC-7, AC-11, AC-12 |
| `apps/web/test/MashProfileForm.test.tsx` | AC-7, AC-11, AC-12 |
| `apps/web/test/WaterProfileForm.test.tsx` | AC-11, AC-12 only (its source stays untouched — AC-19) |

*(AC-1, AC-2 and AC-18 may be added to whichever of the above test files is most natural, or to `ScopeGuardrail.test.tsx`; do not create a new test file for them.)*

**Authorized to CREATE:** none. No new source file, no new test file, no new component, no new token.

**Explicitly FORBIDDEN to modify** (violating any of these fails AC-21):
`apps/web/src/components/designSystem.ts` · `apps/web/test/designSystem.test.ts` · `apps/web/test/designTokens.test.ts` · `package.json` (any) · `package-lock.json` (any) · anything under `packages/**` · anything under `apps/api/**` · `apps/web/src/components/ui/Input.tsx`, `Select.tsx`, `NumberInput.tsx`, `Button.tsx`, `index.ts` · `apps/web/src/components/WaterProfileForm.tsx` · `apps/web/src/App.tsx` · `apps/web/src/pages/BatchDetail.tsx` · `apps/web/src/components/SplitPackagingPanel.tsx` · every `*Section.tsx` · every `*.css` · `.gsd/**` (the executor logs to `STATE.json` only, per rule 18).

---

> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution.
