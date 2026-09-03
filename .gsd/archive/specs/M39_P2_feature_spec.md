# FEATURE SPECIFICATION: M39_P2 — Recipe Editor & Equipment Form Sectioning

> ### ⚠ AMENDMENT 1 — 2026-09-02 (post-Layer-2-FAIL corrective pass: scroll-spy listener target)
> This spec was approved, executed, and **FAILed Layer 2** (`critic` audit, `.gsd/archive/CRITIC_REPORT.md` M39_P2 entry, 2026-09-02: 40 YES / 4 PARTIAL — AC-10, AC-11, AC-23, AC-32 — / 0 NO). Per hard rule 4 it routed through `/diagnose`. **This is a same-phase corrective amendment, not a new phase — no `M39_P3` is opened.**
>
> **Root cause (diagnosed — cause 2, spec error):** the spec's `useSectionScrollSpy` contract said "attach a passive scroll + resize listener" (spec §1 and §2) but never pinned the **listener target**. The executor attached to `window` (bubble phase). The app shell is `h-screen overflow-hidden` and the real scroll container is `PageContainer`'s `<main data-testid="page-container">` — the sole `overflow-y-auto` owner. Because `scroll` events do **not** bubble, real content scrolling fires on `<main>` and never reaches a bubble-phase `window` listener — so in the running app the active nav highlight is computed once on mount and never follows scroll or nav clicks. The green suite masked this: every scroll-spy test dispatched synthetic `window` scroll events — the exact mechanism the hook listened on. The sectioning/collapse/caption/CRUD work itself is correct; the scope guardrail held at exactly 15 authorized files.
>
> **What changed in Amendment 1:**
> - **AC IDs 1–44 stay stable.** AC-10, AC-11, AC-23, AC-32 amended in place and marked `[AMENDED]`; no AC renumbered, retired, or reused.
> - **AC-45 … AC-47 appended** for the fix's new obligations (real-container listener proof, matching-capture cleanup, suite-masking guardrail).
> - **RA-1 … RA-6 added** (§0) — the binding scroll-container target (capture-on-`window`), the `onNavigate` ruling, the app-shell scroll convention, and the suite-masking-avoidance requirement.
> - Authorized Files list **path set unchanged** — Amendment 1 adds **no new source file**; the fix is confined to the already-authorized `useSectionScrollSpy.ts` (listener mechanics) plus reconciliation of the already-authorized test files.
> - Layer-1 baseline updated to **2,659 passed / 2 skipped across 135 files** (the tree the fix runs on top of).
>
> **Baseline for this pass:** the working tree as it stands *after* the original M39_P2 execution (all 15 authorized files in place, Layer 1 green). This pass is a **delta** on top of that work, not a rebuild from the pre-M39_P2 tree.

> ### ⚠ AMENDMENT 2 — 2026-09-02 (UX refinement: sticky jump nav anchored flush under the app header)
> User feedback while using the app (post-Amendment-1, before /steer): the sticky `StickyJumpNav` "gets in the middle of the screen while scrolling, showing above the other sections." **Same-phase amendment — no `M39_P3` is opened.**
>
> **Diagnosis (cause 2, spec error):** the P1 primitive default `STICKY_BAR_CLASS = 'sticky top-16 …'` was chosen on the (wrong) assumption that the app TopBar is sticky inside the same scroll context the nav must clear. In reality the shell is `h-screen overflow-hidden`; `TopBar` is a **static flex header ABOVE** the sole scroll-owning `<main data-testid="page-container">` (`flex-1 overflow-y-auto`). Because the nav lives inside that `<main>`, `sticky top-16` parks it **64 px down into the content column**, floating over sections with content visible above it — the reported look. No AC or test caught it (jsdom does not assert pixel positions).
>
> **Resolution (binding, user-approved):** keep the sticky jump nav in **both** the Recipe Editor and the Equipment Form, but anchor it **flush under the app header** — change the default sticky offset from `top-16` → `top-0` so the bar sticks at the very top of the scroll container (directly under the TopBar) as a clean anchored sub-header.
>
> - **RA-7** (new, binding): `apps/web/src/components/ui/StickyJumpNav.tsx`'s module-local `STICKY_BAR_CLASS` is changed from `sticky top-16 z-20 …` to **`sticky top-0 z-20 …`** (flush under the app header), and its inline comment is corrected (TopBar is a static flex header above the sole scroll-owning `<main>`; the bar needs `top-0`, not `top-16`, which left a 64 px gap). Both consumers (Recipe Editor `App.tsx`, `EquipmentForm.tsx`) use the default and need no source change — a single primitive edit fixes both. Do **not** reintroduce a `top-*` offset.
> - **Authorized files (Amendment 2):** `apps/web/src/components/ui/StickyJumpNav.tsx` is **moved from UNTOUCHED to authorized** for this one scoped edit (sticky offset + comment only). No other source file changes. Test reconciliation: the executor checks for any suite pinning the old `top-16`/offset (none expected — jsdom does not assert pixel positions; nav render/item/highlight assertions are unaffected).
> - **No AC renumbering.** AC-9/AC-22 (nav renders N items), AC-10/11/23/32 (highlight driven by the scroll-spy on the real container), and AC-45/46/47 are all **unaffected** — this is purely a presentation correction. Baseline unchanged at **2,661 passed / 2 skipped across 135 files**.

> ### ⚠ AMENDMENT 3 — 2026-09-02 (user-directed removal of the StickyJumpNav jump-nav + its scroll-spy from the Recipe Editor and the Equipment Form)
> After Amendments 1–2 the user reported the sticky jump-nav still reads as unprofessional: a `position: sticky` bar cannot ride up into its scroll container's `py-6` top padding, leaving a 24 px band under the app header through which sections visibly scroll (verified live in the running app: the bar stuck at y=88, 24 px below main's top at y=64). **User decision (binding, via askQuestions): remove the jump nav entirely from BOTH the Recipe Editor and the Equipment Form** (and drop the scroll-spy wiring), **keeping** the M39_P2 sectioning value: the collapsible `SectionCard` ingredient cards, the six equipment `SectionCard`s, the section `id`s, the folder datalist, and the `FormField` `hint` captions. **Same-phase amendment — no `M39_P3` is opened.**
>
> **What changed (code — already executed, independently Layer-1 green at 2,646 passed / 2 skipped across 134 files):**
> - `apps/web/src/App.tsx` (Recipe Editor): removed the `StickyJumpNav` render + `useSectionScrollSpy` call + `RECIPE_NAV_ITEMS`/`RECIPE_SECTION_IDS` + their imports/comments. Kept MashSection/WaterSection/the four sectioned components/StyleTargetPanel/folder datalist/save–CRUD.
> - `apps/web/src/components/EquipmentForm.tsx`: same removal set (nav render, `EQUIPMENT_NAV_ITEMS`/`EQUIPMENT_SECTION_IDS`, spy call, imports/comments). Kept the six `SectionCard`s + hint captions.
> - DELETED (dead after both callers removed): `apps/web/src/hooks/useSectionScrollSpy.ts`, `apps/web/test/useSectionScrollSpy.test.ts`.
> - Test reconciliation: `M39_P2_RecipeEditorSectioning.test.tsx` (removed AC-9/10/11 + the now-unused scrollIntoView stub; a helper timing fix to `waitFor` was also applied to align with App.test.tsx), `M39_P2_EquipmentSectioning.test.tsx` (removed AC-22/23/47 + stub + unused `act` import), `apps/web/test/EquipmentManager.test.tsx` (its M5.5 anti-modal assertion had referenced the nav's `.backdrop-blur`; changed to expect **0** `.backdrop-blur` elements, preserving the anti-modal intent). `apps/web/test/EquipmentManager.test.tsx` is **added to the authorized set** for this reconciliation.
> - KEPT intact: `components/ui/StickyJumpNav.tsx` + `StickyJumpNav.test.tsx` (the P1 primitive + its unit tests remain for future reuse; only its in-app usage was removed), `SectionCard` + its tests, all section/caption/CRUD code.
>
> **AC & RA reconciliation (binding):** the nav/scroll-spy surface is removed, so these ACs are **SUPERSEDED (no longer active)** and their tests removed: **AC-9, AC-10, AC-11** (recipe nav render/click/highlight), **AC-22, AC-23** (equipment nav render/click), **AC-47** (real-container highlight), and the scroll-spy portions of **AC-32** and **AC-37** (the spy now has zero callers and was deleted). **RA-1…RA-7** (scroll-spy listener target, app-shell scroll convention, `onNavigate` ruling, suite-masking, manifest method, sticky offset) concern the removed nav/spy and are **superseded** for M39_P2's shipped scope (RA-2's app-shell scroll fact remains true but no longer has a P2 consumer). The remaining ACs — sectioning/collapse/caption/CRUD (**AC-1…8, 12…21, 24…31 minus the spy tests, 33…36, 38…44**) — remain active and green. **Test-count note:** the suite total dropped to 2,646 passed / 2 skipped across 134 files because nav/spy tests were removed — expected for a removal, not a regression; all remaining tests pass (exit 0), typecheck 4/4, build clean, lint 0 errors / no new warnings.
>
> **Authorized files (Amendment 3, code — already applied):** `apps/web/src/App.tsx`, `apps/web/src/components/EquipmentForm.tsx` (removal edits); DELETED `apps/web/src/hooks/useSectionScrollSpy.ts`, `apps/web/test/useSectionScrollSpy.test.ts`; MODIFIED `apps/web/test/M39_P2_RecipeEditorSectioning.test.tsx`, `apps/web/test/M39_P2_EquipmentSectioning.test.tsx`, `apps/web/test/EquipmentManager.test.tsx` (reconciliation). No `.gsd/` file is edited by the executor.

## Phase Summary

Milestone 39 (FEAT-005 umbrella) delivers app-wide form sectioning: complex data-entry
forms gain accordion section cards (`SectionCard`), a sticky jump-navigation bar
(`StickyJumpNav`) for instant section focus, and brewing-guidance captions under inputs.

**P1 shipped the two primitives only** (`SectionCard`, `StickyJumpNav`) with zero form
changes. **P2 (this phase) is the first phase that *applies* them to real, user-visible
forms**: the Recipe Editor and the Equipment Form.

### CRITICAL CODEBASE REALITY — resolved by inspection (binding)

**There is no `RecipeEditor.tsx` anywhere in the repo.** `file_search **/RecipeEditor*.tsx`
returns nothing. The ROADMAP's "`RecipeEditor.tsx`" label is stale. The **Recipe Editor
form** is the `view === 'editor'` composition inside **`apps/web/src/App.tsx`**, which
renders — in DOM order — an identity/metadata header card, `StatsHeader`, `StyleTargetPanel`,
then six sibling section components: `MashSection`, `WaterSection`, `FermentableSection`,
`HopSection`, `YeastSection`, `MiscSection`.

`FEAT-005` (the umbrella's own detail text) describes the Recipe Editor scope as
**"Collapsible ingredient cards, sticky jump nav bar, inline summary chips"** — i.e. the
four *ingredient* sections (Fermentables, Hops, Yeast, Miscs), not the Mash/Water
profile-selection cards. P2 therefore sections the **four ingredient sections** (each is a
single, cleanly-titled `<div className={CARD_CLASS}>` + `<h3>` card whose header carries a
non-interactive summary — an exact fit for `SectionCard`'s title/icon/`badge`/`collapsible`
axis), and adds a sticky jump nav to the Recipe Editor over those four.

**`MashSection` and `WaterSection` of the Recipe Editor are explicitly NOT SectionCard'd in
P2.** Binding reason: `MashSection` nests two titled groups (Mash Profile + Fermentation)
inside one untitled outer card, and `WaterSection` is a multi-part composite; neither maps
to a single-titled `SectionCard` without a sub-split refactor that is out of P2's bounded
scope. Their dedicated test suites (`MashSection.test.tsx`, `WaterSection.test.tsx`) assert
only internal `mash-*` / `water-*` testids, never the outer shell, so leaving them untouched
introduces zero reconciliation risk. `StatsHeader`, `StyleTargetPanel`, and the identity
header card are also **not** wrapped. (Whether the Mash/Water recipe-editor cards need their
own sectioning in a later phase is flagged for `/steer`; it is not a P2 defect.)

**`EquipmentForm.tsx`** is a single self-contained form component (hosted inside
`EquipmentManager`) composed of **six** hand-rolled `<div className={CARD_CLASS}>` section
shells (some carrying `data-testid="equipment-*-section"`), mostly headed by
`<h4 className={SECTION_HEADING_CLASS}>`. It maps cleanly and completely to six
`SectionCard`s in P2.

### Key Behaviors
1. **Recipe Editor (App.tsx):** the four ingredient section components
   (`FermentableSection`, `HopSection`, `YeastSection`, `MiscSection`) render as
   **collapsible** `SectionCard`s (heading level 3, default-open), each anchored by a stable
   `id`; a single `StickyJumpNav` is added in the editor composition listing those four
   sections, and the page (`App.tsx`) owns the controlled active-highlight state.
2. **EquipmentForm:** its six section shells become **non-collapsible** `SectionCard`s
   (heading level 4), plus its own `StickyJumpNav` (owned by `EquipmentForm` itself), and a
   representative set of fields gain brewing-guidance captions via `FormField`'s existing
   `hint` axis.

---

## 0. Resolved Ambiguities (Binding)

- **Section taxonomy — Recipe Editor (stable `id`s = jump targets).** The four ingredient
  sections get these `SectionCard` `id`s (used verbatim as DOM `id` and as `StickyJumpNavItem.id`):
  `recipe-fermentables`, `recipe-hops`, `recipe-yeast`, `recipe-miscs`. Sticky nav item
  labels: `Fermentables`, `Hops`, `Yeast`, `Miscs`. `MashSection`/`WaterSection`/identity
  header/`StatsHeader`/`StyleTargetPanel` are **not** nav items and are not wrapped.
- **Section taxonomy — EquipmentForm (stable `id`s).** Six `SectionCard`s with these ids and
  titles:
  | SectionCard `id` | Title | Current shell evidence |
  |---|---|---|
  | `equipment-general` | **General** | today's untitled first card (Profile Name + 7 core numeric fields) — a `title` is *added* (the card currently has none) |
  | `equipment-altitude` | Altitude & Atmospheric Physics | today `<div data-testid="equipment-altitude-section">` |
  | `equipment-thermal-mass` | Thermal Mass & Mash Strike Energy Balance | today `<div data-testid="equipment-thermal-mass-section">` |
  | `equipment-losses` | Vessel Losses & Dead Space | today `<div data-testid="equipment-losses-section">` |
  | `equipment-hopstand` | Hopstand & Whirlpool Parameters | today's untitled `<h4>` "Hopstand & Whirlpool Parameters" card |
  | `equipment-notes` | Notes | today's Notes card |
  Equipment jump-nav items (5 — **Notes is deliberately excluded** from the nav, it is a
  trivial trailing card): `General`, `Altitude`, `Thermal Mass`, `Losses`, `Hopstand`.
- **`data-testid` preservation (binding).** `SectionCard` emits `data-testid={`${id}-section`}`
  on its root `<section>`. Choosing `id="equipment-altitude"` therefore re-emits the exact
  existing `data-testid="equipment-altitude-section"` (likewise
  `equipment-thermal-mass-section`, `equipment-losses-section`). Any existing test that
  queries those shell testids keeps passing **without modification**. New `SectionCard`s
  introduce new testids `equipment-general-section`, `equipment-hopstand-section`,
  `equipment-notes-section` (and DOM `id`s = the `id` values).
- **Collapsibility split (binding).** The **four Recipe-Editor ingredient sections are
  COLLAPSIBLE** (`defaultOpen` true, so content is visible on first paint and existing
  behavior is unchanged until a user clicks); the **six EquipmentForm sections are
  NON-collapsible**. Binding rationale: every ingredient header carries only a
  non-interactive summary (an exact `badge`-slot fit), whereas the `equipment-thermal-mass`
  header carries an interactive **checkbox** (`equipment-field-calcStrikeWithThermalMass`).
  A collapsible `SectionCard` header is a `<button>` and cannot host that checkbox; keeping
  EquipmentForm non-collapsible avoids relocating a header control and avoids behavior/tests
  churn. Collapsing one card never closes another (independent disclosures — per P1).
- **Badge slot adoption (Recipe Editor).** Each ingredient section's existing non-interactive
  header summary moves into the `SectionCard` `badge` slot (rendered as a non-interactive
  `<span>` inside the disclosure `<button>`): Fermentables → "Total: …"; Hops → the
  "Total Hops / Estimated IBU" block (keeps `data-testid="estimated-ibu-display"`); Miscs →
  the italic "Stored with the recipe…" note; Yeast → no badge (none exists today). All are
  non-interactive, satisfying P1's badge-slot contract.
- **Heading levels (binding).** Recipe Editor ingredient sections: `headingLevel={3}`
  (matches today's `<h3>`). EquipmentForm sections: `headingLevel={4}` (matches today's
  `<h4>`). The `General`/`Notes` EquipmentForm cards gain a level-4 heading they did not
  previously have (they had no heading).
- **Caption mechanism — NO new primitive.** `FormField` (in `components/ui/`) already
  exposes a `hint?: string` prop rendered as a `METADATA_TEXT_CLASS` caption under the field
  when no error is shown. P2 therefore adds **caption copy only** (new `hint` strings) on a
  representative subset of `EquipmentForm` fields. `FormField.tsx`, `SectionCard.tsx`,
  `StickyJumpNav.tsx`, and `designSystem.ts` are all **untouched**. Recipe-Editor ingredient
  fields are inline `NumberInput`s inside tables (not `FormField`s), so ingredient captions
  are out of P2 scope — captions are delivered on `EquipmentForm` where the `FormField`/`hint`
  mechanism is the real, existing consumer.
- **StickyJumpNav is fully controlled; the page owns `activeId`.** `StickyJumpNav` runs no
  internal scroll-spy (P1 contract). The Recipe Editor page (**`App.tsx`**) owns the active
  id for the recipe nav; **`EquipmentForm`** owns the active id for the equipment nav. Active
  derivation is delegated to a new shared hook `useSectionScrollSpy` (one real, non-speculative
  abstraction with exactly two consumers). No-match contract (from P1, preserved): if no
  section element exists, `activeId` stays `undefined` and **no** nav item is highlighted
  (no first-item fallback at the hook level when zero elements exist).
- **Nav placement (binding).** Recipe nav renders as the first child of the editor content
  region — immediately **before** `MashSection` inside `PageContainer` — so it is visible and
  sticky from the top of the sectioned area. Equipment nav renders as the first child inside
  the `<form>` (above the `General` card). Both use the shipped default sticky layout; no
  page-specific `top` tuning is required in P2. **[AMENDED — Amendment 2]** The default anchor is
  **flush under the app header**: `STICKY_BAR_CLASS` is `sticky top-0` (not `top-16`), because the
  TopBar is a static flex header ABOVE the sole scroll-owning `<main data-testid="page-container">`,
  so the bar sticks at the very top of the scroll container directly under the TopBar (RA-7). The
  prior "the default clears `TopBar`" rationale was wrong (it assumed a sticky TopBar in the same
  scroll context) and is superseded by RA-7.
- **Existing markup/test churn & reconciliation rule.** Expected: the four shared ingredient
  components also render inside `BatchRecipeAdjustModal.tsx`; because they are converted to
  `SectionCard`, the modal's three inner cards become standardized too — **no edit to
  `BatchRecipeAdjustModal.tsx`** (the sections take an optional `sectionId` prop defaulting to
  the canonical id, so the modal needs no change and no duplicate-id conflict arises because
  the editor and the modal are never mounted on the same page). Existing test suites that pin
  now-removed wrapper structure may require **assertion-level reconciliation only** (never the
  removal or weakening of an existing behavior assertion) — see Authorized Files. All
  behavior-bearing queries (headings by role/name, field `data-testid`s, tables, totals by
  text) continue to resolve because default-open keeps content mounted and `SectionCard`
  preserves `CARD_CLASS`/heading semantics.
- **No new design tokens.** All class strings needed are already provided by `SectionCard`
  / `StickyJumpNav` module-local constants and existing `designSystem.ts` tokens. `designSystem.ts`
  and `designSystem.test.ts` are untouched.

### Amendment 1 — Resolved Ambiguities (binding)

- **RA-1 — Scroll-listener target: capture-phase listener on `window`.** `useSectionScrollSpy`
  attaches its `scroll` listener to **`window` with `{ capture: true, passive: true }`**, and
  removes it on cleanup with the matching **`{ capture: true }`** (a non-capture remove would
  silently leak the listener). The `resize` listener stays on `window` (non-capture; `resize`
  targets `window`). Rationale: (a) the real scroll container — `PageContainer`'s
  `<main data-testid="page-container">`, the sole `overflow-y-auto` owner of the app shell —
  emits **non-bubbling** `scroll` events, so a plain bubble-phase `window` listener never fires
  on real scroll; capture descends `window → … → <main>` regardless of bubbling, so it observes
  the container's scroll for free. (b) The hook is called **unconditionally** at the page level
  (`App.tsx` across switching views; `EquipmentForm` when mounted), so the container element is
  not a stable, always-present ref the hook can target by id/query across views —
  capture-on-`window` is container-agnostic and needs **no signature change**. The public
  signature stays `useSectionScrollSpy(sectionIds): string | undefined`. Do **not** regress to a
  bubble-phase `window` scroll listener.
- **RA-2 — App-shell scroll convention (binding for all future scroll work).** The shell is
  `h-screen overflow-hidden`; `PageContainer` renders
  `<main data-testid="page-container" class="flex-1 overflow-y-auto …">`, and that `<main>` is
  the **sole scroll owner** of the app shell — `window`/`document` never scroll. Any code that
  must react to user scrolling MUST attach to that `<main>` (direct listener) or to `window`
  with `{ capture: true }`. A plain `window.addEventListener('scroll', …)` (bubble phase) will
  NOT fire on real content scrolls. A full-page form renders its own single `PageContainer`;
  views are never nested under a second scroll owner in practice (e.g. `EquipmentManager`
  early-returns `EquipmentForm` standalone).
- **RA-3 — `onNavigate` ruling: the forms do NOT pass `onNavigate`.** `App.tsx` and
  `EquipmentForm` render `<StickyJumpNav items={…} activeId={spyResult} />` with **no
  `onNavigate`**; the P1 primitive already performs click → guarded
  `scrollIntoView({behavior:'smooth',block:'start'})` internally. `activeId` is derived
  **solely** by the scroll-spy: after a nav click's smooth `scrollIntoView`, the container emits
  `scroll` events that the RA-1 capture listener observes, so the highlight re-syncs to the
  target section as it reaches the 96 px offset. No click handler sets `activeId` directly —
  adding one would create two competing highlight mechanisms. Consequently AC-10/AC-23's
  "fires `onNavigate`" clause is removed (see amended AC text).
- **RA-4 — Hook caller context.** The recipe spy runs while `App.tsx` is mounted regardless of
  the current view; when no `recipe-*` section is in the DOM (non-editor views) the hook returns
  `undefined` and no nav item highlights (no-match contract, unchanged). The overhead of an
  inert capture listener is negligible and acceptable; do **not** gate the hook call on
  `view === 'editor'`.
- **RA-5 — Suite-masking avoidance (binding for tests).** jsdom cannot exercise real layout
  scroll, so a scroll-spy test is only meaningful if it dispatches its `scroll` on the **real
  scroll container** — a rendered `main[data-testid="page-container"]` element reached via
  `screen.getByTestId('page-container')` — and verifies the capture listener observes it. A
  test that dispatches a synthetic `scroll` on `window` alone does **not** prove the real-app
  mechanism (it is exactly what masked the bug) and is no longer accepted as evidence. The
  reconciled `useSectionScrollSpy.test.ts` and the M39_P2 integration suites follow this rule.
- **RA-6 — Scope-guardrail method (RA-14-style).** AC-43/AC-44 use a **pre/post SHA-256
  content-manifest diff**, not `git diff --name-only`, because this repo has very few commits on
  `master` and the working tree carries large uncommitted framework modifications (`.agents/`,
  `.claude/`, `.gsd/`), so no committed baseline isolates "what the executor changed". The
  executor must capture the **before** manifest before its first Amendment-1 edit (reuse
  `/tmp/m39p2_manifest_before.txt` if still present — the original P2 execution already wrote
  one — else re-capture with `git ls-files -co --exclude-standard -z | xargs -0 sha256sum | sort`)
  and the **after** manifest at the end; the added/changed path set must remain a subset of the
  Authorized Files set (unchanged by this amendment).

---

## 1. Data Schema & Contracts

### Shipped primitive APIs being consumed (do NOT reinvent — from P1, re-verified against source)
- `SectionCard` props: `id: string` (required; written verbatim as root `<section>` DOM id
  and used for `data-testid={`${id}-section`}`), `title: ReactNode`, `headingLevel?:
  1|2|3|4|5|6` (default 2), `icon?`, `badge?` (non-interactive slot; inside toggle when
  collapsible), `collapsible?` (default false), `defaultOpen?` (default true),
  `open?`/`onToggle?` (controlled mode iff `open !== undefined`), `children?`, `className?`.
  Non-collapsible heading carries `data-testid={`${id}-title`}`; collapsible toggle carries
  `data-testid={`${id}-toggle`}`, `aria-expanded`, `aria-controls={`${id}-panel`}`; the body
  always carries `data-testid={`${id}-panel`}` and is unmounted when a collapsible card is
  closed.
- `StickyJumpNav` props: `items: readonly {id,label}[]`, `activeId?: string`, `onNavigate?:
  (id:string)=>void`, `className?`. Empty `items` ⇒ renders `null`. Root `<nav>` has
  `data-testid="jump-nav"`; each item is a `<button data-testid={`jump-${id}`}>` with
  `aria-current="true"` when active. `resolveActiveIndex(items, activeId): number` is
  exported from `StickyJumpNav.tsx` (−1 on empty/undefined/no-match; first-match wins).
  Click → `onNavigate(id)` then guarded `scrollIntoView({behavior:'smooth',block:'start'})`.
- `FormField` already has `hint?: string` (rendered under the field, hidden when `error`).

### NEW source: `apps/web/src/hooks/useSectionScrollSpy.ts`
```ts
/**
 * Page-owned active-section derivation for the fully-controlled StickyJumpNav.
 * Attaches one passive CAPTURE-PHASE scroll listener on window
 * ({capture:true, passive:true}) plus a passive resize listener on window (RA-1);
 * resolves the active section id by document order. Returns undefined iff NONE of
 * `sectionIds` correspond to a live DOM element (P1 no-match contract: caller leaves
 * activeId undefined and no nav item highlights). Cleanup removes both listeners on
 * unmount (the scroll one with the matching {capture:true}).
 */
export function useSectionScrollSpy(sectionIds: readonly string[]): string | undefined;

/** Deterministic pure core (unit-testable without a DOM scroll):
 *  @param getTop  (id: string) => number | null  — element's boundingClientRect().top,
 *                 or null when the element does not exist.
 *  @param offset  pixels; the derived active threshold. Caller passes the page's
 *                 sticky-nav clearance (use 96).
 *  Returns: undefined when every getTop returns null;
 *           else the LAST section (by `sectionIds` order) whose top <= offset;
 *           else (all tops > offset, i.e. still above the first section) the FIRST id. */
export function computeActiveSectionId(
  sectionIds: readonly string[],
  getTop: (id: string) => number | null,
  offset: number,
): string | undefined;
```
The hook implementation must read the live DOM via `document.getElementById(id)?.getBoundingClientRect().top`
inside the listener (the target `SectionCard`s live in child components; there are no refs to
thread through).

**[AMENDED — Amendment 1]** The `scroll` listener is attached to **`window` with
`{capture:true, passive:true}`**, never a plain bubble-phase listener (RA-1). Rationale: the
hook is called unconditionally at the page level (`App.tsx` across switching views;
`EquipmentForm` when mounted), so the real scroll container — `PageContainer`'s
`<main data-testid="page-container">` — is not a stable element the hook can target by
ref/id across views; and because `scroll` does not bubble, a bubble-phase `window` listener
would never observe the container's scroll. Capture on `window` observes non-bubbling scroll
from the container for free. The public signature is **unchanged**; no container parameter is
added.

### Symbol inventory

**NEW files (authorized to be created):**
| File | Role |
|------|------|
| `apps/web/src/hooks/useSectionScrollSpy.ts` | shared active-section derivation (2 consumers) |
| `apps/web/test/M39_P2_RecipeEditorSectioning.test.tsx` | recipe ingredient cards + recipe nav contract (renders the `App` editor) |
| `apps/web/test/M39_P2_EquipmentSectioning.test.tsx` | equipment `SectionCard`s + equipment nav + captions |
| `apps/web/test/useSectionScrollSpy.test.ts` | pure `computeActiveSectionId` + hook wiring |

**MODIFIED files (source — exact scope below):**
| File | Edit |
|------|------|
| `apps/web/src/components/FermentableSection.tsx` | outer shell → collapsible `SectionCard` `id={sectionId ?? 'recipe-fermentables'}`, `headingLevel={3}`, title "Fermentables & Malts", `icon` `Wheat`, `badge` = total, add optional `sectionId?: string` prop |
| `apps/web/src/components/HopSection.tsx` | same pattern, `id` default `recipe-hops`, title "Hops & Contextual Hop Schedule", `icon` `Sprout`, `badge` = Total Hops + IBU block (keeps `estimated-ibu-display` testid), optional `sectionId?: string` |
| `apps/web/src/components/YeastSection.tsx` | same, `id` default `recipe-yeast`, title "Yeast Strain & Fermentation", `icon` `FlaskConical`, no badge, optional `sectionId?: string` |
| `apps/web/src/components/MiscSection.tsx` | same, `id` default `recipe-miscs`, title "Misc & Water Agents", `icon` `Droplet`, `badge` = italic note, optional `sectionId?: string` |
| `apps/web/src/App.tsx` | add `StickyJumpNav` (before `MashSection`) with the four ingredient items + `useSectionScrollSpy(['recipe-fermentables','recipe-hops','recipe-yeast','recipe-miscs'])` for `activeId`; pass no `sectionId` (defaults used) |
| `apps/web/src/components/EquipmentForm.tsx` | six sections → `SectionCard`s (`equipment-general/altitude/thermal-mass/losses/hopstand/notes`, `headingLevel={4}`, non-collapsible, icons retained: `Mountain`/`Flame`/`Gauge`), add own `StickyJumpNav` + `useSectionScrollSpy`, add `hint` captions on representative fields |

**MODIFIED files (existing-test reconciliation — assertion-level only, allowed where the
executor finds a pinned-removed-markup assertion):**
`apps/web/test/FermentableSection.test.tsx`, `apps/web/test/HopSection.test.tsx`,
`apps/web/test/YeastSection.test.tsx`, `apps/web/test/MiscSection.test.tsx`,
`apps/web/test/App.test.tsx`, `apps/web/test/EquipmentForm.test.tsx`,
`apps/web/test/EquipmentManager.test.tsx`, `apps/web/test/BatchRecipeAdjustModal.test.tsx`,
`apps/web/test/accessibilityAndPolish.test.tsx`.
(Reconciliation = adjusting a query that pinned removed wrapper markup to the equivalent new
`SectionCard` structure. No behavior assertion may be deleted or weakened. If a suite needs
no edit, it is simply not touched.)

**UNTOUCHED (explicit):** `MashSection.tsx`, `WaterSection.tsx`, `StatsHeader.tsx`,
`StyleTargetPanel.tsx`, `SettingsManager.tsx`, `WaterProfileForm.tsx`, `MashProfileForm.tsx`,
`FermentationProfileForm.tsx`, `BatchRecipeAdjustModal.tsx` (source), `components/ui/*`
(including `SectionCard.tsx`, `StickyJumpNav.tsx`, `FormField.tsx`, `index.ts`),
`components/designSystem.ts`, `designSystem.test.ts`, every `packages/*`, `apps/api/*`,
`.gsd/*`. **No `.gsd/STATE.json`, `.gsd/ROADMAP.md`, or `.gsd/FEATURES.md` edit is made by
this spec** (orchestrator owns those).

**[AMENDED — UNTOUCHED carve-out for Amendment 2]** The single exception added by Amendment 2:
`apps/web/src/components/ui/StickyJumpNav.tsx` is **moved from UNTOUCHED to authorized** for the
one scoped edit defined by RA-7 (change `STICKY_BAR_CLASS` sticky offset `top-16` → `top-0` and
correct its inline comment). No other `components/ui/*` file changes; `SectionCard.tsx`,
`FormField.tsx`, `index.ts`, `designSystem.ts` remain byte-identical.

**[AMENDED — Authorized Files for Amendment 1]** Amendment 1 adds **no new source file** to the
authorized set. The fix is confined to files already authorized by the base spec:
- `apps/web/src/hooks/useSectionScrollSpy.ts` (already MODIFIED) — change the `scroll` listener
  to **capture-phase on `window`** (`{capture:true, passive:true}`) and its cleanup to the
  matching `{capture:true}` (RA-1). **No signature change** to `useSectionScrollSpy` or
  `computeActiveSectionId`.
- `apps/web/src/App.tsx`, `apps/web/src/components/EquipmentForm.tsx` (already MODIFIED) — must
  **not** pass `onNavigate` to `StickyJumpNav` (RA-3); they already mount the spy and pass only
  `activeId`. No further source edit required; if either was implemented with an `onNavigate`
  during the first execution it must be removed.
- Test reconciliation (already authorized NEW/MODIFIED test files):
  `apps/web/test/useSectionScrollSpy.test.ts` (render a `page-container` `<main>`, dispatch
  `scroll` on it, assert capture registration/removal), `apps/web/test/M39_P2_RecipeEditorSectioning.test.tsx`
  (AC-11 dispatches `scroll` on the real container), `apps/web/test/M39_P2_EquipmentSectioning.test.tsx`
  (AC-47 container-dispatch highlight assertion).

### Caption copy (binding — representative EquipmentForm subset; exact strings)
Add these `hint` values (empty-string/whitespace never emitted; a caption is only shown when
no `error` is present — `FormField` existing behavior):
| Field key | Label | New `hint` |
|---|---|---|
| `batchSizeL` | Batch Size | `Volume of beer you plan to package; drives the whole water & gravity pipeline.` |
| `boilTimeMin` | Boil Time | `Standard 60 min; longer drives more bitterness and boil-off.` |
| `brewhouseEfficiencyPct` | Brewhouse Efficiency | `Share of extract you actually get into the fermenter (65–80 typical).` |
| `boilOffRateLPerHour` | Boil-Off Rate | `Volume lost to steam per hour (typical 8–12% of pre-boil per 60 min).` |
| `grainAbsorptionLPerKg` | Grain Absorption | `Water retained by spent grain after mashing (0.85–1.0 L/kg).` |
| `altitudeMeters` | Altitude | `Elevation lowers the boil point and scales hop utilization (see live panel).` |
| `spargeTemperatureC` | Sparge Temperature | `Keep near mash-out to avoid tannin extraction (75–78°C).` |
| `trubChillerLossL` | Trub / Chiller Loss | `Volume left behind with trub/hops after chilling.` |

---

## 2. Transformations & Pure Logic

### Pure function contracts
- `computeActiveSectionId(sectionIds, getTop, offset): string | undefined`
  - every `getTop(id) === null` ⇒ `undefined`.
  - else return the **last** id (in `sectionIds` order) whose `getTop(id) <= offset`.
  - else (all real tops `> offset`) return `sectionIds[0]`.
- `resolveActiveIndex(items, activeId): number` — unchanged P1 helper (consumed by
  `StickyJumpNav`); returns `-1` for `undefined`/`''`/empty/no-match.

### No-match / fallback contract (caller branching)
- `useSectionScrollSpy` returns `undefined` when none of the ids resolve to a live element.
  The page passes that straight into `StickyJumpNav.activeId`; `resolveActiveIndex` ⇒ `-1` ⇒
  **no** nav item highlighted (no placeholder, no throw). This is the P1-prescribed fallback.
- `StickyJumpNav` with non-empty `items` always renders the `<nav>` regardless of activeId.
- Click on a nav item whose `SectionCard` target is absent: `onNavigate` still fires; no
  scroll is attempted (P1-guarded).

### Stateful integration contract
- `useSectionScrollSpy` is mounted once per owning page; it attaches a passive **capture-phase
  `scroll` listener on `window` (`{capture:true, passive:true}`)** plus a passive `resize`
  listener on `window` (RA-1), and fires once on mount, computing `activeId` from live DOM tops
  with `offset = 96`. The capture phase is required because the real scroll container —
  `PageContainer`'s `<main data-testid="page-container">` (the sole `overflow-y-auto` owner) —
  emits **non-bubbling** `scroll` events that a plain bubble-phase `window` listener never
  receives; capture descends `window → … → <main>` regardless of bubbling, so it observes the
  container's scroll (including the smooth `scrollIntoView` fired by a nav click). On
  `sectionIds` change the resolver is recomputed; cleanup removes both listeners (the `scroll`
  one with the matching `capture:true`). `App.tsx` passes the hook result as `activeId` to the
  recipe nav; `EquipmentForm` passes its hook result to the equipment nav. Neither page passes
  `onNavigate` to `StickyJumpNav` (RA-3): after the primitive's internal guarded
  `scrollIntoView`, the container emits scroll events that the capture listener observes, so
  the highlight re-syncs from the scroll-spy alone. Collapse state for the four collapsible
  recipe cards is **uncontrolled** (`SectionCard` internal state, `defaultOpen` true) — the page
  does not own it and never syncs it.

### Refactoring & legacy cleanup
- The four ingredient components drop their hand-rolled `<div className={CARD_CLASS}>` +
  `<h3 className={SECTION_HEADING_CLASS}>` + header-summary-row shell in favor of the
  `SectionCard` shell (same visual tokens). No obsolete registration loops, alias maps, or
  side-effect patterns exist to purge beyond this shell swap. `EquipmentForm` likewise
  replaces its six hand-rolled shells. No `data-testid` currently relied on by a behavior
  test is removed; where a test pinned the old root-div semantics, reconcile to the
  `SectionCard` structure per the reconciliation rule.

---

## 3. Acceptance Criteria & Test Matrix

Baseline: **2,659 passed / 2 skipped across 135 files** (Layer 1 as of M39_P2 execution; see
Amendment 1 banner). Layer-1 gates (tests + typecheck + build + lint) must all exit 0; the test
count must exceed the baseline.

`[AMENDED]` = text changed by Amendment 1. `[NEW]` = added by Amendment 1. Unmarked rows are
unchanged from the originally approved spec.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | FermentableSection renders a `SectionCard` root with `id="recipe-fermentables"`, `data-testid="recipe-fermentables-section"`, heading level `h3`, title "Fermentables & Malts" | Integration (App) | assertions pass; heading role `heading` level 3 |
| AC-2 | HopSection → `recipe-hops` SectionCard, `h3`, title "Hops & Contextual Hop Schedule", `estimated-ibu-display` still present inside its body | Integration (App) | assertions pass |
| AC-3 | YeastSection → `recipe-yeast` SectionCard, `h3`, title "Yeast Strain & Fermentation" | Integration (App) | assertions pass |
| AC-4 | MiscSection → `recipe-miscs` SectionCard, `h3`, title "Misc & Water Agents" | Integration (App) | assertions pass |
| AC-5 | Each ingredient card is collapsible and **open by default** (panel `recipe-*-panel` mounted on first render; no user action needed to see content) | Unit (component) | each `*panel` present initially |
| AC-6 | Clicking an ingredient card's `{id}-toggle` collapses it: panel unmounts, `aria-expanded` flips to false; clicking again re-mounts it | Unit (component) | collapse/expand round-trip |
| AC-7 | Independent disclosures: collapsing `recipe-hops` does not collapse `recipe-fermentables`/`recipe-yeast`/`recipe-miscs` | Unit (component) | only the toggled panel unmounts |
| AC-8 | Ingredient header summary moved into badge slot is present when open and non-interactive (no nested button) | Unit (component) | badge text found; no nested interactive control |
| AC-9 | Recipe Editor renders a `StickyJumpNav` (`data-testid="jump-nav"`) with exactly 4 items `Fermentables`/`Hops`/`Yeast`/`Miscs` (`jump-recipe-*` buttons) | Integration (App) | nav + 4 buttons present |
| AC-10 `[AMENDED]` | Clicking a recipe nav item invokes the **primitive's internal guarded** `scrollIntoView({behavior:'smooth',block:'start'})` on the matching `SectionCard` root (stub `Element.prototype.scrollIntoView`). The page does **not** pass `onNavigate` to `StickyJumpNav` (RA-3) — no `onNavigate` call is expected | Integration (App, stub scrollIntoView) | `scrollIntoView` spy called once with instance === the matching `recipe-*` `SectionCard` root; no `onNavigate` spy wired |
| AC-11 `[AMENDED]` | Nav active highlight is driven **solely** by the scroll-spy's `activeId`: with the four `recipe-*` section rects stubbed, a `scroll` dispatched on the **real scroll container** `main[data-testid="page-container"]` (via `screen.getByTestId('page-container')`) — **not** on `window` — moves `aria-current="true"` to the matching item; a non-matching/`undefined` activeId highlights none (RA-2, RA-5) | Integration (App, real-container scroll) | `aria-current` present only on the active item after container scroll |
| AC-12 | Editing/saving a recipe still works after sectioning: type in a fermentable amount, dirty+save path intact (no regression) | Integration (App) | no regressions; save state transitions |
| AC-13 | Adding/removing a hop row (picker → row) still works inside the collapsed-capable `recipe-hops` card | Integration (App) | row appears/removes |
| AC-14 | Ingredient section components accept an optional `sectionId` prop; defaulting yields the canonical id; passing a custom id overrides it | Unit (component) | default === canonical; custom honored |
| AC-15 | `BatchRecipeAdjustModal` still renders Fermentable/Hop/Yeast sections (unchanged source) with default ids; no duplicate-id or crash | Integration (BatchRecipeAdjustModal) | modal opens; sections present; no throw |
| AC-16 | EquipmentForm `General` card is a `SectionCard` `equipment-general`, `h4`, title "General", body contains Profile Name + the 7 core numeric fields | Integration (EquipmentForm) | assertions pass |
| AC-17 | `equipment-altitude` SectionCard re-emits `data-testid="equipment-altitude-section"` (preserved) with `h4` title "Altitude & Atmospheric Physics" | Integration (EquipmentForm) | testid preserved; heading present |
| AC-18 | `equipment-thermal-mass` SectionCard re-emits `equipment-thermal-mass-section`, `h4`, checkbox `equipment-field-calcStrikeWithThermalMass` still functional | Integration (EquipmentForm) | testid preserved; checkbox toggles strike calc |
| AC-19 | `equipment-losses` SectionCard re-emits `equipment-losses-section`, `h4`, title "Vessel Losses & Dead Space" | Integration (EquipmentForm) | testid preserved; heading present |
| AC-20 | `equipment-hopstand` SectionCard (`h4`, "Hopstand & Whirlpool Parameters") and `equipment-notes` SectionCard (`h4`, "Notes") render | Integration (EquipmentForm) | both present |
| AC-21 | All six EquipmentForm sections are NON-collapsible: no `{id}-toggle` button rendered; content always mounted | Integration (EquipmentForm) | no disclosure toggle on any equipment card |
| AC-22 | EquipmentForm renders a `StickyJumpNav` with exactly 5 items (`General`/`Altitude`/`Thermal Mass`/`Losses`/`Hopstand`) and no Notes item | Integration (EquipmentForm) | 5 `jump-equipment-*` buttons; no notes item |
| AC-23 `[AMENDED]` | Clicking an equipment nav item invokes the **primitive's internal guarded** `scrollIntoView` on the matching `equipment-*` `SectionCard` root. The form does **not** pass `onNavigate` (RA-3) — no `onNavigate` call is expected | Integration (stub scrollIntoView) | `scrollIntoView` spy called once with instance === the target `SectionCard` root; no `onNavigate` spy wired |
| AC-24 | Equipment CRUD unchanged: create + edit + save a profile still round-trips (no regression) | Integration (EquipmentManager/Form) | save path intact |
| AC-25 | Caption: `batchSizeL` field renders the binding `hint` text under the input | Unit/Integration | text present; no error shown |
| AC-26 | Captions render for all 8 binding fields in §1 (`hint` strings appear under their fields) | Integration | each caption text found |
| AC-27 | Caption suppression: when a field has an `error`, its `hint` is not rendered (FormField existing behavior preserved) | Unit | error shown, hint hidden |
| AC-28 | `useSectionScrollSpy` returns `undefined` when every id resolves to no element (degenerate) | Unit (pure) | `undefined` |
| AC-29 | `computeActiveSectionId` boundary: with all real tops > offset returns first id | Unit (pure) | `sectionIds[0]` |
| AC-30 | `computeActiveSectionId` returns the LAST id whose top ≤ offset (not the first match) | Unit (pure) | correct last id |
| AC-31 | `computeActiveSectionId` returns `undefined` on empty `sectionIds` | Unit (pure) | `undefined` |
| AC-32 `[AMENDED]` | Hook registers its `scroll` listener on `window` with **`{capture:true, passive:true}`** (RA-1) and a `resize` listener on `window`; it resolves the active id from mocked `getBoundingClientRect`, updates `activeId` when a `scroll` is dispatched on a **rendered `page-container` `<main>`** (real-container path, RA-5), and cleans up both listeners on unmount | Unit (hook, real-container dispatch) | activeId updates on container scroll; listeners removed on unmount |
| AC-33 | Recipe Editor collapse/expand leaves `editor.isDirty` and the `SaveBar` state completely unaffected (collapse is pure local UI state) | Integration (App) | no dirty flag change on toggle |
| AC-34 | Heading-level contract preserved on jump targets: every recipe ingredient section heading is `h3`; every equipment section heading is `h4` | Integration | role/level assertions |
| AC-35 | No raw sectioning markup introduced: the four ingredient components and EquipmentForm use only `SectionCard`/`StickyJumpNav`/existing `FormField` — no ad-hoc `<div className={CARD_CLASS}>` new section shells remain | Verification (grep) | no new `CARD_CLASS` section shells outside `SectionCard`/allowed components |
| AC-36 | Primitive-only & imports: converted files import `SectionCard`/`StickyJumpNav`/`useSectionScrollSpy`/`FormField`/existing tokens only; no new icon/token deps beyond `lucide-react`/`designSystem`/`ui` barrel | Verification | import surface clean |
| AC-37 | No dead axis: `useSectionScrollSpy` is consumed by exactly 2 callers (`App.tsx`, `EquipmentForm.tsx`) | Verification | 2 usages |
| AC-38 | `MashSection`, `WaterSection`, `StatsHeader`, `StyleTargetPanel`, identity header remain un-wrapped and render unchanged (no regression to those regions) | Integration (App) | still present; internal `mash-*`/`water-*` testids intact |
| AC-39 | Batch-adjust modal visually retains standardized ingredient cards and passes its existing suite (no assertion removed) | Integration | suite green |
| AC-40 | Layer 1 — tests | Gate | total passed > 2,659 (and 2,659 baseline suite still green, skips ≤ 2); all four workspaces exit 0 |
| AC-41 | Layer 1 — typecheck | Gate | typecheck-all 4/4 exit 0 |
| AC-42 | Layer 1 — build & lint | Gate | build exit 0 (only pre-existing advisory allowed); lint 0 errors |
| AC-43 | Scope guardrail — positive: after-manifest diff's added/changed path set is a subset of the Authorized Files (NEW + MODIFIED source + MODIFIED test-reconciliation list) | Verification | no out-of-authorized path changed |
| AC-44 | Scope guardrail — negative: every one of the authorized source/NEW paths actually appears in the diff; all UNTOUCHED files (incl. `MashSection.tsx`, `WaterSection.tsx`, `ui/*`, `designSystem.ts`, `BatchRecipeAdjustModal.tsx` source, `packages/*`, `apps/api/*`, `.gsd/*`) are byte-identical | Verification | authorized present; untouched unchanged |
| AC-45 `[NEW]` | Anti-regression proof — the hook's `scroll` listener is attached with **`{capture:true}`** (asserted via an `addEventListener` spy), so a **non-bubbling** `scroll` dispatched on a rendered descendant `main[data-testid="page-container"]` (not on `window`) is observed and drives `activeId` — the exact real-app mechanism that was frozen pre-fix (RA-1) | Unit (hook, addEventListener spy + container dispatch) | addEventListener called with capture:true; container-scroll updates activeId |
| AC-46 `[NEW]` | Listener cleanup passes the matching capture flag: on unmount `window.removeEventListener('scroll', handler, {capture:true})` (and non-capture `resize` removal) is called; no state update occurs on a further container scroll after unmount | Unit (hook) | removal called with capture:true; no post-unmount update |
| AC-47 `[NEW]` | Suite-masking guardrail — in **both** the Recipe-Editor (`M39_P2_RecipeEditorSectioning.test.tsx`) and Equipment (`M39_P2_EquipmentSectioning.test.tsx`) integration suites, the scroll-spy highlight assertion dispatches its `scroll` on the real `main[data-testid="page-container"]` (via `screen.getByTestId('page-container')`), never a bare `window` dispatch; a window-only synthetic dispatch is no longer accepted as proof of the scroll-spy (RA-5) | Verification (grep on both NEW test files) | each suite has a container-dispatch highlight assertion; no `window.dispatchEvent(new Event('scroll'))` remains as the sole scroll trigger in the spy tests |

### Scope Guardrail ACs (AC-43, AC-44) — method

**`git diff --name-only` against a meaningful base commit is NOT viable in this repo.**
Verified (as in M39_P1): the repo has very few commits on `master` and the working tree
already carries large uncommitted framework modifications (`.agents/`, `.claude/`, `.gsd/`),
so no committed baseline isolates "what the executor changed." The guardrail is therefore a
**pre/post-execution SHA-256 content-manifest diff**:

1. **Before the executor's first edit** capture the full tracked+untracked manifest:
   `git ls-files -co --exclude-standard -z | xargs -0 sha256sum | sort > /tmp/m39p2_manifest_before.txt`
2. **After the executor's final edit** capture:
   `git ls-files -co --exclude-standard -z | xargs -0 sha256sum | sort > /tmp/m39p2_manifest_after.txt`
3. Diff: `diff /tmp/m39p2_manifest_before.txt /tmp/m39p2_manifest_after.txt`.

**AC-43 (pass):** the complete set of added/changed paths (hash-changed or after-only) is a
subset of the Authorized Files: the 4 NEW files (`useSectionScrollSpy.ts`, the 3 NEW test
suites) + the 6 MODIFIED source files + the 9 listed test-reconciliation files. **AC-44
(pass):** every authorized NEW/source path is actually present with a changed/new entry, and
none of the explicitly-UNTOUCHED paths has a changed hash. Any changed hash outside the
authorized set fails both AC-43 and AC-44.

---

## FEAT-005 status ruling

**Recommend advance `FEAT-005` from `IN_PLANNING` to `IN_EXECUTION` at P2 close.**

Rationale: FEAT-005 stayed `IN_PLANNING` through P1 because P1 was pure scaffolding with no
user-visible form outcome. P2 is the **first phase that applies the primitives to real,
user-visible forms** — the Recipe Editor ingredient cards gain collapsible `SectionCard`s +
a sticky jump nav, and the Equipment Form gains six `SectionCard`s + a sticky jump nav +
brewing-guidance captions. That is genuine, visible progress against the umbrella, so the
status should move past `IN_PLANNING` to `IN_EXECUTION` (not to a completed state — P3 and
the Mash/Water/Settings surfaces remain outstanding). This is a **recommendation only**: the
orchestrator owns and applies the `.gsd/FEATURES.md` status transition; this spec makes no
`.gsd/` edit.

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature
> specification. Reply with **SPEC_APPROVED** to begin execution, or provide
> feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS
> RECEIVED.
