# FEATURE SPECIFICATION: M40_P3 — The Button primitive clears 44px, and the sweep can finally see it

**Milestone:** 40 — "Every control is big enough for a wet thumb"
**Phase:** 3 of 3 (closing phase)
**Drafted:** 2026-09-03 (`claude-code`, `/plan`)
**Depends on:** M40_P1 (`CONTROL_HEIGHT_CLASS` → `h-11`, the `controlTargetSize.test.ts` sweep) and M40_P2 (`App.tsx`'s five bespoke `<button>`s routed through the `Button` primitive — without that, a token raise could not reach them).

> ### ⚠ AMENDMENT 1 — 2026-09-03 (post-Layer-1-FAIL corrective pass)
> This spec was approved, executed, and **FAILed Layer 1** (`test`): `apps/web/test/designTokens.test.ts`'s
> pre-existing M35_P4 guardrail *"consumers > 0 for all `designSystem.ts` tokens"* flagged
> `CONTROL_MIN_HEIGHT_CLASS` and `ICON_CONTROL_SIZE_CLASS` as unconsumed, because RA-4 deliberately designed both
> as composition-only tokens consumed exclusively inside `designSystem.ts` (never by an external component file).
> Per hard rule 4 this routed through `/diagnose`: **DIAGNOSIS: spec error** — RA-4's design is sound and is
> **not** revisited by this amendment; the gap is that this spec never reconciled that design against
> `designTokens.test.ts`, which wasn't on the original Authorized Files list. **This is a same-phase amendment,
> not a new phase.** All 19 original ACs are unchanged; **AC-20 is appended** and `designTokens.test.ts` is added
> to Authorized Files with a narrow, self-verifying exemption (RA-12). Typecheck/build/lint were already
> independently confirmed green on the pre-amendment build; only the one test-suite failure is addressed here.

---

## Phase Summary

Milestone 40's verification threshold says *"zero interactive controls compute below 44px, asserted by a source sweep."* M40_P2's `/plan` found — and RA-4/RA-5 of `M40_P2_feature_spec.md` recorded — that this is currently false for the single most-used interactive control in the app, and that the P1 sweep is structurally blind to it.

Independently re-verified against the working tree at drafting time:

- `apps/web/src/components/designSystem.ts:42-49` sizes all four button tokens by **padding only**. None references `CONTROL_HEIGHT_CLASS`, and none carries any height class:
  - `BUTTON_PRIMARY_CLASS` / `BUTTON_SECONDARY_CLASS` — `px-4 py-2`, text-sm content ⇒ **≈36-38px** (`SECONDARY` adds a 1px border).
  - `BUTTON_DANGER_CLASS` — `px-3 py-2` + border ⇒ **≈38px**.
  - `BUTTON_ICON_CLASS` — `p-2` around a `w-4 h-4` icon ⇒ **32 × 32px**.
- `apps/web/src/components/ui/Button.tsx:34` applies `size="sm"` as `text-xs px-3 py-1.5` ⇒ **≈28px**.
- `apps/web/test/controlTargetSize.test.ts` only scans for the literal strings `h-10`/`h-9`/`h-8`/`min-h-10` on `<input>`/`<select>`/`<button>` opening tags. A padding-sized element declares none of them, so **the sweep passes today while every button in the app is under 44px.**

Blast radius, measured not assumed: `BUTTON_*_CLASS` is imported by **exactly two files** — `designSystem.ts` (definition) and `ui/Button.tsx` (sole consumer); there are **no** raw-button consumers of the tokens left after P2. Rendered `Button` usage is app-wide: **101** `<Button size="sm">` sites across 35 files and **28** `variant="icon"` sites.

This phase does three things and nothing else:

1. **Raises the button control-height tokens to ≥44px app-wide** by introducing two sibling tokens next to `CONTROL_HEIGHT_CLASS` (`CONTROL_MIN_HEIGHT_CLASS`, `ICON_CONTROL_SIZE_CLASS`) and composing them into the four `BUTTON_*_CLASS` strings — one edit point, reaching every `Button` in the app, both sizes, all four variants.
2. **Extends `controlTargetSize.test.ts` to resolve padding-derived heights**, not just explicit `h-N` classes, so this entire class of gap becomes test-visible going forward instead of silently passing.
3. **Reconciles the tests the token raise breaks** — the exact-string pins in `designSystem.test.ts` and the `size="sm"` class assertions in `uiPrimitives.test.tsx` / `BatchNoteLog.test.tsx`, plus any further rendered-class assertion the full suite surfaces.

### Key Behaviors

- Every `Button`, in every variant and both sizes, computes to at least 44 CSS px of height (44 × 44 for `variant="icon"`), at the app's 16px root font size.
- No visual identity changes: colors, radii, borders, font weights, horizontal padding and the `text-xs` small-size type ramp are all preserved byte-for-byte. The only thing that changes is a height floor.
- The static sweep gains a padding-derived height resolver and fails loudly (throws) on any Tailwind utility it cannot resolve, rather than silently returning a wrong number.

### Resolved Ambiguities (Binding)

- **RA-1 — `size="sm"` DOES rise to 44px; no dense-tabular exception applies to `Button`.** This was checked against real consumers rather than assumed. Of the 101 `<Button size="sm">` sites, exactly **two** sit inside a table row — `StockCheckPanel.tsx:255` (Undo) and `:266` (Deduct) — and both live in a cell already declared `align-top` beside a multi-line description cell, so the row is taller than 44px regardless. The dense in-table controls that M40_P1's **RA-9 exemption** protects are `INPUT_COMPACT_CLASS` / `FORM_SELECT_COMPACT_CLASS` (and M40_P2's `INPUT_UNDERLINE_CLASS`) — *compact number/select fields*, not action buttons. That distinction is kept deliberately: a mistap on a compact number field is self-correcting, a mistap on a `Deduct` or a row-delete button mutates data. **The RA-9 exemption list is not extended in this phase**, and `size="sm"` keeps its `text-xs` type ramp and `px-3` horizontal padding — it stays visually "small", it just stops being untappable.
- **RA-2 — `variant="icon"` becomes a fixed 44 × 44 square, and the row-height cost in the four dense section tables is accepted.** `variant="icon"` appears 28 times, including the row-delete control in `FermentableSection.tsx:87`, `HopSection.tsx:295`, `YeastSection.tsx:69` and `MiscSection.tsx:109`. Raising it from 32px to 44px adds up to ~12px to those rows. That is accepted rather than exempted: these are the *destructive* controls on the exact screens Milestone 40 exists to make thumb-operable, and the rows already contain `size="sm"` `NumberInput`s plus cell padding, so the delta is a single-digit-percentage row-height increase, not a layout redesign. Width is pinned as well as height (`h-11 w-11`) because a 44px-tall, 32px-wide target still fails WCAG 2.5.5.
- **RA-3 — text buttons get `min-h-11`, not `h-11`; the icon button gets `h-11 w-11`.** At a 375px viewport a long label (e.g. "Advance to Fermentation") can wrap to two lines; a fixed `h-11` would leave the text overflowing a 44px box. `min-h-11` is a floor that grows. The icon button holds a single fixed-size glyph and can never wrap, so it takes an exact square. Both resolve ≥44px under the sweep (RA-6 treats `min-h-N` as the resolved height when present).
- **RA-4 — the height lands in the tokens, composed from two new exported constants, not inlined as bare literals and not applied inside `Button.tsx`.** Three options were weighed. (a) Applying `CONTROL_HEIGHT_CLASS` inside `Button.tsx` (mirroring `Input`/`NumberInput`/`Select`) would leave `BUTTON_*_CLASS` still resolving under 44px as exported strings, so the sweep's token-level assertion could not be written — and any future direct consumer of the token would silently regress. Rejected. (b) Inlining bare `min-h-11` / `h-11 w-11` literals into the four token strings works but creates a second, uncoordinated source of the "44" magic number alongside `CONTROL_HEIGHT_CLASS`. Rejected. (c) **Chosen:** export `CONTROL_MIN_HEIGHT_CLASS = 'min-h-11'` and `ICON_CONTROL_SIZE_CLASS = 'h-11 w-11'` as siblings of `CONTROL_HEIGHT_CLASS` in the same block, and compose them into the four `BUTTON_*_CLASS` strings via template literal. One conceptual source of the 44px floor, three named tokens the sweep can assert directly, and the exported `BUTTON_*_CLASS` values remain plain resolvable class strings.
- **RA-5 — `size="sm"` needs no height token of its own.** Because the floor lives on the base variant token and `size="sm"` only *overrides* `text-*` and `px-*`, the small size inherits `min-h-11` automatically. There is no `BUTTON_SM_*` token, and none is introduced. This is why one edit reaches all 101 small-button sites.
- **RA-6 — how the sweep resolves a padding-derived height (binding algorithm).** The extended resolver takes a class string plus an optional content-height override and returns `{ px: number, basis: 'height' | 'min-height' | 'padding' }`, resolving in this order:
  1. A bare `h-<N>` utility present ⇒ `px = N * 4`, basis `'height'`. (`N` may carry one decimal place, e.g. `h-3.5`.)
  2. Else a bare `min-h-<N>` utility present ⇒ `px = N * 4`, basis `'min-height'`. *(This is a change from P1's resolver, which deliberately refused `min-h-*`; RA-3 now requires it. `min-h-10` and friends remain in `SUB_44PX_HEIGHT_CLASSES` and still fail the AC-17 scan.)*
  3. Else padding-derived, basis `'padding'`: `px = contentPx + padTop + padBottom + borderPx`, where
     - `padTop`/`padBottom` come from `py-<N>` if present, else from `p-<N>`, each `N * 4` px (`py-1.5` ⇒ 6px each). `py-*` wins over `p-*` when both appear.
     - `borderPx` is `2` when the string contains a bare `border` or a `border-<N>` width utility (`border-2` ⇒ 4), and `0` when it contains only `border-<color>` utilities. Directional border utilities (`border-b`, `border-t`, …) contribute `1` each.
     - `contentPx` is the caller-supplied override when given (used for icon-only elements, whose content is a glyph, not a line box); otherwise it is the Tailwind default line-height of the string's text-size utility: `text-xs` ⇒ 16, `text-sm` ⇒ 20, `text-base` ⇒ 24, `text-lg` ⇒ 28, `text-xl` ⇒ 28. **Absent any text-size utility, `contentPx` is 20** (inherited `text-sm` body default).
  4. Any `h-`/`min-h-`/`p-`/`py-`/`text-` utility whose value the resolver cannot parse — arbitrary values (`h-[42px]`), fractional widths, unknown text sizes — **throws** with the offending class named, in the same fail-loudly style as P1's `resolveTailwindHeightPx`. Silent fallbacks are forbidden: an unresolvable token must break the build, not quietly pass.
  This is a **static string calculation, not a rendered measurement.** M40_P1's RA-8 still holds: the suite runs on jsdom, which performs no layout, so `getBoundingClientRect()` cannot prove a pixel height here. Real-pixel confirmation remains the manual on-device evidence.
- **RA-7 — the sweep is extended over the `ui/` primitives and the design tokens, NOT over the app's remaining raw `<button>` elements.** There are ~27 raw `<button>`s left across 15 files (`MashProfileForm` ×4, `FermentationProfileForm` ×4, `BrewDayTracker` ×3, `SectionCard`/`Sidebar`/`MobileNav`/`BrewDayTimelineBar` ×2 each, and nine singletons), several of them padding-sized below 44px (`CellarActionFeed.tsx:188`, `SplitPackagingPanel.tsx:105`, `WaterSection.tsx:119`, `BatchList.tsx:56` — all `px-3 py-1.5`). Sweeping those into a hard failure would drag an unbounded raw-button migration into a closing phase. Instead they are **frozen as an enumerated allowlist** (AC-12): the sweep records the exact set of known padding-derived sub-44px raw-button sites and asserts equality against it, so the existing debt is visible and documented while **any newly added one fails the suite**. This mirrors the documented-but-never-closed raw-element exemption already carried at `uiPrimitives.test.tsx:907`. Closing that allowlist out is explicitly **not** in this phase (see RA-10).
- **RA-8 — `StickyJumpNav`'s padding-based tokens are out of scope.** `ui/StickyJumpNav.tsx:42,44` carry `px-4 py-2` / `px-3 py-1.5` local constants, but M40_P2's roadmap correction records the primitive has **zero JSX consumers** today. It renders nowhere, so it cannot be a touch target. It is excluded from the sweep's primitive scan by name, with that reason recorded in the file (AC-13).
- **RA-9 — no open `BUGS.md` / `FEATURES.md` item is absorbed into this phase.** Both files were checked for button-sizing/touch-target entries. `BUGS.md` has none open on this subject. `FEATURES.md:507` mentions "minimum 44px tap targets" only inside a historical milestone description (the M29 claim the roadmap already corrects as never-implemented, and which Milestone 40 is delivering for real). Nothing new is logged and nothing is pulled forward.
- **RA-10 — this phase is correctly sized to close Milestone 40 at three phases; it is not over-scoped.** Assessed against the risk the task explicitly asked about. The token change is **4 lines in one file plus 2 new exports**; the sole rendering consumer is one 44-line primitive; there are **zero** other importers of the tokens. The test-reconciliation surface is bounded and enumerated below (3 known files, ~7 assertions) because the app's tests overwhelmingly assert on `data-testid`/role/text rather than on button class strings. What is *deliberately not* attempted here — and would have made the phase too large — is the ~27-raw-button migration (RA-7) and any dense-table row-height redesign (RA-2). **Milestone 40 closes at 3 phases.** The residual raw-button debt is frozen and visible under AC-12, and is left for a future milestone to schedule if the user wants it; it is not a Milestone 40 acceptance gap, because the milestone's threshold is about the primitives and the six named sites.
- **RA-11 — the scope guardrail cannot use `git diff --name-only`, and does not.** Checked, not assumed: `HEAD` is `a9091a1` ("Milestone 39 completed") and **all of M40_P1's and M40_P2's source changes are still uncommitted** in the working tree (`git show HEAD:apps/web/src/components/designSystem.ts` still reads `CONTROL_HEIGHT_CLASS = 'h-10'`). A diff against any meaningful base commit would therefore report P1's and P2's files as this phase's changes and prove nothing. AC-16 accordingly specifies a **pre/post SHA-256 content manifest** instead.
- **RA-12 — `designTokens.test.ts`'s AC-11 guardrail gains a narrow, self-verifying exemption for internal-composition-only tokens; it is not weakened generally.** *(new, Amendment 1)* The guardrail's actual intent (per its own M35_P4 framing) is catching **dead** tokens — exported but never referenced anywhere, drift left behind by a refactor. `CONTROL_MIN_HEIGHT_CLASS`/`ICON_CONTROL_SIZE_CLASS` are not dead: they are referenced inside `designSystem.ts` itself, composed into the four `BUTTON_*_CLASS` strings — RA-4 already established (and this amendment does not revisit) that this is the *correct* location for them, not a workaround. The fix is therefore a named, minimal allowlist inside the test file, not a loosened assertion:
  - Add a module-local `COMPOSITION_ONLY_TOKENS: string[]` array in `designTokens.test.ts`, initially `['CONTROL_MIN_HEIGHT_CLASS', 'ICON_CONTROL_SIZE_CLASS']`, with a comment stating these are intentionally consumed only within `designSystem.ts` itself (citing M40_P3 RA-4/RA-12).
  - The AC-11 test excludes names in this list from the "zero external consumers" check, but — to keep the guardrail meaningful rather than a blank check — **also asserts each allowlisted name is referenced at least once inside `designSystem.ts`'s own source, outside its own declaration line** (a token that appears in neither an external file nor a second place in its own file is still flagged as genuinely dead). This keeps the guardrail able to catch a *future* truly-orphaned token while permitting today's two legitimate composition-only ones.
  - No other token is added to this allowlist by this amendment. Adding a name to it in the future without a real composition use is exactly the drift this guardrail exists to prevent — the comment must say so.

---

## 1. Data Schema & Contracts

### Exported constants — `apps/web/src/components/designSystem.ts`

**Added (2):**

| Symbol | Value | Purpose |
|---|---|---|
| `CONTROL_MIN_HEIGHT_CLASS` | `'min-h-11'` | 44px height *floor* for controls whose content may wrap (all text buttons). Sibling of `CONTROL_HEIGHT_CLASS`; declared in the same block with a comment explaining floor-vs-fixed. |
| `ICON_CONTROL_SIZE_CLASS` | `'h-11 w-11'` | Fixed 44 × 44 square for icon-only controls, which cannot wrap and need both axes pinned. |

**Modified (4)** — composed via template literal from the constants above; every other utility in each string is preserved in its existing order, with the height utility appended at the front of the composed string:

| Symbol | Resolved height after | Change |
|---|---|---|
| `BUTTON_PRIMARY_CLASS` | ≥44px (`min-h-11`, md and sm) | gains `CONTROL_MIN_HEIGHT_CLASS` |
| `BUTTON_SECONDARY_CLASS` | ≥44px | gains `CONTROL_MIN_HEIGHT_CLASS` |
| `BUTTON_DANGER_CLASS` | ≥44px | gains `CONTROL_MIN_HEIGHT_CLASS` |
| `BUTTON_ICON_CLASS` | 44 × 44px | gains `ICON_CONTROL_SIZE_CLASS` |

**Untouched (explicit):** `CONTROL_HEIGHT_CLASS` (`'h-11'`), `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `INPUT_UNDERLINE_CLASS`, `FORM_SELECT_COMPACT_CLASS`, `FORM_LABEL_CLASS`, and every typography/layout token in the file. No token is removed or renamed.

### Component contract — `apps/web/src/components/ui/Button.tsx`

**Unchanged:** `ButtonProps`, `ButtonVariant` (`'primary' | 'secondary' | 'danger' | 'icon'`), `ButtonSize` (`'sm' | 'md'`), `VARIANT_MAP`, the `sizeClass` expression (`size === 'sm' && variant !== 'icon' ? 'text-xs px-3 py-1.5' : ''`), the two `layoutClass` branches, and the `className` merge order. **This file is expected to require no edit at all** (AC-14) — the height arrives through the tokens it already imports. If the executor finds an edit is unavoidable, it must be justified in the execution report against RA-4.

### Test helper contract — `apps/web/test/controlTargetSize.test.ts`

Module-local (not exported to `src/`):

- `resolveControlHeightPx(classString: string, contentPx?: number): { px: number; basis: 'height' | 'min-height' | 'padding' }` — implements RA-6 exactly. Throws on any unresolvable utility.
- `RA9_COMPACT_VARIANT_EXEMPTIONS` — **unchanged** (`INPUT_COMPACT_CLASS`, `FORM_SELECT_COMPACT_CLASS`, `INPUT_UNDERLINE_CLASS`). Not extended (RA-1).
- `SUB_44PX_HEIGHT_CLASSES` — **unchanged** (`h-10`, `h-9`, `h-8`, `min-h-10`).
- `RAW_BUTTON_SUB_44PX_ALLOWLIST: string[]` — new; the frozen enumeration required by AC-12 and RA-7.
- P1's `resolveTailwindHeightPx` is **superseded by** `resolveControlHeightPx` and removed; its two call sites (the AC-16 token assertion) move to the new resolver. No dead alias is left behind.

### Refactoring / legacy cleanup (explicit)

- Remove `resolveTailwindHeightPx` once its callers move — no shim, no re-export.
- Do **not** leave the old `min-h-*`-refusing comment block in place once RA-6 changes the behavior; update the doc comment to describe the new order-of-resolution.
- No obsolete registration loop, map alias, or side effect is known in this area; the executor must report any it finds rather than leaving it.

---

## 2. Transformations & Pure Logic

`resolveControlHeightPx` is a **pure function of a string** (plus an optional number): same input ⇒ same output, no filesystem access, no React, no rendering. All filesystem walking stays in the `it()` bodies, exactly as P1 structured it. The function must not consult `process`, `fs`, or any module-level mutable state.

Return-value contract for the no-match / degenerate cases:

| Input | Result |
|---|---|
| `''` (empty string) | `{ px: 20, basis: 'padding' }` — no height class, no padding, no border, default `text-sm` content. Must not throw. |
| `'p-2'`, `contentPx = 16` | `{ px: 32, basis: 'padding' }` |
| `'text-xs px-3 py-1.5'` | `{ px: 28, basis: 'padding' }` |
| `'min-h-11 px-4 py-2 border'` | `{ px: 44, basis: 'min-height' }` — the height class short-circuits; padding and border are **not** added on top. |
| `'h-[42px]'` | **throws**, naming `h-[42px]` |

The caller (each `it()` block) branches on `basis` only for reporting/diagnostic message text; the numeric assertion is always `px >= 44`.

---

## 3. Acceptance Criteria & Test Matrix

| # | Criterion | Type | Verification |
|---|---|---|---|
| AC-1 | `CONTROL_MIN_HEIGHT_CLASS` is exported from `designSystem.ts` and is exactly `'min-h-11'`. | Automated | `designSystem.test.ts` exact-string assertion. |
| AC-2 | `ICON_CONTROL_SIZE_CLASS` is exported from `designSystem.ts` and is exactly `'h-11 w-11'`. | Automated | `designSystem.test.ts` exact-string assertion. |
| AC-3 | `CONTROL_HEIGHT_CLASS` is still exactly `'h-11'` — unchanged by this phase. | Automated | Existing `controlTargetSize.test.ts` AC-1 assertion passes untouched. |
| AC-4 | `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS` and `BUTTON_DANGER_CLASS` each contain `min-h-11`, and `resolveControlHeightPx` on each returns `px >= 44`. | Automated | `controlTargetSize.test.ts`, one assertion per token, computed — not a string match on `'min-h-11'` alone. |
| AC-5 | `BUTTON_ICON_CLASS` contains `h-11 w-11`, and `resolveControlHeightPx(BUTTON_ICON_CLASS, 16)` returns `px >= 44`. Its **width** is separately asserted ≥44px by parsing `w-11`. | Automated | `controlTargetSize.test.ts` — both axes, per RA-2. |
| AC-6 | The composed `size="sm"` class string for each of `primary`/`secondary`/`danger` (base token + `'text-xs px-3 py-1.5'`) resolves to `px >= 44`. | Automated | `controlTargetSize.test.ts` — composes the string the same way `Button.tsx` does, per RA-5. This is the AC that proves one token edit reached all 101 small-button sites. |
| AC-7 | Every non-height utility of all four `BUTTON_*_CLASS` tokens survives byte-identically: colors, `hover:` states, `rounded-*`, `border*`, font weight, `transition-colors`, `cursor-pointer`, `disabled:opacity-*`, and the horizontal padding (`px-4`, `px-3`, `p-2`). | Automated | Updated exact-string pins in `designSystem.test.ts` — the new expected strings differ from the old ones **only** by the prepended height utility. |
| AC-8 | `resolveControlHeightPx` implements RA-6's order of resolution: `h-N` ⇒ `basis:'height'`; else `min-h-N` ⇒ `basis:'min-height'` (padding **not** added on top); else padding-derived ⇒ `basis:'padding'`. | Automated | Dedicated unit `describe` in `controlTargetSize.test.ts` with at least the five table rows in §2, asserting both `px` and `basis`. |
| AC-9 | `resolveControlHeightPx('')` returns `{ px: 20, basis: 'padding' }` and does not throw (degenerate input). | Automated | Unit assertion. |
| AC-10 | `resolveControlHeightPx` **throws**, naming the offending class, for an arbitrary-value height (`'h-[42px]'`) and for an unknown text-size utility. It never returns a fallback number for an unresolvable utility. | Automated | `expect(() => …).toThrow(/h-\[42px\]/)` and equivalent. |
| AC-11 | Padding math is exact at the boundary: `py-1.5` contributes 6px per side (not 4, not 8), a bare `border` contributes 2px total, `border-slate-700` alone contributes 0px, and `py-*` overrides `p-*` when both are present. | Automated | Four separate unit assertions — these are the exact rules a rounding error would silently break. |
| AC-12 | The sweep enumerates the known padding-derived sub-44px **raw** `<button>` sites under `src/components/` and `src/pages/` in `RAW_BUTTON_SUB_44PX_ALLOWLIST`, and asserts the discovered set is **equal** to that allowlist (not a subset). A newly introduced sub-44px raw button fails the suite; the existing ones are documented debt, not a silent gap. Each entry carries `file:line`. | Automated | `controlTargetSize.test.ts` — `expect(discovered).toEqual(allowlist)`. Per RA-7. |
| AC-13 | `ui/StickyJumpNav.tsx` is excluded from the primitive scan **by name, with the zero-consumers reason stated in an in-file comment** citing RA-8 — not silently skipped and not deleted. | Automated + review | Named constant in the test file; comment present. |
| AC-14 | `ui/Button.tsx` is **unchanged** (byte-identical against the AC-16 manifest). `ButtonProps`, `ButtonVariant`, `ButtonSize`, `VARIANT_MAP`, the `sizeClass` ternary and the `className` merge order are all untouched. Any deviation is justified in writing against RA-4. | Automated | Manifest comparison + existing `uiPrimitives.test.tsx` Button suite. |
| AC-15 | Test reconciliation is complete and is an *update*, not a deletion: `designSystem.test.ts` (4 `BUTTON_*` pins), `uiPrimitives.test.tsx` (the `variant` assertions at ~220/228/234/240, the `size="sm"` pin at ~724, the `AC-10` token-composition check at ~471, and the small-button pin at ~810) and `BatchNoteLog.test.tsx` (~189) assert the **new** expected strings. No test is deleted, skipped, or weakened to a substring match where it previously pinned an exact string. | Automated + review | Full suite green; diff review confirms no `it.skip`/`describe.skip` added and no assertion removed. |
| AC-16 | **Scope guardrail — content-manifest diff, not `git diff`.** `git diff --name-only` against a base commit is **not viable here** (RA-11: `HEAD` = `a9091a1` predates all of M40_P1/P2, whose changes are still uncommitted). The executor therefore takes a SHA-256 content manifest **before its first edit** and again at the end — `git ls-files -co --exclude-standard -z \| xargs -0 sha256sum` — and the files whose hashes changed must be **exactly** the Authorized Files list below (plus `.gsd/` bookkeeping). Both manifests are retained in the execution report. | Automated | Manifest diff, quoted in the execution report. |
| AC-17 | The existing AC-17 scan (sub-44px explicit height classes on `<input>`/`<select>`/`<button>` under `components/`) still passes unmodified, and the RA-9 exemption list is **still exactly** `['INPUT_COMPACT_CLASS', 'FORM_SELECT_COMPACT_CLASS', 'INPUT_UNDERLINE_CLASS']` — not extended for buttons (RA-1). | Automated | `controlTargetSize.test.ts`. |
| AC-18 | All four Layer 1 gates pass: full test suite, typecheck, build, lint. Test count is ≥ the M40_P2 baseline of **2,691 passed / 2 skipped across 136 files**; any net change is explained per-file in the execution report. Lint stays at 0 errors (5 pre-existing warnings tolerated). | Automated | `/execute` Layer 1. |
| AC-19 | **Manual, user-confirmed (carried, not claimable by the executor):** on a real phone at 375px CSS width, the dense section tables (Fermentables, Hops, Yeast, Misc) remain readable and the row-delete icon buttons are comfortably tappable after the RA-2 height raise. Screenshot evidence in `.gsd/active/manual_verification/`. | Manual | User confirmation at `/steer`. The executor must **not** mark this passed. |
| AC-20 `[NEW]` | `designTokens.test.ts`'s AC-11 guardrail passes with `CONTROL_MIN_HEIGHT_CLASS`/`ICON_CONTROL_SIZE_CLASS` exempted via the named `COMPOSITION_ONLY_TOKENS` allowlist (RA-12), and the exemption is itself checked: each allowlisted name must still resolve at least one reference inside `designSystem.ts`'s own source outside its declaration line, or the test fails. No other existing assertion in `designTokens.test.ts` (AC-12 through AC-21 in that file's own numbering) changes behavior. | Automated | `designTokens.test.ts` |

---

## Authorized Files

*(Amendment 1 — adds one file to the original four. `[+]` marks the Amendment-1 addition.)*

1. `apps/web/src/components/designSystem.ts` — add 2 exported constants, compose them into 4 `BUTTON_*_CLASS` strings.
2. `apps/web/test/controlTargetSize.test.ts` — the RA-6 resolver, the RA-7 allowlist, the new token/size assertions; remove `resolveTailwindHeightPx`.
3. `apps/web/test/designSystem.test.ts` — 4 updated exact-string pins + 2 new token pins.
4. `apps/web/test/uiPrimitives.test.tsx` — updated Button class assertions.
5. `[+]` `apps/web/test/designTokens.test.ts` — RA-12/AC-20 only: add the `COMPOSITION_ONLY_TOKENS` allowlist and its self-verifying check inside the existing AC-11 `it()` block. No other test in this file (AC-12 through AC-21) may be touched.

Plus, **conditionally**: `apps/web/test/BatchNoteLog.test.tsx` (its ~line 189 `size="sm"` assertion), and any additional `apps/web/test/*.test.ts(x)` file whose **only** change is updating a Button-class assertion to the new token strings. Every such extra file must be individually enumerated in the execution report with the assertion that changed and why; an extra file touched for any other reason is an AC-16 failure.

**Explicitly untouched** (any hash change is an AC-16 failure): `apps/web/src/components/ui/Button.tsx`, every other file under `src/components/ui/`, `App.tsx`, `pages/BatchDetail.tsx`, all 35 files containing `<Button size="sm">`, all 15 files containing raw `<button>` elements, `vite.config.ts`, `packages/**`, and `apps/api/**`.
