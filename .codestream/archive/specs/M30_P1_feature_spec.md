# FEATURE SPECIFICATION: M30_P1 - Tokens and the Dead Focus Ring

> **Milestone 30:** "The calculators all look like one tool." (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 1 of 4.** Deliberately the smallest and most isolated phase in the initiative: it touches `apps/web/src/components/designSystem.ts` and its two token-pinning test files, and nothing else.

---

## Phase Summary

Today the app ships a global keyboard focus ring in `apps/web/src/index.css`:

```css
:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 2px;
}
```

Buttons show it. **Text inputs and selects do not.** All four form-control tokens in `designSystem.ts` begin with `focus:outline-none`, which Tailwind compiles to `.focus\:outline-none:focus { outline-style: none }` at specificity `(0,2,0)`. The bare `:focus-visible` rule sits at `(0,1,0)` and loses. The result is that on **~165 usages of these four tokens across the app**, the ring the app already paid for never renders — a real, verified keyboard-accessibility defect, confirmed against the built CSS during the M30 `/map` audit.

This phase removes that override so the ring goes live app-wide, and — in the same commit — adds the two vocabulary tokens the rest of Milestone 30 depends on: a **form label token** (none exists today, against 112 `<label>` elements in 20 distinct class strings) and a **fixed control height token** (`<select>` renders ~44px, `<input>` ~38px, buttons 32–40px — they visibly disagree on every profile form).

**Why this is independently user-visible without migrating a single component:** the four tokens already have ~165 consumers. Deleting `focus:outline-none` from the token string makes every one of them show a focus ring on the next build. No component file changes.

**Why this phase stands alone:** it carries the two cross-cutting decisions the whole initiative inherits (focus-ring colour; class-merging dependency). Bundling those with a multi-file migration is exactly the heavy phase the M30 breakdown exists to avoid.

### Key Behaviors

1. Tabbing into any text input or select styled with `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `FORM_SELECT_CLASS` or `FORM_SELECT_COMPACT_CLASS` shows a 2px focus ring with 2px offset — the same treatment buttons already show. Clicking into it with a mouse does **not** (that is `:focus-visible` semantics, and is correct).
2. `designSystem.ts` exports a single canonical form-label class string, replacing nothing yet — its consumers arrive in M30_P2 and M31.
3. `designSystem.ts` exports a single canonical control-height class string (`h-10` / 40px), likewise consumed from M30_P2 onward.
4. The existing `focus:border-amber-500` hover/focus border on all four control tokens is **retained unchanged**. The ring is additive to it, not a replacement.
5. No component renders differently in any way other than the focus ring. No height, padding, colour, radius or font change ships in this phase.

---

### Resolved Ambiguities (Binding)

**RA-1 — The removal is exact-substring, not regex-fuzzy.**
In each of the four token strings, the removed text is the seven-character-plus-space literal `focus:outline-none ` (including exactly one trailing space). No other whitespace is normalised, no other class is reordered, and the relative order of every surviving class in each string is preserved exactly as it appears today.

**RA-2 — `focus:` vs `focus-visible:` variants are not interchangeable and must not be "tidied".**
The surviving `focus:border-amber-500` stays on the `focus:` variant (it should show on mouse click too). Any new ring classes use the `focus-visible:` variant (keyboard-only). An executor that harmonises these two onto one variant has failed the spec.

**RA-3 — `index.css` is NOT edited in this phase.**
Whichever focus colour is chosen (see OQ-1), it is expressed entirely in `designSystem.ts` token strings. The global `:focus-visible` rule in `index.css` is left byte-identical, because it also serves buttons, links, tabs and every other focusable element, and repainting it would silently change the whole app's focus colour — a far larger blast radius than this phase is scoped for.

**RA-4 — The control-height token is introduced but NOT spliced into the four control tokens in this phase.**
`CONTROL_HEIGHT_CLASS` is exported as a standalone constant with zero consumers until M30_P2. It is deliberately *not* appended to `INPUT_CLASS` / `FORM_SELECT_CLASS` / the two compact variants, because:
- `INPUT_COMPACT_CLASS` and `FORM_SELECT_COMPACT_CLASS` are `text-xs` + `py-1` dense-row controls rendering at roughly 26px. Forcing them to 40px in a constants-only phase would visibly break dense table rows and inline editors across the app with zero component-level review — a regression, not a fix.
- Reconciling height belongs with the primitive layer that owns `size` (`sm` / `md`), which is M30_P2's scope.
This is a binding scope decision, not an oversight. An executor that splices `h-10` into any of the four control tokens has failed the spec.

**RA-5 — The label token is introduced but has no consumers in this phase.**
Same reasoning as RA-4. Zero `<label>` elements are migrated here; that begins in M30_P2 and completes in M31_P4. The token exists in this phase so P2's primitives have one string to point at rather than inventing a 21st variant.

**RA-6 — Size and variant axes are explicitly deferred out of this phase.**
`.gsd/ROADMAP.md`'s M30 P1 bullet lists "the size/variant axes" alongside the label and control-height tokens. This spec **narrows** that: variant axes are a property of the `ui/` primitives' props API, which does not exist until M30_P2, and expressing them as bare constants now would create exactly the orphan-vocabulary problem the `/map` audit diagnosed (`BUTTON_ICON_CLASS` and `BODY_TEXT_CLASS` have zero consumers today). The roadmap's M30 phase count is unchanged at 4; only the P1/P2 boundary moves. Reviewer may reject this narrowing at SPEC_APPROVED time.

**RA-7 — Existing occurrence-count pins that this phase must leave numerically unchanged.**
`designTokens.test.ts` pins three literal occurrence counts. This phase changes none of them and the executor must **not** adjust them:
- AC-19 `placeholder-slate-500` === 4 — untouched (it survives in both input tokens).
- AC-20 `text-slate-600` === 13 — untouched.
- AC-21 `border-slate-500/30` === 1 — untouched.
- AC-18 `text-slate-500` === 0 occurrences — untouched (the new label token uses `text-slate-400`).

**RA-8 — There is no existing pin on `focus:outline-none` occurrence counts.**
Searched and confirmed: neither test file counts this class today. This phase **adds** one (see AC-9), to lock the fact that P1 removed exactly the four token occurrences and reached into zero component files.

**RA-9 — Naming does not collide with existing exports.**
`FORM_LABEL_CLASS` is distinct from the existing `METRIC_LABEL_CLASS` (`text-xs text-slate-400 font-medium mb-1`), which is a metric-tile caption, not a form label, and is not modified or aliased. Verified by source sweep: no file in `apps/web/src` declares `const FORM_LABEL_CLASS` or `const CONTROL_HEIGHT_CLASS` today, so `designTokens.test.ts` AC-22 (no file re-declares an exported identifier) stays green by construction.

**RA-10 — The new names do not trip the AC-12 drift regex.**
AC-12's pattern is `^\s*(export\s+)?const\s+[A-Z_]*(BUTTON|INPUT|SELECT)[A-Z_]*_CLASS\s*=`. Neither `FORM_LABEL_CLASS` nor `CONTROL_HEIGHT_CLASS` matches (`SELECT` does not appear in either name as a substring — `FORM_LABEL` and `CONTROL_HEIGHT` are clean). No change to AC-12 is required or permitted.

**RA-11 — `designSystem.ts` remains strictly constants-only.**
`designSystem.test.ts`'s "module exports no React component and no hook" assertion (`typeof value !== 'function'` over every export) stays green: both additions are `string` literals. No function, no hook, no component, no side effect, no new import is added to this module.

---

## Open Questions — Reviewer's Call at SPEC_APPROVED

### OQ-1 (BLOCKING): Focus-ring colour for form controls — amber or sky?

A static HTML preview demonstrating the bug live, with an amber/sky comparison, was shown before this spec. **No choice has been recorded yet.** The executor must not pick one. Reply to this spec with `SPEC_APPROVED — Option A` or `SPEC_APPROVED — Option B`; a bare `SPEC_APPROVED` is read as **Option A (amber, the recommendation)**.

| | **Option A — amber (RECOMMENDED)** | **Option B — sky** |
|---|---|---|
| Ring colour on inputs/selects | amber-500 | sky-400 (`#38bdf8`, inherited from the global rule) |
| Matches the app's actual interactive accent? | **Yes.** Every button is `bg-amber-600 hover:bg-amber-500`; these very inputs already do `focus:border-amber-500` on focus, so ring and border agree. | No. A sky ring sits inside an amber focus border — two accents on one control. |
| Extra classes in the token strings | 3 per token (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500`) | 0 — pure deletion |
| Consistency with buttons app-wide | Buttons keep the global sky ring, so buttons and inputs would ring in *different* colours until a later phase reconciles them. **This is the real cost of Option A** and should be reconciled in M33 (brew-day buttons) or M35. | Perfectly uniform app-wide on day one. |
| Origin | The app's own established accent. | The pasted external UI brief specified `ring-sky-400`. `.gsd/ROADMAP.md` explicitly warns: *"Reconcile the focus colour at `/plan`, do not adopt the brief verbatim."* |

**Recommendation: Option A (amber).** The brief's sky-400 was never an app-specific decision, and the app's real accent is amber everywhere a user can click. The button/input colour split Option A creates is a known, bounded follow-up (one line of `index.css` in a later phase) rather than a permanent accent contradiction. Reviewer overrides freely — Option B is genuinely cheaper and is the defensible choice if app-wide uniformity today matters more than accent fidelity.

### OQ-2 (NON-BLOCKING, decided): Class-merging dependency — `clsx` / `tailwind-merge` / `cva` / `tailwind-variants`

**Decision: defer to M30_P2. Do not add any dependency in this phase.**

Reasoning, recorded because the rest of the initiative inherits it: no such package is installed today (`.gsd/ROADMAP.md` M30 ground truth item 6). This phase only edits existing constant string literals — there is nothing to merge, so adding a dependency now would ship an unused package and pre-commit the primitive layer's API before that API has been designed. The decision is genuinely live at P2, where `size`/`variant` props first create a conflict-resolution problem (`px-3` vs `!px-3`, the exact conflict the 8 current `!important` sites are faking around); P2 must choose between a merge dependency and a variant API designed so overrides are unnecessary. Recording it as *deliberately deferred with the criterion stated* is the point; leaving it unstated is what the roadmap warned against.

---

## Logged Items

| Item | Status change | Relationship to this phase |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification: Composable UI Primitives, 12-Column Responsive Grid, and Global Navigation Guard Architecture | `OPEN` → **`IN_PLANNING`** | The umbrella item for this initiative. Its Component list names `components/designSystem.ts`; its "Component Drift" observation is the 44px-select / 38px-input mismatch that `CONTROL_HEIGHT_CLASS` begins to resolve; its Expected Behavior §1 calls for "a universal 40px control plane (`h-10`)" — which is where this spec's `h-10` value comes from. **This phase partially advances BUG-040 and does not close it**; the remainder spans M30_P2–M35. |
| BUG-036, BUG-037, BUG-038, BUG-039 (per-form editor layout/height bugs) | **unchanged (`OPEN`)** | Each independently requests `h-10` control heights and consistent focus states, so each is downstream of this phase's tokens — but every one of them is a consumer-form migration belonging to M31+. Setting them `IN_PLANNING` now would misrepresent them as in this phase's scope. |
| FEAT-005 (App-Wide UI/UX Redesign, Form Sectioning & Field Caption System) | **unchanged (`LOGGED`)** | Its "uniform label typography" bullet is the demand `FORM_LABEL_CLASS` answers, but FEAT-005's actual scope (captions, accordions, sticky nav) is far outside M30. |

**No logged item specifically reports the dead focus ring.** It was discovered by the `codebase-mapper` audit during the M30 `/map` pass (see `.gsd/STATE.json` state_history, 2026-08-24) and verified against the built CSS — it is recorded in `.gsd/ROADMAP.md`'s M30 ground truth, not in `BUGS.md`. Rather than back-file a bug report for something already scheduled, this spec is the record. Likewise, no logged item covers label *association* (`htmlFor`/`id`) — and label association is **not** in this phase's scope regardless (it is M31_P1, and requires the `FormField` component from M30_P2).

---

## 1. Data Schema & Contracts

### 1.1 New exported constants (2)

Both are `string` literals, appended to `apps/web/src/components/designSystem.ts`. Both are new export names; neither shadows nor replaces an existing export.

| Name | Type | Exact value | Section placement |
|---|---|---|---|
| `FORM_LABEL_CLASS` | `string` | `'block text-xs font-semibold text-slate-400 mb-1'` | In the existing `// 4. Form controls & settings rows` block, immediately **above** `INPUT_CLASS` |
| `CONTROL_HEIGHT_CLASS` | `string` | `'h-10'` | Same block, immediately **below** `FORM_LABEL_CLASS` |

**Value justification (binding — these are not free choices):**
- `FORM_LABEL_CLASS` — `block text-xs font-semibold text-slate-400 mb-1` is the **plurality** variant already in the tree at **42 occurrences**, ahead of `block text-[11px] text-slate-400 mb-1` (13), `block text-sm font-medium text-slate-300` (10), `block text-xs font-medium text-slate-300 mb-1` (8) and `block text-xs font-medium text-slate-400 mb-1` (6). Per the `designSystem.ts` module docstring's own governing principle — *"These are NOT a new aesthetic — each value is the already-dominant convention found across the existing tree"* — the token adopts the dominant string verbatim rather than inventing a 21st variant.
- `CONTROL_HEIGHT_CLASS` — `h-10` (40px) is the value named explicitly and repeatedly by the logged bugs: BUG-040 §1 ("a universal 40px control plane (`h-10`)"), BUG-036 §3, BUG-038, BUG-039 and FEAT items on the Recipe Library and Water Chemistry modal all specify `h-10`. It is a bare height utility with no padding, colour or typography, so it composes with any control token without conflict.

### 1.2 Modified exported constants (4) — exact before/after

Presented under **Option A (amber, recommended)**. Under Option B, apply only the `focus:outline-none ` deletion in each and append nothing.

#### `INPUT_CLASS`
- **Before:** `'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500'`
- **After (A):** `'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500'`
- **After (B):** `'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500'`

#### `INPUT_COMPACT_CLASS`
- **Before:** `'bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500'`
- **After (A):** `'bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500'`
- **After (B):** `'bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500'`

#### `FORM_SELECT_CLASS`
- **Before:** `'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer'`
- **After (A):** `'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500'`
- **After (B):** `'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer'`

#### `FORM_SELECT_COMPACT_CLASS`
- **Before:** `'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium cursor-pointer'`
- **After (A):** `'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-amber-500 font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500'`
- **After (B):** `'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-amber-500 font-medium cursor-pointer'`

> **Mechanical rule for Option A (so the four are byte-predictable):** delete the literal `focus:outline-none ` (one trailing space), then append a single space and `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500` to the **end** of the string. Nothing else moves.

### 1.3 Symbol Inventory

**Modified (4):** `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `FORM_SELECT_CLASS`, `FORM_SELECT_COMPACT_CLASS`.

**Added (2):** `FORM_LABEL_CLASS`, `CONTROL_HEIGHT_CLASS`.

**Existing and explicitly UNTOUCHED (22)** — byte-identical after this phase: `CARD_CLASS`, `CARD_STACK_GAP_CLASS`, `SUBPANEL_CLASS`, `PAGE_TITLE_CLASS`, `SECTION_HEADING_CLASS`, `SUBSECTION_HEADING_CLASS`, `BODY_TEXT_CLASS`, `METADATA_TEXT_CLASS`, `MONO_VALUE_CLASS`, `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `BUTTON_DANGER_CLASS`, `BUTTON_ICON_CLASS`, `SETTINGS_ROW_CLASS`, `METRIC_TILE_CLASS`, `METRIC_LABEL_CLASS`, `METRIC_VALUE_CLASS`, `EMPTY_STATE_CLASS`, `LOADING_STATE_CLASS`, `ERROR_STATE_CLASS`, `STATUS_BADGE_WRAPPER_CLASS`, `STATUS_BADGE_CLASS`.

**Export count: 26 → 28.**

**Aliases preserved as aliases (no de-aliasing "cleanup"):** `METRIC_TILE_CLASS = SUBPANEL_CLASS` and `LOADING_STATE_CLASS = EMPTY_STATE_CLASS` remain reference assignments, not duplicated literals — `designSystem.test.ts` asserts identity between them.

### 1.4 No dependency, config or CSS changes

`package.json`, `package-lock.json`, `apps/web/src/index.css`, `vite.config.ts` and every `tsconfig*.json` are unchanged. No Tailwind config change is required: `outline-2`, `outline-offset-2` and `outline-amber-500` are stock Tailwind 4 utilities, and `focus-visible:` is a stock variant.

---

## 2. Transformations & Pure Logic

**There are none, by design and by enforced constraint.**

`apps/web/test/designSystem.test.ts` asserts that every value exported by `designSystem.ts` satisfies `typeof value !== 'function'` — the module is contractually constants-only (this is the same constraint that forced `Modal.tsx` into its own module in M25). This phase adds two `string` constants and edits four `string` constants. **No function, hook, component, helper, class-merging utility, side effect or new import may be introduced into `designSystem.ts`.**

- **Pure Function Contracts:** none. Any function appearing in the diff is a spec violation.
- **No-Match / Fallback Contracts:** not applicable — there is no runtime branching, no lookup, and no empty-input path in this phase.
- **Stateful Integration Contract:** not applicable — nothing renders differently through code; the focus ring reaches users purely through the CSS cascade once `focus:outline-none` stops out-specifying `:focus-visible`. No React state, no frame loop, no lifecycle.
- **Refactoring & Legacy Cleanup:** the only removal in this phase is the four `focus:outline-none ` substrings. There are **no** obsolete registration loops, legacy map aliases or side effects to purge from this module — it has none. Specifically **do not** "clean up" the two intentional alias assignments (§1.3), the section comment banners, or the module docstring.
- **Deliberate non-cleanup, recorded so a later phase does not think it was missed:** **16 occurrences of `focus:outline-none` remain in `apps/web/src` after this phase**, distributed as `App.tsx` (4), `components/calculators/CalculatorCard.tsx` (2), `components/HopSection.tsx` (8), `components/FermentableSection.tsx` (1), `components/RecipeLibrary.tsx` (1). These are inline `className` literals in component files, are **out of scope** here, and are retired by the M30_P2–P4 and M32 migrations. AC-9 pins this number precisely so that the day a migration removes some, the pin forces a deliberate update rather than silent drift.

---

## 3. Acceptance Criteria & Test Matrix

Test files: `apps/web/test/designSystem.test.ts` and `apps/web/test/designTokens.test.ts`. AC IDs below are this spec's; where they modify an existing numbered assertion in those files, the existing ID is named explicitly.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|------------------|
| **AC-1** | `FORM_LABEL_CLASS` exists with its exact value | Unit (`designSystem.test.ts`, AC-18 "form controls" block) | `expect(designSystem.FORM_LABEL_CLASS).toBe('block text-xs font-semibold text-slate-400 mb-1')` |
| **AC-2** | `CONTROL_HEIGHT_CLASS` exists with its exact value | Unit (same block) | `expect(designSystem.CONTROL_HEIGHT_CLASS).toBe('h-10')` — exactly `h-10`, not `h-[40px]`, not `min-h-10`, no additional classes |
| **AC-3** | All four control tokens are free of `focus:outline-none` | Unit (same block) | For each of `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `FORM_SELECT_CLASS`, `FORM_SELECT_COMPACT_CLASS`: `expect(token).not.toContain('outline-none')` |
| **AC-4** | All four control tokens **retain** `focus:border-amber-500` | Unit (same block) | Each of the four `.toContain('focus:border-amber-500')`. Guards against an executor deleting the focus border along with the outline override |
| **AC-5** | All four control tokens pinned to their exact post-change strings | Unit (same block) | Four `toBe` assertions matching §1.2's "After" strings for the **chosen option**, byte-for-byte. Note: `FORM_SELECT_CLASS`'s existing `toBe` pin at `designSystem.test.ts` lines 56–58 **must be updated** — it currently pins the pre-change string and will fail otherwise. `INPUT_CLASS`, `INPUT_COMPACT_CLASS` and `FORM_SELECT_COMPACT_CLASS` are **not** pinned in that file today; this AC adds them, closing a pre-existing coverage gap |
| **AC-6** | *(Option A only)* All four control tokens carry the amber `focus-visible:` ring trio | Unit (same block) | Each of the four `.toContain('focus-visible:outline-2')`, `.toContain('focus-visible:outline-offset-2')` and `.toContain('focus-visible:outline-amber-500')`. **Under Option B this AC is replaced by:** each of the four contains **zero** occurrences of the substring `focus-visible:` |
| **AC-7** | *(Option A only)* Ring classes use the `focus-visible:` variant, never bare `focus:` | Unit (same block) | For each of the four: `expect(token).not.toMatch(/(?<!-)\bfocus:outline/)` — i.e. no `focus:outline-*` class of any kind survives. Enforces RA-2 |
| **AC-8** | Export count and exact name list updated 26 → 28 | Unit (`designTokens.test.ts`, **existing AC-7**) | The `EXPECTED` array gains `'CONTROL_HEIGHT_CLASS'` and `'FORM_LABEL_CLASS'`; `toHaveLength(26)` becomes `toHaveLength(28)`; `expect(actual).toEqual(EXPECTED)` still passes. No other name added or removed |
| **AC-9** | `focus:outline-none` occurrence sweep proves exact removal and zero over-reach | Unit (**new** describe block in `designTokens.test.ts`, reusing its existing `readAll(ALL_SRC_FILES)` helper) | (a) `components/designSystem.ts` contains **0** occurrences; (b) total across all `.ts`/`.tsx` under `apps/web/src` is **exactly 16** (down from 20); (c) the set of files still containing it is exactly `App.tsx`, `components/calculators/CalculatorCard.tsx`, `components/FermentableSection.tsx`, `components/HopSection.tsx`, `components/RecipeLibrary.tsx` — asserted as a sorted array, so touching any additional component file fails the build |
| **AC-10** | Constants-only invariant holds | Unit (`designSystem.test.ts`, existing "module exports no React component and no hook") | Passes unmodified. Every one of the 28 exports is `typeof 'string'` except `STATUS_BADGE_CLASS` (`object`); none is `'function'` |
| **AC-11** | The three existing occurrence-count pins are numerically unchanged | Unit (`designTokens.test.ts`, existing AC-19/AC-20/AC-21) | `placeholder-slate-500` still **4**; `text-slate-600` still **13**; `border-slate-500/30` still **1**. These three assertions must be **byte-identical** to their current form — an executor that edits any of their numbers has broken something else and masked it |
| **AC-12** | The `text-slate-500` ban still holds | Unit (`designTokens.test.ts`, existing AC-18) | Zero exact-token occurrences of `text-slate-500` app-wide. The new label token uses `text-slate-400` and must not reintroduce `text-slate-500` |
| **AC-13** | Drift-constant and re-declaration guardrails unaffected | Unit (`designTokens.test.ts`, existing AC-12 and AC-22) | Both pass **without edits**: neither new name matches AC-12's `(BUTTON\|INPUT\|SELECT)` regex, and no file outside `designSystem.ts` declares `const FORM_LABEL_CLASS` or `const CONTROL_HEIGHT_CLASS` |
| **AC-14** | Existing token-import pins unaffected | Unit (`designTokens.test.ts`, existing AC-13, 7 cases) | All 7 cases pass unmodified — this phase changes token *values*, never their names or the files importing them |
| **AC-15** | Deleted-literal pins unaffected | Unit (`designTokens.test.ts`, existing AC-14–AC-17) | All four pass unmodified. Note AC-17's pinned literal contains `focus:outline-none` and asserts it appears **zero** times; removing `focus:outline-none` from tokens cannot cause that literal to appear, so it stays green |
| **AC-16** | The 22 untouched exports are byte-identical | Unit (`designSystem.test.ts`, existing AC-18 blocks + AC-19) | Every existing `toBe` assertion for the 22 symbols in §1.3 passes **without its expected string being edited**. The alias identities `METRIC_TILE_CLASS === SUBPANEL_CLASS` and `LOADING_STATE_CLASS === EMPTY_STATE_CLASS` still hold |
| **AC-17** | No behavioural test regresses | Integration (full suite) | The 6 existing `toHaveClass` assertions and all 9 test files importing `designSystem` still pass. Baseline is **1,970 passed / 2 skipped across 119 files** (`.gsd/STATE.json`, 2026-08-24 stability check). Post-change: **no test fails, and no test count decreases**. New tests may raise the total |
| **AC-18** | *(Option A only)* Ring colour is amber, not sky | Unit (same block as AC-6) | No control token contains `sky` in any form. Under **Option B** this inverts: no control token contains any `outline-` colour class at all, the ring colour coming solely from `index.css` |
| **AC-19** | `index.css` is byte-identical | Verification (manifest, see AC-22) | `apps/web/src/index.css`'s SHA-256 is unchanged. The `:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }` rule survives exactly as written |
| **AC-20** | No dependency added | Verification | `package.json` and `package-lock.json` SHA-256 unchanged. `clsx`, `tailwind-merge`, `class-variance-authority` and `tailwind-variants` remain absent from `node_modules` manifests and from every import statement in `apps/web/src` (RA/OQ-2) |
| **AC-21** | No `components/ui/` directory and no primitive component is created | Verification | `apps/web/src/components/ui/` does not exist. No new `.tsx` file anywhere in the repo. No `FormField`, `Input`, `Select`, `Button` or `NumberInput` component is defined (M30_P2+ scope) |
| **AC-22** | **Scope Guardrail** — exactly three files changed | Verification (SHA-256 content manifest) | See §4. Exactly `apps/web/src/components/designSystem.ts`, `apps/web/test/designSystem.test.ts` and `apps/web/test/designTokens.test.ts` differ between the pre- and post-execution manifests. Every other tracked-or-untracked file's hash is identical — **specifically including** `apps/web/src/components/calculators/CalculatorCard.tsx`, `apps/web/src/index.css`, `apps/web/src/App.tsx`, `apps/web/src/components/HopSection.tsx`, `apps/web/src/components/FermentableSection.tsx`, `apps/web/src/components/RecipeLibrary.tsx`, `package.json` and `package-lock.json` |
| **AC-23** | Layer 1 gate — test | Verification | `npm test` exits 0 |
| **AC-24** | Layer 1 gate — typecheck | Verification | `npm run typecheck` exits 0, 4/4 workspaces clean |
| **AC-25** | Layer 1 gate — build | Verification | `npm run build` exits 0 |
| **AC-26** | Layer 1 gate — lint | Verification | `npm run lint` exits 0, with **no new** warnings beyond the 4 pre-existing `only-export-components` warnings recorded in the 2026-08-24 baseline |

---

## 4. Scope Guardrail — Authorized File List & Verification Method

### 4.1 Authorized to modify (exactly 3)

1. `apps/web/src/components/designSystem.ts`
2. `apps/web/test/designSystem.test.ts`
3. `apps/web/test/designTokens.test.ts`

### 4.2 Authorized to create

**None.** No new source file, test file, directory, config file or dependency.

### 4.3 Explicitly forbidden

- Any file under `apps/web/src/components/` other than `designSystem.ts` — **`components/calculators/CalculatorCard.tsx` in particular.** It was read during planning and confirmed to hardcode its own byte-identical copies of `CARD_CLASS` (line 16) and `SUBPANEL_CLASS` (line 92), to use `rounded` where `INPUT_CLASS` uses `rounded-lg` (lines 39, 60), and to carry 2 of the 16 surviving `focus:outline-none` occurrences. **All of that is M30_P2/P3 work per the roadmap and must be left exactly as-is.** An executor that "helpfully" fixes it has failed AC-22.
- `apps/web/src/index.css` (RA-3, AC-19).
- `apps/web/src/pages/`, `apps/web/src/hooks/`, `packages/**`, `apps/api/**`.
- `package.json`, `package-lock.json`, any `tsconfig*.json`, `vite.config.ts`.
- `.gsd/ROADMAP.md`, `.gsd/DISCOVERY.md`, `.gsd/HARD_RULES.md`, `CLAUDE.md`, `.agents/**`, `.claude/**`.
- Any behavioural test file other than the two token test files.

### 4.4 How AC-22 is verified — SHA-256 manifest, **not** `git diff --name-only`

**`git diff --name-only` is NOT usable in this repository and must not be specified.** The repo has exactly **one** commit (`7d88e64`, "Restore GSD/Claude/Gemini architect framework + snapshot prototype"), and the entire `apps/web/` tree — every file this phase touches, plus every file it must prove untouched — is currently **staged-new or untracked** relative to it. A diff against `HEAD` would list hundreds of files as changed regardless of what the executor does, making the criterion unfalsifiable.

Instead, the executor must:

1. **Before the first edit**, capture a baseline manifest:
   ```
   git ls-files -co --exclude-standard -z | xargs -0 sha256sum > <scratch>/m30p1_pre.sha256
   ```
2. **After the last edit** (and after Layer 1 runs), capture:
   ```
   git ls-files -co --exclude-standard -z | xargs -0 sha256sum > <scratch>/m30p1_post.sha256
   ```
3. Diff the two manifests. The set of differing paths must be **exactly** the three files in §4.1, plus the two manifest files themselves if they were written inside the repo (write them to the scratchpad directory instead, so they do not appear).

Both manifests are written **outside** `.gsd/` and outside the repo working tree — use the session scratchpad. Their diff is reported verbatim in the `/execute` Layer 1 report so `/steer`'s critic can audit AC-22 without re-running anything.

---

## 5. Layer 1 Gates (`.gsd/HARD_RULES.md` rule 13)

All four run from the repo root and are reported by exit code — a green test suite alone is **not** a Layer 1 pass.

| Gate | Command | Pass condition |
|---|---|---|
| Test | `npm test` | exit 0; ≥1,970 passing, 0 failing, ≤2 skipped |
| Typecheck | `npm run typecheck` | exit 0; 4/4 workspaces clean |
| Build | `npm run build` | exit 0; Vite build completes |
| Lint | `npm run lint` | exit 0; no new warnings vs. the 4 pre-existing `only-export-components` warnings |

Baseline for all four is the 2026-08-24 `/map` stability check recorded in `.gsd/STATE.json` — the tree was **all-four-gates green before this phase**, so any failure is attributable to this phase's diff.

---

## 6. Manual Verification Evidence

One screenshot into `.gsd/active/manual_verification/`, captured after the build:

- **`M30_P1_focus_ring.png`** — a text input (any `INPUT_CLASS` consumer, e.g. the Recipe Library search field) reached by **keyboard Tab**, showing the 2px offset ring in the chosen colour, alongside or immediately followed by a second capture of the same field reached by **mouse click**, showing **no** ring (proving `:focus-visible` semantics, not `:focus`).

This is the phase's user-visible outcome and the one thing no unit test can fully prove — the tests assert the class strings; only the screenshot proves the cascade actually resolves in a real browser.

---

## 7. Out of Scope (named, so the critic can check for over-reach)

- Any `components/ui/` primitive — `FormField`, `Input`, `NumberInput`, `Select`, `Button` (M30_P2, M30_P3).
- Any consumer migration, including `CalculatorCard.tsx`'s `NumericField` / `SelectField` / `ResultRow` re-point and its hardcoded `CARD_CLASS` / `SUBPANEL_CLASS` duplicates (M30_P2, M30_P3).
- The `rounded` → `rounded-lg` reconciliation in the calculators (M30_P2).
- Label `htmlFor` / `id` association and the 78 unnamed controls (M31).
- Migrating any of the 20 `<label>` class-string variants onto `FORM_LABEL_CLASS` (M30_P2, M31_P4).
- Applying `CONTROL_HEIGHT_CLASS` to any control (M30_P2, RA-4).
- Size / variant axes on any token or component (M30_P2, RA-6).
- Adding a class-merging dependency (M30_P2, OQ-2).
- The adoption-assertion guardrail rewrite and the zero-raw-`<input>`/`<select>` sweep (M30_P4, M35).
- Reconciling the button/input ring-colour split that Option A introduces (M33 or M35).

---

> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments. A bare `SPEC_APPROVED` selects **OQ-1 Option A (amber)**; reply `SPEC_APPROVED — Option B` for sky. DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
