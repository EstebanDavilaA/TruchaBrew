# FEATURE SPECIFICATION: M40_P1 — Every control is big enough for a wet thumb (token + named layout sites + LAN reachability)

**Milestone:** 40 — "Every control is big enough for a wet thumb"
**Phase:** 1 of 2
**Initiative:** Ready to Hand to a Brewer (Milestones 40–43)
**Status:** AWAITING SPEC_APPROVED
**Drafted:** 2026-09-03 by `planner` (claude-code)

---

## Phase Summary

A brewer on a phone, standing at the kettle on their own home wifi, opens TruchaBrew
from the PC running it and drives the recipe, inventory, water-calculator, mash and
backup surfaces with one wet thumb. Every form control the Living Design System
renders is at least 44 CSS px tall. Nothing that was previously pinned to a fixed
pixel width squeezes the page sideways at a 375px viewport, and the metric/stat grids
that were hard-coded to 2 or 3 columns stack to one column on a phone instead of
crushing their contents. The dev server is reachable from the phone at all, which is
what makes any of the above verifiable on real glass rather than in a devtools
emulator.

This phase deliberately **excludes** `App.tsx` and `pages/BatchDetail.tsx`'s own
breakpoint work (deferred to M40_P2) and **excludes** `StickyJumpNav`'s mobile variant
entirely (see RA-2 — the roadmap's premise for it is stale). Rationale for both in
Resolved Ambiguities.

### Key Behaviors

1. `CONTROL_HEIGHT_CLASS` rises from `h-10` (40px) to `h-11` (44px), propagating
   app-wide through `Input`, `NumberInput` and `Select` with no per-consumer edits.
2. Three fixed-width sites become viewport-safe at 375px.
3. Three unconditional grids gain a mobile-first single-column base with a `sm:`
   restoration of their existing desktop column count — desktop rendering byte-identical.
4. `vite.config.ts` gains `server.host: true`, making the web UI LAN-reachable (the API
   already binds `0.0.0.0` at `apps/api/src/index.ts:21`).
5. Five test files pinning the old `h-10` string are **reconciled, not deleted**.
6. A new static source sweep asserts the 44px floor programmatically, so the claim is
   proven by exit code rather than by eyeball.

---

### Resolved Ambiguities (Binding)

**RA-1 — Phase split boundary: by regression risk, not by file count.**
Phase 1 is every change whose blast radius is either a single token file or a single
named line, all of which share one user-visible outcome (a 375px phone is operable).
Phase 2 is `App.tsx` (1,038 lines, **0 breakpoints** — confirmed by grep this session)
and `pages/BatchDetail.tsx` (1,569 lines, **6 breakpoints** — see RA-9; the roadmap's
"zero breakpoints between them" is inaccurate for BatchDetail). Those two files are
this roadmap's long-flagged fragile pair; a regression there is diagnosable only if it
is not landing in the same commit as a global token change that touches every form
control in the app. Both phases are vertical slices: P1 delivers "controls and layout
fit the phone", P2 delivers "the two biggest screens fit the phone". Neither is a
horizontal layer.

**RA-2 — `StickyJumpNav`'s mobile scroll variant is CUT from Milestone 40 and
escalated to the user. It is not deferred to P2 by default.**
The roadmap's hardening scope requires the variant be "verified against ALL current
consumers (recipe editor, equipment form, and the three profile forms from M39)".
**Those consumers do not exist.** `M39_P2_feature_spec.md` **Amendment 3** (2026-09-02,
user-directed) removed the `StickyJumpNav` render, its `useSectionScrollSpy` call and
its nav-item constants from **both** `App.tsx` (recipe editor) and `EquipmentForm.tsx`,
explicitly keeping only the primitive and its unit tests "for future reuse". Verified
this session: `grep` for `StickyJumpNav` across `apps/web/src` returns only
`ui/StickyJumpNav.tsx` itself, the `ui/index.ts` barrel re-export, and a doc comment in
`SectionCard.tsx`. **Zero JSX consumers. Zero of the five named consumers ever existed
in the state the roadmap assumes** — the three M39_P3 profile forms never received one.
Adding a responsive axis to a primitive that renders nowhere produces no user-visible
outcome (hard rule 2) and cannot meet its own stated verification threshold. It is
therefore out of scope. **This requires a user decision at `/steer` or before
SPEC_APPROVED:** either (a) leave `StickyJumpNav` unconsumed and drop the requirement
from Milestone 40, or (b) re-introduce the jump nav to named surfaces first — which is
reopening an M39 slice the user deliberately closed, and would be its own phase.
Nothing in this spec touches `StickyJumpNav.tsx`.
*Note:* the M35_P4 `uiPrimitives.test.tsx` "consumers > 0" guardrail does **not** cover
`StickyJumpNav` (its `primitives` array lists only FormField, Input, NumberInput,
Select, Button, Table, TableHeaderCell, TableCell, Badge), so no test currently fails
because of this. Confirmed by reading the test body.

**RA-3 — The token value is exactly `h-11`, not a `min-h-*` or an arbitrary value.**
Tailwind v4 (`^4.3.3`, confirmed in `apps/web/package.json`) resolves `h-11` to
`2.75rem` = **44px** at the default 16px root font size, satisfying WCAG 2.5.5
(Target Size, 44×44 CSS px) and the iOS HIG 44pt minimum. `h-11` is chosen over
`min-h-11` because `CONTROL_HEIGHT_CLASS` is composed alongside `INPUT_CLASS`'s
`py-2` in a fixed-height control; switching to a min-height would change the box model
for every consumer and is a larger change than this phase authorizes. The comparison is
**`>= 44px`**, inclusive — 44px exactly passes.

**RA-4 — Mobile breakpoint for the grid sites is Tailwind's `sm:` (640px), applied
mobile-first.**
Each of the three unconditional grids becomes `grid-cols-1 sm:grid-cols-N` where `N` is
that site's **existing** column count. This is not a new breakpoint token: `sm:` is
already the established stacking breakpoint at
`RefractometerFermentationModal.tsx:101` (`grid-cols-1 sm:grid-cols-2`),
`BackupRestoreModal.tsx:110` (`grid-cols-2 sm:grid-cols-4`) and six sites in
`BatchDetail.tsx`. Consistency with existing practice beats introducing a fourth
breakpoint convention. **At any viewport >= 640px every one of these three sites renders
exactly the column count it renders today** — this is the binding no-desktop-regression
condition.

**RA-5 — The roadmap's line numbers have drifted; the sites are identified by content,
not by line.** Verified this session:
- `App.tsx` `min-w-[280px]` is at **line 738**, not 754.
- `InventoryManager.tsx` `min-w-[200px]` at **line 212** (matches).
- `WaterCalculatorModal.tsx` `min-w-[170px]` at **line 798** (matches).
- `RefractometerFermentationModal.tsx` `grid-cols-2` at **line 147** (matches).
- `MashSection.tsx` `grid-cols-2` at **line 70** (matches).
- `BackupRestoreModal.tsx` **line 120 is `grid-cols-1`** — already mobile-safe and
  **NOT** a defect. The genuine unconditional grid in that file is **line 95**
  (`grid grid-cols-3 gap-2`, the `backup-restore-metadata` block). Line 95 is the site
  in scope; line 120 is explicitly untouched.
The executor must locate each site by its class string and surrounding testid, and must
**not** trust the line numbers if the file has shifted further.

**RA-6 — A fourth fixed-width site exists and is deliberately left alone.**
`BrewDayTracker.tsx:625` carries `[&>*]:min-w-[120px] sm:[&>*]:min-w-[130px]`. It is
already breakpoint-aware, 120px is safe inside a 375px viewport, and `BrewDayTracker` is
Milestone 41's primary surface. Touching it here would collide with M41. Out of scope,
named so its absence is not read as an oversight.

**RA-7 — Five test files pin `h-10`, not the two the roadmap names. All five are
reconciled in the same commit.**
Verified hit counts this session:
| File | `h-10` hits | Reconciliation |
|---|---|---|
| `apps/web/test/designSystem.test.ts` | 2 (line 76–77) | Update the exact-string pin and rename the `it()` from `M30_P1 AC-2` to note the M40_P1 revision |
| `apps/web/test/uiPrimitives.test.tsx` | 21 | Update positive `toHaveClass('h-10')` assertions to `'h-11'` |
| `apps/web/test/SettingsManager.test.tsx` | 1 (line 338) | Positive assertion — update to `'h-11'` |
| `apps/web/test/YeastSection.test.tsx` | 2 (lines 112, 117) | **Negative** assertions (`not.toHaveClass('h-10')`) proving compact inputs opt out. Update the string to `'h-11'` so the assertion keeps testing what it was written to test |
| `apps/web/test/FermentableSection.test.tsx` | 1 (line 237) | **Negative** assertion — same treatment |
The negative assertions are the subtle case: leaving them pinned to `'h-10'` would leave
them trivially, permanently true and silently stop guarding compact-variant opt-out. They
must be updated, not left alone because they still pass.

**RA-8 — The 44px sweep is a static source assertion, not a rendered measurement.**
The suite runs on jsdom, which performs **no layout** — `getBoundingClientRect()` returns
zeros and cannot prove a pixel height. The sweep is therefore implemented as a static
check (new file, see §2) asserting: (a) `CONTROL_HEIGHT_CLASS === 'h-11'`; (b) the three
primitives that compose it (`Input`, `NumberInput`, `Select`) still reference
`CONTROL_HEIGHT_CLASS` rather than a literal height; (c) no file under
`apps/web/src/components/` contains a `h-10`, `h-9`, `h-8` or `min-h-10` class on an
`<input>`, `<select>` or `<button>` element outside the documented compact-variant
exemptions. Real-pixel confirmation is the manual on-device evidence (AC-14), not a
test. This division is stated so no reviewer expects a computed-height assertion the
runtime cannot produce.

**RA-9 — Compact variants (`size="sm"`) are exempt from the 44px floor and stay
exempt.** `INPUT_COMPACT_CLASS` / `FORM_SELECT_COMPACT_CLASS` deliberately omit
`CONTROL_HEIGHT_CLASS` and are used for dense in-table row editing (fermentable/yeast
rows). Raising them is a table-density redesign, not this phase. The sweep in RA-8
exempts them explicitly by name. This is a knowing, documented WCAG 2.5.5 deviation on
dense tabular controls, carried forward from M30, and is **not** silently introduced here.

**RA-10 — `server.host: true` only; no `port`, no `strictPort`, no `hmr.host`.**
The existing `server.proxy` block is preserved verbatim. `host: true` binds
`0.0.0.0`. Vite's HMR websocket infers its host from the browser's location, so no
`hmr` config is needed for LAN use and adding one would break localhost. This is a dev
server change only — production hosting is Milestone 42 and is not started here.

---

## 1. Data Schema & Contracts

### Modified exported symbols

| Symbol | File | Before | After |
|---|---|---|---|
| `CONTROL_HEIGHT_CLASS` | `apps/web/src/components/designSystem.ts:57` | `'h-10'` | `'h-11'` |

**No other export in `designSystem.ts` changes.** Specifically untouched (their exact
strings are pinned by `designSystem.test.ts` lines 24–64 and any drift is a failure):
`BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `BUTTON_DANGER_CLASS`,
`BUTTON_ICON_CLASS`, `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `INPUT_UNDERLINE_CLASS`,
`FORM_SELECT_CLASS`, `FORM_SELECT_COMPACT_CLASS`, `FORM_LABEL_CLASS`.

### Untouched interfaces

No component prop interface changes in this phase. `StickyJumpNavProps`,
`StickyJumpNavItem`, `ButtonProps`, `InputProps`, `NumberInputProps`, `SelectProps`,
`SectionCardProps` are all unmodified. **No new `designSystem.ts` token is created**
(design-token governance, M30_P2) — this phase changes one existing token's value.

### Vite config contract

`apps/web/vite.config.ts`'s default export gains exactly one key inside the existing
`server` object: `host: true`. The `server.proxy['/api']` object — `target`,
`changeOrigin`, and the `process.env.PORT ?? 5177` expression — is preserved character
for character.

---

## 2. Transformations & Pure Logic

This phase introduces **no pure calculation logic**, no schema change, no API change and
no new runtime function. Every source edit is a declarative class-string or config
change. There is no stateful/pure split to document because there is no new state.

**New test-only artifact:** `apps/web/test/controlTargetSize.test.ts` — a static source
sweep (per RA-8). It reads files from disk with `fs`/`path` in the same style as the
existing M35_P4 and M36_P2 sweeps already in `uiPrimitives.test.tsx`; it renders nothing
and asserts nothing about computed layout. Its exemption list is a module-local constant
naming the compact-variant tokens from RA-9.

---

## 3. Acceptance Criteria & Test Matrix

### Token change

**AC-1** — `designSystem.ts` exports `CONTROL_HEIGHT_CLASS === 'h-11'` exactly. Not
`'h-11 '`, not `'min-h-11'`, not `'h-[44px]'`. Asserted by an updated exact-string pin
in `designSystem.test.ts`.

**AC-2** — Rendering `<Input />` with no `size` prop produces an element carrying class
`h-11` and **not** `h-10`. Same for `<NumberInput />` and `<Select options={...} />`.

**AC-3** — Rendering `<Input size="sm" />`, `<NumberInput size="sm" />` and
`<Select size="sm" />` produces elements carrying **neither** `h-10` **nor** `h-11`
(compact variants remain height-free per RA-9).

**AC-4** — `Input`, `NumberInput` and `Select` source files still import and compose
`CONTROL_HEIGHT_CLASS` from `../designSystem`; none inlines a literal height class.
Asserted statically.

**AC-5** — Every other exact-string pin in `designSystem.test.ts` (the ten tokens listed
in §1) passes **unmodified**. If the executor edited any of those assertion strings, this
AC fails even if the suite is green.

### Fixed-width sites

**AC-6** — `App.tsx`'s `min-w-[280px]` (line ~738, `flex-1` recipe-metadata block) no
longer forces a horizontal overflow at a 375px viewport. Resolution: the fixed
`min-w-[280px]` is replaced with a mobile-safe constraint (e.g. `w-full` base with the
280px floor restored at `sm:`). The container remains `flex-1`.

**AC-7** — `InventoryManager.tsx:212`'s search wrapper (`relative flex-1 min-w-[200px]
max-w-sm`) fits inside 375px minus `PageContainer`'s `px-4` (32px) plus its parent's
`gap-4`. The `Search` icon's absolute positioning and the `max-w-sm` cap still apply at
>= 640px.

**AC-8** — `WaterCalculatorModal.tsx:798`'s acid-type `<Select className="min-w-[170px]">`
does not push its row past the modal's inner width at 375px. The `aria-label="Acid Type"`,
the `id="acidTypeSelect"`, and the `ACID_TYPES` option mapping are unchanged.

**AC-9** — `BrewDayTracker.tsx:625` is **byte-identical** to its pre-phase state
(RA-6 scope guard).

### Grid sites

**AC-10** — `RefractometerFermentationModal.tsx:147` renders one column below 640px and
**two** columns at >= 640px. Its `METRIC_TILE_CLASS` / `METRIC_LABEL_CLASS` /
`MONO_VALUE_CLASS` usage and the `gap-3 pt-2` spacing are unchanged.

**AC-11** — `MashSection.tsx:70` (the `mash-plan` strike-water block) renders one column
below 640px and **two** at >= 640px. `MashSection.tsx:37`'s existing
`grid-cols-1 lg:grid-cols-2` is untouched.

**AC-12** — `BackupRestoreModal.tsx:95` (`backup-restore-metadata`) renders one column
below 640px and **three** at >= 640px. **`BackupRestoreModal.tsx:110`
(`grid-cols-2 sm:grid-cols-4`) and line 120 (`grid-cols-1`) are byte-identical to their
pre-phase state** (RA-5 — line 120 was a false positive in the roadmap and must not be
"fixed").

**AC-13** — Degenerate/empty-input case: each of the three grid sites renders its
container without throwing when its data source is empty or null (empty backup metadata,
a mash plan with `hasMashProfile === false`, a refractometer reading of `null`). The
existing `—` placeholder rendering is preserved; no placeholder leaks into a stored value.

### LAN reachability

**AC-14** — `vite.config.ts`'s config object contains `server.host === true` and its
`server.proxy['/api']` block is unchanged (target expression, `changeOrigin: true`).
Asserted by importing/reading the config in a test, or by static source assertion.

**AC-15** — Manual, on-device: with `npm run dev` running, the app loads on a phone at
`http://<LAN-IP>:5173` and at least one API-backed route renders real data (proving the
proxy still works when the request does not originate from localhost).

### Programmatic 44px sweep

**AC-16** — `apps/web/test/controlTargetSize.test.ts` exists and fails if
`CONTROL_HEIGHT_CLASS` is any value whose Tailwind height resolves below 44px. It must
be demonstrably capable of failing: reverting the token to `h-10` makes this file's
suite red. (The executor confirms this locally; it is not committed in a reverted state.)

**AC-17** — The sweep reports **zero** sub-44px height classes (`h-10`, `h-9`, `h-8`,
`min-h-10`) applied to interactive elements across `apps/web/src/components/`, excluding
only the RA-9 compact-variant tokens, which the sweep names explicitly in an exemption
constant with a comment citing RA-9.

### Manual verification evidence

**AC-18** — Screenshot evidence at 375px CSS width from a real phone over the LAN is
saved in `.gsd/active/manual_verification/` covering, at minimum: the recipe editor, the
inventory list, the water-calculator modal's acid row, the mash section's strike-water
block, the backup/restore modal's metadata block, and the refractometer modal. Each
screenshot shows **no horizontal page scroll**. Wide tables scrolling inside their own
`overflow-x-auto` container (`ui/Table.tsx:26`) is correct and is not a failure.

### Regression / scope guardrails

**AC-19** — All five test files named in RA-7 are updated and green. No test is deleted,
skipped, or `.only`'d. Total test count is **>= 2,659** (the audited pre-phase baseline)
plus the new sweep's cases — a net decrease in test count fails this AC.

**AC-20** — No existing desktop-breakpoint assertion changes behavior: every `sm:`,
`md:`, `lg:` class present in the tree before this phase is still present after it,
except where an AC above explicitly adds one. No breakpoint is removed.

**AC-21 — Scope Guardrail.** `git diff --name-only a9091a1 -- apps packages` — verified
viable this session: commit `a9091a1` ("Milestone 39 completed") is a real base and
that command currently returns **empty**, confirming the working tree's source is
identical to it, so a diff against it is a true record of this phase's changes. That
command must list **exactly** these files and no others:

```
apps/web/src/components/designSystem.ts
apps/web/src/App.tsx
apps/web/src/components/InventoryManager.tsx
apps/web/src/components/WaterCalculatorModal.tsx
apps/web/src/components/RefractometerFermentationModal.tsx
apps/web/src/components/MashSection.tsx
apps/web/src/components/BackupRestoreModal.tsx
apps/web/vite.config.ts
apps/web/test/designSystem.test.ts
apps/web/test/uiPrimitives.test.tsx
apps/web/test/SettingsManager.test.tsx
apps/web/test/YeastSection.test.tsx
apps/web/test/FermentableSection.test.tsx
apps/web/test/controlTargetSize.test.ts
```

Explicitly **must not** appear: `apps/web/src/components/ui/StickyJumpNav.tsx`,
`apps/web/src/components/ui/SectionCard.tsx`, `apps/web/src/pages/BatchDetail.tsx`,
`apps/web/src/components/BrewDayTracker.tsx`, `apps/web/src/components/ui/index.ts`,
anything under `apps/api/`, anything under `packages/`.

**AC-22 — Layer 1, four gates (hard rule 13).** `npm test`, typecheck (4/4 workspaces),
build, and lint each exit 0. A green test suite with a failing build or lint is not a pass.

---

## 4. Authorized Files

**Authorized for modification** — exactly the fourteen files listed in AC-21.

**Explicitly UNTOUCHED** (any change is an AC-21 failure):
- `apps/web/src/components/ui/StickyJumpNav.tsx` and `apps/web/test/StickyJumpNav.test.tsx` (RA-2)
- `apps/web/src/components/ui/SectionCard.tsx`, `ui/index.ts`, `ui/Button.tsx`, `ui/Input.tsx`, `ui/NumberInput.tsx`, `ui/Select.tsx`, `ui/Table.tsx`, `ui/FormField.tsx`, `ui/Badge.tsx` — the primitives inherit the token change with **no source edit**; needing to edit one means the token change was done wrong
- `apps/web/src/pages/BatchDetail.tsx` (M40_P2)
- `apps/web/src/components/BrewDayTracker.tsx` (RA-6 / M41)
- `apps/web/src/components/MobileNav.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `PageContainer.tsx`, `index.html` — the M26/M28 responsive shell, already correct
- All of `apps/api/`, all of `packages/`, all migrations and schema

**Legacy cleanup in scope:** none. There is no obsolete registration loop, legacy token
alias, or dead map to purge in this phase — the token is a single string constant with
three composing call sites, all of which stay. If the executor finds one, it is reported,
not removed.

---

## 5. Open Item Requiring User Decision Before Execution

**RA-2's `StickyJumpNav` question.** Milestone 40's roadmap scope lists the jump-nav
mobile variant as a deliverable, and this spec cuts it as unbuildable-as-specified. If
the user wants the jump nav back in the app, that is a separate phase and the roadmap's
"Estimated phases: 2" for Milestone 40 becomes 3. Answer at SPEC_APPROVED or at `/steer`.

**Related open items reviewed, none pulled in:** `.gsd/BUGS.md` BUG-026 through BUG-039
are `OPEN` responsive/layout defects across settings, profile forms, batch detail and
inventory. Several overlap this milestone's *theme* (notably BUG-036/037/038's "input
height standardization", which the AC-1 token change partially satisfies as a side
effect). **None is claimed as resolved by this phase and none is moved to
`IN_PLANNING`**, because each also carries grid-architecture and physics-derivation
scope well beyond M40_P1's authorized files. Closing any of them requires its own
scoping pass. BUG-043 (rare test flake) remains `OPEN` and is explicitly not a blocker;
if it fires during Layer 1, re-run rather than diagnose.
