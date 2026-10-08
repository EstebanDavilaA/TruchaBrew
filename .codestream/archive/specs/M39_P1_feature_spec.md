# FEATURE SPECIFICATION: M39_P1 — SectionCard & Sticky Jump-Nav Primitives

## Phase Summary

Milestone 39 (FEAT-005 umbrella) delivers app-wide form sectioning: complex data-entry
forms (Recipe Editor, Equipment Form, Water Profile Form, Settings) gain accordion
section cards, a sticky jump-navigation bar for instant section focus, and brewing-guidance
captions under inputs.

**P1 is the *primitives* phase only.** It builds the two reusable, self-verifiable UI
primitives that P2/P3 will later apply across the forms — `SectionCard` (a collapsible,
badge-capable, anchored section card) and `StickyJumpNav` (a sticky in-page section
navigation bar). P1 makes **zero changes to any form, page, or section component**; those
files are P2/P3 scope and are explicitly listed as *untouched* in the Scope Guardrail ACs.
P1 is purely scaffolding primitives, so it produces **no user-visible form outcome** — this
is reflected in the FEAT-005 status ruling at the end.

The two primitives are designed against the real, existing target usage discovered in the
codebase so that P2/P3 can adopt them uniformly with no rework:

- Every current form "section" is a hand-rolled `<div className={CARD_CLASS}>` shell
  containing a manually-authored `<h2|h3|h4 className={SECTION_HEADING_CLASS}>` heading and
  a `data-testid` like `settings-section-units`, `equipment-losses-section`,
  `equipment-altitude-section`, `equipment-thermal-mass-section`,
  `equipment-thermal-mass-section`, `settings-section-formulas`. SectionCard is the
  drop-in abstraction over this exact repeated pattern.
- Current section headings are emitted at **different heading levels by form** (`h2` in
  `SettingsManager.tsx`, `h3` in the ingredient `*Section.tsx` files and
  `WaterProfileForm.tsx`/`MashProfileForm.tsx`, `h4` in `EquipmentForm.tsx`). Therefore
  `SectionCard` exposes a `headingLevel` axis (a real, imminent P2 consumer — not a dead
  axis).
- No `Card`, `Accordion`, `Collapsible`, `Disclosure`, `scroll-spy`, `jump-nav`, or
  `scrollIntoView` exists anywhere in `apps/web/src` today (only `TopBar.tsx` uses a
  `sticky top-0` utility). Both primitives are therefore genuinely new and non-duplicative.
- `apps/web/src/components/ui/index.ts` is the barrel through which every primitive is
  consumed (`import { Button, Badge } from './ui'`). Both new primitives join it.

### Key Behaviors
1. **`SectionCard`** renders an anchored, titled section shell (consuming the existing
   `CARD_CLASS` token) with an optional heading-level, decorative icon, an optional
   status-badge slot on the right of the header, and an optional collapsible disclosure
   toggle. When collapsed, the body is unmounted from the DOM.
2. **`StickyJumpNav`** renders a sticky in-page navigation bar of section links that
   highlights the active section and, on click, smooth-scrolls to the corresponding
   `SectionCard` by its DOM `id` and notifies the caller.
3. **Anchor coordination contract** binds them: a `StickyJumpNav` item's `id` must exactly
   equal a `SectionCard`'s `id` in the same page (case-sensitive string equality);
   `SectionCard` writes `id` verbatim onto its root `<section>` element. P2/P3 adopt both
   against this single contract.

### Resolved Ambiguities (Binding)

- **Animation vs instant toggle**: Collapse/expand is **instant** (conditional mount/unmount
  of the body). Justification: no animation library or transition-on-collapse exists in the
  app; instant toggle matches existing house style, keeps tests deterministic, and removes
  any need for reduced-motion handling. No `transition-*`, no height-animation classes.
- **Controlled vs uncontrolled collapse**: `SectionCard` collapse is **uncontrolled by
  default**. `open` is `undefined` → internal state governs, initialized from
  `defaultOpen` (default `true`). **Controlled mode is triggered iff `open !== undefined`**;
  in controlled mode `open` is the sole source of truth, clicking invokes
  `onToggle?.(!open)` and does **not** mutate internal state. `defaultOpen` is ignored in
  controlled mode. `onToggle` may be supplied in *either* mode; in uncontrolled mode it is
  an observation callback (`onToggle?.(nextOpen)` after the internal flip).
- **Collapse disclosure semantics / a11y**: The collapsible header is a real
  `<button type="button">` (so Enter/Space activate natively — no custom key handling)
  wrapped by a heading element. It carries `aria-expanded={open}` and
  `aria-controls={`${id}-panel`}`. Each card is an **independent disclosure**, not a
  single-select accordion or a tabs widget — no roving tabindex, no
  `aria-orientation`, and toggling one card never closes another. This is the deliberate
  choice so multiple sections can be open simultaneously in a long form.
- **Heading level**: `headingLevel?: 1|2|3|4|5|6`, default `2`. `SectionCard` renders the
  header as the corresponding `h1`–`h6` element. Binding justification: real P2 consumers
  sit at `h2`/`h3`/`h4` today (see Phase Summary), so this is a **forward-looking axis with
  a concrete consumer**, not a speculative dead axis. P1 tests verify it renders the
  requested tag.
- **`defaultOpen` default**: `true` (sections open by default so a form shows its content
  on first paint; P2 pages collapse noise only when the user chooses). `defaultOpen=false`
  starts the card collapsed.
- **Status badge slot**: `badge?: ReactNode` renders at the far right of the header row
  (a non-interactive slot). When collapsible, it renders *inside* the toggle `<button>` as
  a non-interactive `<span>` child (never a nested interactive control — callers must pass
  only non-interactive content, e.g. the existing `Badge`/text, into this slot).
- **Icon slot**: `icon?: ReactNode` is decorative; it is wrapped in an `aria-hidden="true"`
  `<span>` so it never contributes to the accessible name of the header/toggle.
- **Sub-card dividers (scoped out of the primitive API)**: `SectionCard` does **not**
  expose a divider or sub-panel prop. Divider/sub-panel layout between the groups inside a
  section body is compositional: P2 will apply the established `SUBPANEL_CLASS` and
  `divide-y divide-slate-800` conventions **inside the `children` it passes**. Binding
  reason: a divider axis on `SectionCard` would have no consumer in P1 (SectionCard renders
  `children` opaquely), which is exactly the M7-era dead-axis failure mode to avoid.
  `children: ReactNode` is rendered unchanged in the body.
- **No new design tokens (P1)**: SectionCard/StickyJumpNav consume **only existing** tokens
  (`CARD_CLASS`, `SECTION_HEADING_CLASS`, and — where a one-off structural bar is needed —
  a **module-local constant**, mirroring how `Button.tsx` keeps its `layoutClass` local).
  Binding: `designSystem.ts` and `designSystem.test.ts` are **untouched** in P1. Rationale:
  a token is only minted once the same string recurs across ≥2 real call sites; the only
  candidate would be the sticky-nav bar, which has a single P1 usage — minting it now would
  be a speculative token (dead-token risk symmetric to the dead-axis lesson). P2/P3 will
  determine which strings genuinely recur and should then be promoted to `designSystem.ts`
  in a later phase.
- **Sticky positioning of `StickyJumpNav`**: the nav root carries a baked default
  `sticky top-*` layout via a module-local constant. Exact `top`/`z` offset is a page-layout
  concern (it must not collide with the app `TopBar`, which is `sticky top-0 z-30`); P1 uses
  a conservative default and documents that a page may tune placement when P2 adopts it.
  The primitive's *feature* (sticky nav) is present and class-assertable in P1.
- **Active-section derivation is page-owned, not nav-owned**: `StickyJumpNav` is **fully
  controlled** for the active highlight. It does **not** run an internal `IntersectionObserver`
  / scroll-spy. The owning page computes `activeId` (P2 concern) and passes it down. P1
  therefore ships the pure resolution helper the pages will use, plus the controlled prop.
- **No-match / empty fallback (binding)**:
  - `StickyJumpNav`: `items.length === 0` ⇒ the component renders **`null`** (no nav shell,
    no sticky slot). Non-empty always renders the `<nav>`.
  - Active highlight with no match: when `activeId` matches no item, `resolveActiveIndex`
    returns `-1` and **no item is highlighted** (no first-item fallback, no error, no
    placeholder). The nav renders all items in the normal (inactive) state.
  - Click on an item whose target element does not exist in the DOM: the click still fires
    `onNavigate(id)`, but **no scroll is attempted** (the `scrollIntoView` call is guarded
    by element presence). Never throws.
- **`id` uniqueness / duplication**: `StickyJumpNav` does not enforce or throw on duplicate
  item `id`s; `resolveActiveIndex` returns the **first** matching index. This mirrors the
  codebase's lenient stance and keeps the primitive pure. P2 pages are responsible for
  unique ids.
- **Scroll behavior**: clicking a jump item calls
  `element.scrollIntoView({ behavior: 'smooth', block: 'start' })` when the target element
  exists. `scrollIntoView` is not implemented by jsdom, so P1 tests stub
  `Element.prototype.scrollIntoView`.
- **Collapsed target scroll**: clicking a jump item for a **collapsed** `SectionCard`
  scrolls to its (still-present) root `<section>` element; it does **not** auto-expand the
  card. Auto-expand-on-jump is a P2 page decision, not a primitive behavior.

---

## 1. Data Schema & Contracts

### Exported types / interfaces (both new files live in `apps/web/src/components/ui/`)

```ts
// --- apps/web/src/components/ui/SectionCard.tsx --------------------------------

export type SectionCardHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface SectionCardProps {
  /** Stable anchor id — written verbatim as the root <section> DOM id. Must be
   *  unique within the page and, for jump-nav targeting, exactly equal to a
   *  StickyJumpNavItem.id. Required. */
  id: string;
  /** Heading content. Required. */
  title: React.ReactNode;
  /** Rendered heading level (h1..h6). Default 2. */
  headingLevel?: SectionCardHeadingLevel;
  /** Optional decorative icon; wrapped aria-hidden. Optional. */
  icon?: React.ReactNode;
  /** Optional non-interactive slot rendered at the far right of the header.
   *  Renders inside the disclosure <button> when collapsible. Optional. */
  badge?: React.ReactNode;
  /** When true the header becomes a disclosure toggle and the body may be
   *  collapsed. Default false. */
  collapsible?: boolean;
  /** Uncontrolled initial open state. Only consulted when `open` is undefined.
   *  Default true. */
  defaultOpen?: boolean;
  /** Controlled open state. When `open !== undefined`, component is fully
   *  controlled and `defaultOpen` is ignored. Optional. */
  open?: boolean;
  /** Called with the next open state on header click (both modes). Optional. */
  onToggle?: (open: boolean) => void;
  /** Rendered unchanged as the card body. */
  children?: React.ReactNode;
  /** Passthrough onto the root <section>. */
  className?: string;
}

// --- apps/web/src/components/ui/StickyJumpNav.tsx ------------------------------

export interface StickyJumpNavItem {
  /** Must exactly equal a SectionCard `id` on the same page. Required. */
  id: string;
  /** Visible label. Required. */
  label: string;
}

export interface StickyJumpNavProps {
  /** Ordered items; empty array ⇒ renders null. */
  items: readonly StickyJumpNavItem[];
  /** Controlled active id. Undefined/''/no-match ⇒ no item highlighted. */
  activeId?: string;
  /** Called with the clicked item's id after a click. Optional. */
  onNavigate?: (id: string) => void;
  /** Passthrough onto the root <nav>. Optional. */
  className?: string;
}
```

### Pure helper (exported from `StickyJumpNav.tsx`)

```ts
/**
 * Deterministic. Returns the index of the first item whose `id === activeId`,
 * else -1 (including when activeId is undefined/'' or items is empty).
 */
export function resolveActiveIndex(
  items: readonly StickyJumpNavItem[],
  activeId: string | undefined,
): number;
```

### DOM / attribute contract (binding, P1-verifiable)

`SectionCard` — collapsible variant:
```
<section id={id} data-testid={`${id}-section`} className={CARD_CLASS + optional passthrough}>
  <h{level}>
    <button type="button" data-testid={`${id}-toggle`}
            aria-expanded={open} aria-controls={`${id}-panel`}>
      {icon && <span aria-hidden="true">…icon…</span>}
      <span class=flex-1>{title}</span>
      {badge && <span>…badge…</span>}
      <ChevronDown aria-hidden="true" class={open ? rotate : ''}/>
    </button>
  </h{level}>
  {open && <div id={`${id}-panel`} data-testid={`${id}-panel`}>{children}</div>}
</section>
```

`SectionCard` — non-collapsible variant:
```
<section id={id} data-testid={`${id}-section`} className={CARD_CLASS + passthrough}>
  <h{level} data-testid={`${id}-title`}>
    {icon && <span aria-hidden="true">…icon…</span>}
    <span class=flex-1>{title}</span>
    {badge && <span>…badge…</span>}
  </h{level}>
  <div data-testid={`${id}-panel`}>{children}</div>   {/* always present */}
</section>
```

- The root `<section>` always carries the DOM attribute `id={id}` **and** the derived
  `data-testid={`${id}-section`}`. The panel always carries `data-testid={`${id}-panel`}`.
  The toggle (collapsible only) carries `data-testid={`${id}-toggle`}`; the plain heading
  (non-collapsible) carries `data-testid={`${id}-title`}`.
- `id`, `headingLevel` (as `h{n}`), and the chevron icon come from **`lucide-react`**
  (`ChevronDown`), the same icon dependency the rest of `apps/web` uses.

`StickyJumpNav`:
```
<nav data-testid="jump-nav" className={STICKY_BAR_CLASS + passthrough} aria-label="Section navigation">
  {items.map(item => (
    <button type="button" key={item.id} data-testid={`jump-${item.id}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => handleClick(item.id)}>{item.label}</button>
  ))}
</nav>
```
- The root `<nav>` carries `data-testid="jump-nav"`. Each item button carries
  `data-testid={`jump-${item.id}`}`. The active button (when `resolveActiveIndex ≥ 0`)
  carries `aria-current="true"`; all other buttons carry no `aria-current`.

### Symbol inventory

**NEW files (authorized to be created):**
| File | Role |
|------|------|
| `apps/web/src/components/ui/SectionCard.tsx` | NEW primitive |
| `apps/web/src/components/ui/StickyJumpNav.tsx` | NEW primitive |
| `apps/web/test/SectionCard.test.tsx` | NEW test suite |
| `apps/web/test/StickyJumpNav.test.tsx` | NEW test suite (includes the two-primitive coordination contract suite) |

**MODIFIED file (only edit listed below):**
| File | Edit |
|------|------|
| `apps/web/src/components/ui/index.ts` | **Append exactly** these 4 lines after the final existing `Badge` export block: |
```
export { SectionCard } from './SectionCard';
export type { SectionCardProps, SectionCardHeadingLevel } from './SectionCard';
export { StickyJumpNav, resolveActiveIndex } from './StickyJumpNav';
export type { StickyJumpNavProps, StickyJumpNavItem } from './StickyJumpNav';
```

**UNTOUCHED (explicit):** every other file in the repo. In particular `designSystem.ts`,
`designSystem.test.ts`, `StatsHeader.tsx`, `App.tsx`, all `*Section.tsx` ingredient files,
all `*Form.tsx` files, `SettingsManager.tsx`, `RecipeEditor.tsx`, and every non-`ui`
component are **not** to be edited in P1. (The executors of P2/P3 will adopt the primitives;
this phase only *builds and tests* them.)

---

## 2. Transformations & Pure Logic

### Pure function contract

- `resolveActiveIndex(items, activeId): number` — deterministic, no side effects.
  - `items` empty ⇒ `-1`.
  - `activeId === undefined` or `''` ⇒ `-1`.
  - otherwise ⇒ index of the **first** item with `items[i].id === activeId`, else `-1`.

### No-match / fallback contract (caller branching rules)

- **SectionCard**: no no-match state exists (every rendered card is a card). Controlled-mode
  caller must keep `open`/`onToggle` in sync; if a caller supplies `open` but never updates
  it, the card simply never toggles (documented controlled behavior — no error, no throw).
- **StickyJumpNav — empty items**: `items.length === 0` ⇒ component returns `null` (renders
  nothing). Callers must not rely on the sticky slot existing when there are no sections.
- **StickyJumpNav — active no-match**: `resolveActiveIndex(...) === -1` ⇒ render all items
  in the normal inactive state; **no item** receives the active class or `aria-current`.
  This prevents a fallback placeholder highlight from ever appearing.
- **StickyJumpNav — click scroll no-match**: on click, locate the element by id; if absent,
  skip `scrollIntoView` but still call `onNavigate(item.id)`. Never throws.
- **Coordination fallback leak guard**: because SectionCard owns its collapse state and
  `StickyJumpNav` only ever *reads* its controlled `activeId`, a collapsed card or a
  nonexistent nav target can never mutate SectionCard open-state or leak a placeholder
  highlight. Fallbacks are strictly cosmetic and never write state.

### Stateful integration contract (how the two primitives coordinate)

1. A P2/P3 page renders a stack of `SectionCard`s (`CARD_STACK_GAP_CLASS` spacing is a page
   concern), giving each a stable unique `id` (e.g. `"general"`, `"losses"`,
   `"thermal-mass"` — the ids map to today's `data-testid` suffixes such as
   `equipment-losses-section`).
2. The page renders one `StickyJumpNav` whose `items` are `{ id, label }` pairs with
   `id` exactly equal to a rendered `SectionCard` `id`.
3. The **page owns `activeId`** (derived from a scroll-spy it implements in P2, or set by a
   jump). `StickyJumpNav` is purely presentational for active state — it never writes
   `activeId`.
4. Clicking a jump item ⇒ `StickyJumpNav` (a) smooth-scrolls to the `SectionCard` root
   `<section>` by id, (b) calls `onNavigate(item.id)` so the page may update `activeId`.
5. The page passes the resulting `activeId` back into `StickyJumpNav`, which re-resolves the
   highlight via `resolveActiveIndex`. There is **no** imperative coupling from the nav into
   SectionCard state; the only shared contract is the exact-string `id` equality between
   `SectionCardProps.id` and `StickyJumpNavItem.id`.
6. **P1 lockstep proof**: a P1 test composes one `SectionCard` (id `"general"`, open) + one
   `StickyJumpNav` (items `[{id:"general",label:"General"}]`, `activeId="general"`), stubs
   `scrollIntoView`, clicks `jump-general`, and asserts `scrollIntoView` fired on the
   `<section id="general">` element and `onNavigate` received `"general"`.

### Refactoring & legacy cleanup

- **None.** P1 introduces two new primitives and a barrel extension; it does **not** touch,
  migrate, or remove any existing registration loop, alias, or component. There is no legacy
  code to purge in this phase. Any urge to "apply" the primitives to an existing form is
  P2/P3 scope and must be resisted.

---

## 3. Acceptance Criteria & Test Matrix

Baseline (M38 close): **2,585 passed / 2 skipped across 130 test files** (web + api +
calculations). All ACs below are web (`apps/web`) tests unless noted. Test convention:
`@testing-library/react` (`render`, `screen`, `fireEvent`) + `vitest`, mirroring
`apps/web/test/BatchStageTabs.test.tsx`; derived `data-testid` queries match house style.
`Element.prototype.scrollIntoView` must be stubbed in any test that exercises a click on a
jump item.

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|-------------------|
| AC-1 | `SectionCard` non-collapsible renders a root `<section>` with DOM `id` equal to the `id` prop | Unit | `document.getElementById('general')` is the `<section>`; `data-testid="general-section"` present |
| AC-2 | `SectionCard` renders `title` text visible | Unit | `screen.getByText('Fermentables')` present; plain-header `data-testid="general-title"` present |
| AC-3 | `headingLevel` default is `h2` | Unit | rendered header element tagName === `'H2'` when prop omitted |
| AC-4 | `headingLevel={4}` renders `h4` | Unit | tagName === `'H4'` when `headingLevel={4}` passed |
| AC-5 | Non-collapsible renders `children` always present | Unit | `data-testid="general-panel"` exists and contains child text; no toggle button (`general-toggle` absent) |
| AC-6 | `icon` is decorative | Unit | icon element is inside an `aria-hidden="true"` span; accessible header name does **not** include icon text |
| AC-7 | `badge` slot renders at header, right of title | Unit | badge text present inside header region, DOM position after the title span |
| AC-8 | `className` passthrough lands on the root `<section>` | Unit | root `<section>` classList contains the passed class AND `CARD_CLASS` token string (`bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg`) |
| AC-9 | `collapsible` renders a real toggle button | Unit | `data-testid="general-toggle"` present and is a `<button type="button">` |
| AC-10 | Collapsible `open` by default | Unit | `aria-expanded="true"` and `general-panel` present when `collapsible` with no `open`/`defaultOpen` |
| AC-11 | Collapsible `defaultOpen={false}` starts collapsed | Unit | `aria-expanded="false"`; `general-panel` **absent** (unmounted) |
| AC-12 | Uncontrolled click toggles open→closed | Unit | `fireEvent.click(general-toggle)` ⇒ `aria-expanded="false"` and `general-panel` removed |
| AC-13 | Uncontrolled click toggles closed→open | Unit | start `defaultOpen={false}`, click ⇒ `aria-expanded="true"` and `general-panel` present |
| AC-14 | Uncontrolled `onToggle` observes the flip | Unit | `onToggle` called with `false` (then `true`) across two clicks in uncontrolled mode |
| AC-15 | Controlled `open={true}` stays open regardless of click | Unit | with `open={true}` + `onToggle`, click ⇒ `aria-expanded` stays `"true"`, panel stays mounted |
| AC-16 | Controlled `open={false}` stays closed | Unit | with `open={false}`, panel absent; click does not mount it |
| AC-17 | Controlled click fires `onToggle` with negation | Unit | with `open={true}`, click ⇒ `onToggle` last called with `false` |
| AC-18 | `defaultOpen` ignored in controlled mode | Unit | `open={false} defaultOpen={true}` renders collapsed |
| AC-19 | Toggle carries `aria-controls` = panel id | Unit | `general-toggle` has `aria-controls="general-panel"`; the panel has DOM `id="general-panel"` |
| AC-20 | Only one card toggles (independent disclosures) | Unit | two collapsible cards; toggling A does not change B's `aria-expanded` |
| AC-21 | StickyJumpNav empty `items` renders null | Unit | `items={[]}` ⇒ container query returns nothing (`queryByTestId('jump-nav')` null) |
| AC-22 | StickyJumpNav renders `<nav>` with all item buttons | Unit | `data-testid="jump-nav"` present; buttons `jump-general`, `jump-losses`, `jump-thermal-mass` present with labels |
| AC-23 | Nav root is a `<nav>` with a section-navigation aria-label | Unit | root element tagName `'NAV'`; `aria-label` non-empty |
| AC-24 | Active item highlighted via `aria-current="true"` | Unit | `activeId="losses"` ⇒ `jump-losses` has `aria-current="true"`; `jump-general` has none |
| AC-25 | Unknown `activeId` ⇒ no item highlighted | Unit | `activeId="nope"` ⇒ no button carries `aria-current`; all render in normal state, no crash |
| AC-26 | `activeId` undefined/'' ⇒ no highlight | Unit | omit `activeId` ⇒ no `aria-current` on any button |
| AC-27 | `resolveActiveIndex` deterministic contract | Unit | `resolveActiveIndex(items,'b')===1`; no match ⇒ `-1`; empty items ⇒ `-1`; `''`/`undefined` ⇒ `-1` |
| AC-28 | `resolveActiveIndex` returns first match on duplicate ids | Unit | items with two same ids ⇒ returns index of the first |
| AC-29 | Click jump item scrolls to matching `SectionCard` | Integration | stub `scrollIntoView`; render `SectionCard(id="general")` + nav item; click `jump-general` ⇒ `scrollIntoView` called once on the `<section id="general">` element |
| AC-30 | Click jump item calls `onNavigate` with its id | Integration | click `jump-general` ⇒ `onNavigate` last called with `"general"`; click `jump-losses` ⇒ `"losses"` |
| AC-31 | Click jump item scrolls target even when that card is collapsed | Integration | `SectionCard(id="general", collapsible, open={false})` + nav; click `jump-general` ⇒ scrollIntoView fires on root `<section>` (does not auto-expand; panel still absent) |
| AC-32 | Click with missing DOM target still calls `onNavigate`, no scroll, no throw | Integration | nav item id `"ghost"` with no matching element ⇒ `onNavigate("ghost")` called; `scrollIntoView` **not** called; no exception |
| AC-33 | Coordination lockstep (anchor contract) | Integration | `SectionCard(id="general", open)` + `StickyJumpNav(items=[{id:"general",label:"General"}], activeId="general")` render together; SectionCard root `id="general"` equals the nav item id and nav scrolls to it (AC-29) |
| AC-34 | Fallback never leaks into state | Integration | clicking a nav item for a collapsed/absent card leaves the SectionCard `aria-expanded`/open state unchanged (only the parent-driven `open` prop governs) |
| AC-35 | No dead axis: only implemented props exist | Verification | every declared `SectionCardProps`/`StickyJumpNavProps` member is consumed in the component body; `grep` finds no unused declared prop (e.g. no spec'd-but-unread badge/headingLevel path) |
| AC-36 | Primitive-only: primitives import only `react`, `lucide-react`, `../designSystem`, and the sibling `./ui` barrel | Verification | both new `.tsx` files' import statements reference no app page/component or data-fetching module |
| AC-37 | Design-token compliance — no new `designSystem.ts` exports | Verification | `designSystem.ts` export set unchanged (byte-identical content); primitives reference only existing tokens `CARD_CLASS`, `SECTION_HEADING_CLASS`; one-off structural strings live as module-local constants |
| AC-38 | ui barrel exports the new primitives + helper | Unit | `import { SectionCard, StickyJumpNav, resolveActiveIndex } from '../src/components/ui'` resolves; `SectionCardHeadingLevel`, `StickyJumpNavProps`, `StickyJumpNavItem` types resolve |
| AC-39 | Typecheck exits 0 | Gate | `npm run typecheck` (typecheck-all) exits 0 |
| AC-40 | Build exits 0 | Gate | web build exits 0 |
| AC-41 | Lint exits 0 | Gate | lint exits 0 |
| AC-42 | Web test-suite growth | Gate | full web suite passes with **passed count strictly > 2,585** (baseline) and 0 new failures/skips from P1 |
| AC-43 | Scope guardrail — authorized-file content manifest | Verification | See scope-guardrail method below |
| AC-44 | Scope guardrail — only the 5 authorized files change | Verification | See scope-guardrail method below |

### Scope Guardrail ACs (AC-43, AC-44) — method

**`git diff --name-only` against a meaningful base commit is NOT viable in this repo.**
Verified: the repo has only **6 commits** on `master` and the working tree already carries
large uncommitted modifications (the framework `.agents/`, `.claude/`, `.gsd/` files are
modified and unstaged). There is no committed baseline covering the M39 work, so a
`git diff` against any single commit cannot isolate "what the executor changed." Therefore
the guardrail is a **pre/post-execution SHA-256 content-manifest diff**:

1. **Before the executor's first edit**, capture the full tracked+untracked content manifest:
   `git ls-files -co --exclude-standard -z | xargs -0 sha256sum | sort > /tmp/m39p1_manifest_before.txt`
2. **After the executor's final edit**, capture:
   `git ls-files -co --exclude-standard -z | xargs -0 sha256sum | sort > /tmp/m39p1_manifest_after.txt`
3. **Diff the two manifests**: `diff /tmp/m39p1_manifest_before.txt /tmp/m39p1_manifest_after.txt`.

**AC-43 (pass criterion):** the after-manifest differs from the before-manifest **only** for
paths whose hash changed or that appear only in the after set, and the complete set of added/
changed paths is a subset of the 5 authorized files:
`apps/web/src/components/ui/SectionCard.tsx`,
`apps/web/src/components/ui/StickyJumpNav.tsx`,
`apps/web/test/SectionCard.test.tsx`,
`apps/web/test/StickyJumpNav.test.tsx`,
`apps/web/src/components/ui/index.ts`.
(New files appear only in the after manifest; `index.ts` appears in both with a changed hash.)

**AC-44 (pass criterion):** every one of those 5 authorized paths is actually present with a
changed (or, for the 4 new files, newly-appearing) entry in the after-vs-before diff — i.e.
the guardrail proves the intended files were the *only* files the executor touched, and none
of the listed *untouched* files (`designSystem.ts`, `designSystem.test.ts`, every form/page/
section component, every non-`ui` file, `.gsd/*`, `packages/*`, `apps/api/*`) has a changed
hash. Any changed hash outside the 5 authorized files fails both AC-43 and AC-44.

---

## FEAT-005 status ruling

**FEAT-005 stays `IN_PLANNING` through P1; no status change is made this phase.**

Rationale: FEAT-005 is the *milestone umbrella* whose status is already `IN_PLANNING` (it
currently reads `IN_PLANNING` in `.gsd/FEATURES.md`), and P1 is pure scaffolding — it builds
`SectionCard` and `StickyJumpNav` but applies them to **no** form, so it delivers **no
user-visible form-sectioning outcome**. Flipping the umbrella to a delivered/progress state
at P1 would misrepresent the milestone's user-visible progress. The correct moment to advance
FEAT-005 past `IN_PLANNING` (toward a completion state) is at the close of **P2 or P3**, once
the primitives are actually applied and a form visibly gains accordion cards, a sticky jump
bar, and field captions. Because the status is already `IN_PLANNING` and no state mutation is
warranted this phase, `.gsd/FEATURES.md` is **not edited by this spec** (the orchestrator
owns status transitions).

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature
> specification. Reply with **SPEC_APPROVED** to begin execution, or provide
> feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS
> RECEIVED.
