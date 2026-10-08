# FEATURE SPECIFICATION: M26_P1 — Usable One-Handed at the Kettle (Off-Canvas Mobile Navigation) — Amendment 2

## Phase Summary

This is the single and closing phase of **Milestone 26 ("Usable one-handed at the kettle")**.

On desktop viewports, TruchaBrew provides a persistent left sidebar with 9 navigation destinations and a collapse/expand toggle. On mobile screens (e.g. a phone or tablet at the brewing kettle), a permanent sidebar either consumes critical horizontal screen space or forces excessive scrolling.

This phase delivers an off-canvas mobile navigation drawer (`<MobileNav>`) that remains hidden until summoned, opens smoothly over the page with a semi-transparent backdrop, provides one-tap access to all 9 application destinations, and auto-dismisses upon navigation, backdrop tap, or `Escape` key press. It reuses the accessible focus-trapping and focus-restoration foundation established in Milestone 25 (`useModalA11y`).

### Amendment 1 (State 4 Refine)

The first execution pass (`SPEC_APPROVED` build, Layer 1/2/3 all clean — see `.gsd/archive/CRITIC_REPORT.md` and `VERIFICATION_REPORT.md` 2026-08-21 entries) built `<MobileNav>`, the responsive `Sidebar` split, and the `TopBar` hamburger correctly, but the spec's original §1.3 file list restricted wiring to `Sidebar.tsx` / `TopBar.tsx` / `App.tsx` only. Since `App.tsx` renders a `<TopBar>` directly for exactly one of its 11 views (`editor`, the Recipe Editor route), the hamburger trigger only reached that single screen. The other 9 nav-reachable views (`list`, `equipment`, `mashProfiles`, `fermentationProfiles`, `waterProfiles`, `batches`, `inventory`, `settings`, `calculators`) plus `batchDetail` each render their own `<TopBar>` from inside their own top-level component, and those components were out of the original authorized-file list — so on a phone, the drawer was unreachable from 10 of 11 screens. This directly contradicts the milestone's own user-visible outcome ("every screen reachable on desktop is reachable on a phone").

This amendment expands the authorized file list (RA-8, §1.3) and the acceptance criteria (AC-16) to close that gap: thread `onOpenMobileNav` through every top-level view component that renders its own `<TopBar>`, plus the five nested Form components a Manager conditionally swaps in for its own TopBar (e.g. `MashProfileManager` renders `MashProfileForm` instead of its list+TopBar in create/edit mode — the Form must also carry the prop through to remain reachable). No new milestone/phase is created; this stays within M26_P1 per `/steer` Option A.

### Amendment 2 (State 4 Refine — App-Wide Responsive Layout)

At the `/steer` checkpoint following Amendment 1 (Layer 1/2/3 clean, 3 critic passes), the user exercised the app on mobile Chrome at a narrow viewport and reported that the drawer works but the app is "far from being responsive" beyond the nav itself. The concrete, reproducible defect: **on Recipe Library the search input disappears**, crowded out by the "Import JSON" and "New Recipe" buttons.

That symptom is not local to `RecipeLibrary.tsx` — it is a property of the shared `TopBar` primitive. `TopBar.tsx:27` lays its three slots out in a single `h-16 flex items-center justify-between gap-4` row with **no wrapping and a fixed 64px height**. The search slot (`TopBar.tsx:44`) carries `min-w-0`; the actions slot (`TopBar.tsx:45`) does not. Flexbox therefore resolves every pixel of horizontal deficit against the search slot alone, shrinking it to zero width while the action buttons keep their intrinsic size. Recipe Library is the only screen that passes `search` (verified: `search={` appears exactly once in `apps/web/src`, at `RecipeLibrary.tsx:166`), so it is the only screen where the collapse is visible — but the same non-wrapping row overflows its 64px height on the two screens that pass three or more action buttons (`App.tsx:581-636`, `pages/BatchDetail.tsx:728-769`).

The user asked for "all application should have responsive design layout" and, when offered a narrow fix versus a full audit, explicitly chose **the full audit now, as an expansion of this same M26_P1 refine** — not a new milestone. This amendment is therefore a deliberate, user-authorized widening of the milestone's own hardening note ("does not change what any screen contains"): Amendment 2 changes **layout and Tailwind class composition only**. It adds no feature, removes no control, changes no copy, and changes no behavior at or above the `md` breakpoint. The single exception is the Import JSON button's *label visibility* below `md` (RA-10), whose accessible name is held constant so existing queries keep resolving.

The audit found **nine** concrete defects across **six** source files (RA-9 through RA-14). It also confirmed a set of screens that are already correct and are therefore **deliberately excluded** from §1.3 rather than padded into it (see RA-14).

### Key Behaviors

1. **Responsive Desktop & Mobile Separation**:
   - Above the `md` (768px) breakpoint, the desktop sidebar displays as normal (`hidden md:flex`), preserving the Milestone 5.5 collapse toggle (`w-60` vs `w-16`) and all existing navigation behavior.
   - Below the `md` breakpoint, the desktop sidebar is hidden from the layout flow.
2. **TopBar Mobile Navigation Trigger**:
   - `TopBar` accepts an optional `onOpenMobileNav?: () => void` callback.
   - When provided, `TopBar` renders a mobile-only hamburger menu button (`<Menu className="w-5 h-5" />`, `aria-label="Open navigation menu"`, `className="md:hidden ..."`) in the leading slot.
   - When omitted, `TopBar` renders no extra button, ensuring backward compatibility with existing tests and embedded contexts.
3. **Off-Canvas Mobile Drawer (`<MobileNav>`)**:
   - Mounted conditionally when `isOpen === true` in `App.tsx` (rendering nothing when `isOpen === false` to avoid duplicate DOM elements in JSDOM / screen readers).
   - Rendered as an overlay dialog (`role="dialog"`, `aria-modal="true"`, `aria-label="Mobile navigation"`) with a semi-transparent backdrop (`bg-slate-950/80 backdrop-blur-sm`).
   - Drawer container (`w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl`).
   - Drawer header with TruchaBrew brand icon/title and a prominent close button (`<X className="w-5 h-5" />`, `aria-label="Close navigation"`).
   - Full navigation list containing all 9 `NAV_ITEMS` in exact canonical order: Recipes, Equipment Profiles, Mash Profiles, Fermentation Profiles, Water Profiles, Batches, Inventory, Settings, and Calculators.
   - Active destination highlighted with `aria-current="page"` and distinct amber badge styling (`bg-amber-500/10 text-amber-400 border border-amber-500/30`).
4. **Accessibility & Keyboard Parity (Milestone 25 Foundation)**:
   - Uses `useModalA11y` from `apps/web/src/components/Modal.tsx` to trap `Tab` and `Shift+Tab` within the open mobile drawer.
   - Pressing `Escape` closes the mobile drawer and restores focus to the trigger button that opened it.
5. **Auto-Dismiss on Navigation & Backdrop Tap**:
   - Tapping any navigation destination calls `onNavigate(destination)` and immediately calls `onClose()`.
   - Tapping the semi-transparent backdrop outside the drawer container calls `onClose()`.

---

## Resolved Ambiguities (Binding)

- **RA-1 — Responsive Breakpoint & Class Isolation**: The breakpoint for mobile vs desktop navigation is Tailwind's `md:` (768px). The desktop `<nav>` in `Sidebar.tsx` receives `hidden md:flex flex-col`, keeping desktop tests and desktop layout fully functional while removing the persistent sidebar from mobile screen flow.
- **RA-2 — Component Architecture & Conditional Mounting**: The mobile navigation drawer is implemented in `apps/web/src/components/MobileNav.tsx`. It conditionally renders when `isOpen === true` and returns `null` when `isOpen === false`. This avoids duplicate interactive elements during desktop testing and ensures clean focus trapping when mounted.
- **RA-3 — Reusing Modal A11y Foundation**: `MobileNav` imports `useModalA11y` from `apps/web/src/components/Modal.tsx`. It passes the drawer container ref to `useModalA11y`, guaranteeing focus trapping, Escape key dismissal, and focus restoration to the opener button.
- **RA-4 — TopBar Hamburger Trigger & Backward Compatibility**: `TopBarProps` is extended with an optional `onOpenMobileNav?: () => void`. When `onOpenMobileNav` is passed, `TopBar` renders a hamburger button (`aria-label="Open navigation menu"`) styled with `md:hidden`. When `onOpenMobileNav` is `undefined`, `TopBar` does NOT render this button, preserving the AC-11 contract ("with no children and no leading, no button renders inside TopBar").
- **RA-5 — Destination Order & Canonical Mapping**: `MobileNav` imports `NAV_ITEMS`, `NAV_ICONS`, `activeDestinationFor`, and `NavDestination` from `Sidebar.tsx`. All 9 destinations are rendered in identical order to desktop.
- **RA-6 — Navigation Interaction**: Clicking an item in `MobileNav` calls `onNavigate(item.destination)` AND `onClose()`.
- **RA-7 — Scope Guardrail Baseline**: Pre/post SHA-256 content manifest diff against working tree files.
- **RA-8 — Full-Route Mobile Nav Reachability (Amendment 1)**: Every component that renders its own `<TopBar>` gains an optional `onOpenMobileNav?: () => void` prop, forwarded to that `<TopBar>` unchanged. `App.tsx` passes `onOpenMobileNav={() => setMobileNavOpen(true)}` to whichever top-level view component it renders for the active `View` (the same wiring already applied to its own inline Recipe Editor `<TopBar>`). A Manager component that conditionally renders a nested Form in place of its own list+TopBar (`MashProfileManager` ⇄ `MashProfileForm`, `FermentationProfileManager` ⇄ `FermentationProfileForm`, `WaterProfileManager` ⇄ `WaterProfileForm`, `EquipmentManager` ⇄ `EquipmentForm`, `InventoryManager` ⇄ `InventoryForm`) forwards the same prop into that Form's props so the drawer stays reachable in create/edit mode too. Components with no existing `Props` interface (`InventoryManager`, `SettingsManager`, `Calculators`, `BatchList`) gain a minimal one carrying just this prop (`BatchList` already has `BatchListProps` for `onViewBatch` and simply gains the field).

### Amendment 2 — Resolved Ambiguities (Binding)

- **RA-9 — `TopBar` Becomes A Wrapping, Auto-Height Bar Below `md` (root fix)**: The three-slot row is fixed at the primitive, not per-screen. Exact, binding class strings:
  - `<header>` (`TopBar.tsx:26`): `bg-slate-900 border-b border-slate-800 flex-shrink-0 sticky top-0 z-30 h-auto md:h-16 shadow-md` — the literal token `h-16` is **replaced** by the pair `h-auto md:h-16`.
  - Inner row (`TopBar.tsx:27`) gains `data-testid="topbar-row"` and becomes: `min-h-16 md:h-16 px-4 sm:px-6 lg:px-8 py-2 md:py-0 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-4 gap-y-2`.
  - Search slot (`TopBar.tsx:44`): `w-full order-last md:order-none md:flex-1 min-w-0 md:max-w-md`. Below `md` the search occupies a full-width second visual line via CSS `order`, **not** via a DOM move — `topbar-lead`, `topbar-search`, `topbar-actions` remain siblings in that exact DOM order, preserving `TopBar.test.tsx:88-91`'s ordering contract.
  - Actions slot (`TopBar.tsx:45`): `flex flex-wrap items-center justify-end gap-2 md:gap-3` — `flex-wrap` is what lets the 3–4 button toolbars of `App.tsx` and `BatchDetail.tsx` reflow instead of overflowing, with **no per-file change to either**.
  - Lead slot (`TopBar.tsx:28`) is **unchanged** (`flex items-center gap-3 min-w-0`); the `<h1>`'s `truncate` (`TopBar.tsx:41`) is retained and remains the sole mechanism for long titles.
  - `TopBar.tsx:88`'s test selector `.h-16.px-4` no longer matches (`md:h-16` is a distinct class token from `h-16`). The test is **required** to be re-pointed at `getByTestId('topbar-row')`, and `TopBar.test.tsx:196`'s `toContain('h-16')` re-pointed at `toContain('md:h-16')` plus `toContain('h-auto')`. Substring-coincidence passes (`'md:h-16'.includes('h-16')`) do **not** satisfy this — the assertion must name the responsive token explicitly.
- **RA-10 — Import JSON Stays In Recipe Library; Label Only Is Hidden Below `md`**: The user's suggestion (move Import JSON to Settings-only) was evaluated and **rejected as the fix for this defect**, on evidence, in favor of a strictly smaller change. Rationale: (a) once RA-9 gives search its own full-width line, the residual collision is ~40px of button label, not a missing control; (b) removing the control deletes `RecipeLibrary.tsx:74-118` + `:133-143` and invalidates `RecipeLibrary.test.tsx:331-344, 371, 396`, which is a product/feature decision, not a responsive-layout one; (c) desktop behavior must stay byte-identical, which removal cannot achieve. Binding implementation: the button at `RecipeLibrary.tsx:133-143` keeps its `<Upload>` icon at all widths; its text is wrapped in `<span className="hidden md:inline">`, and the button gains `aria-label={isImporting ? 'Importing…' : 'Import JSON'}` so the accessible name is **identical at every viewport width** and `getByRole('button', { name: /import json/i })` (`RecipeLibrary.test.tsx:338`) continues to resolve unchanged. The "New Recipe" button (`RecipeLibrary.tsx:145-154`) keeps its visible label at all widths — it is the primary CTA and fits once Import JSON is icon-only.
- **RA-11 — Duplicate Import Path Is Recorded, Not Resolved Here**: `SettingsManager.tsx:325-378` (`data-testid="settings-import-section"`, "Data & Recipe Ingestion", Milestone 22) already offers a **strict superset** of Recipe Library's import: Brewfather JSON *and* BeerXML, drag-and-drop, and a pre-flight `RecipeImportModal` with equipment mapping and duplicate detection — versus `RecipeLibrary.tsx:92`'s blind fire-and-forget `importBrewfatherRecipes`. That genuine redundancy is a real finding, and it is the correct home if the control is ever consolidated. Consolidating it is **explicitly out of scope for Amendment 2** and is logged in §4 as a follow-up. No change is made to `SettingsManager.tsx` in this amendment; it stays on the Untouched list.
- **RA-12 — Every Wide Table Gets A Horizontal Scroll Container**: The established in-repo pattern is a `<div className="overflow-x-auto">` wrapping a `w-full` table (`FermentableSection.tsx:57`, `HopSection.tsx:161`, `MiscSection.tsx:62`, `YeastSection.tsx:51`, `MashSection.tsx:112` and `:195`, `StockCheckPanel.tsx:210`). Three sites violate it and are brought into line: (a) all six `BrewSheet.tsx` tables (`:172, :202, :234, :268, :300, :333`, all using `TABLE_CLASS = 'w-full border-collapse'` at `:12`, 4–6 columns each) each gain an `overflow-x-auto` wrapper div; (b) `ReadingLog.tsx:344`'s 6-column table gains one — its `whitespace-nowrap` at `:380` makes compression structurally impossible, so scroll is the only correct answer; (c) `PostBrewCalibrationModal.tsx:127`'s wrapper is `border ... rounded-lg overflow-hidden`, which **clips** the 4-column table at `:128` rather than scrolling it — the fix inserts an inner `<div className="overflow-x-auto">` between that wrapper and the `<table>`, leaving the outer `overflow-hidden` in place so the rounded corners are preserved. In all three cases the `<table>` element's own classes are unchanged.
- **RA-13 — Two Unconditional Multi-Column Grids Collapse Below `sm`**: (a) `BatchNutritionPanel.tsx:31` is `grid grid-cols-3 gap-4 text-center` with no responsive prefix, laying three `text-2xl` figures plus wrapping unit labels into ~100px columns at 375px; it becomes `grid grid-cols-1 sm:grid-cols-3 gap-4 text-center`. (b) `BrewSheet.tsx:100` is `grid grid-cols-3 sm:grid-cols-4 gap-3 text-sm text-slate-200` while its two sibling stat rows at `:74` and `:138` are `grid-cols-2 sm:grid-cols-4`; it becomes `grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-slate-200`, matching its siblings. Both changes are inert at and above `sm` (640px), so desktop rendering is provably unchanged.
- **RA-14 — Audited And Deliberately Excluded (do NOT modify)**: These were inspected at mobile widths and found already correct; adding them to §1.3 would be scope padding and is prohibited by AC-24. `EquipmentManager.tsx:96-104`, `MashProfileManager.tsx:93-101`, `FermentationProfileManager.tsx:93-101`, `WaterProfileManager.tsx:99-107` (title + exactly one action button — fits 375px with the `<h1>`'s existing `truncate`). `InventoryManager.tsx:193-228` (already the reference pattern: `flex flex-wrap items-center gap-4` with search in the page body, not the TopBar). `BatchStageTabs.tsx` (`flex flex-wrap`). `pages/Calculators.tsx:29` (`grid-cols-1 lg:grid-cols-2`). `SettingsManager.tsx` (`max-w-2xl` column; `SETTINGS_ROW_CLASS` in `designSystem.ts:61`). `pages/BatchList.tsx`, `StatsHeader.tsx:49`, `WaterSection.tsx:134`, `SensoryEvaluationPanel.tsx:102`, `SplitPackagingPanel.tsx`, `MeasuredComparison.tsx`, `StockCheckPanel.tsx`. `App.tsx:661-662` (`flex flex-wrap` + `min-w-[280px]`, which fits inside a 375px viewport's 343px content box).
- **RA-15 — Amendment 2 Is Layout-Only**: No component gains, loses, or renames a prop; no state, handler, network call, copy string, or `data-testid` is added or removed **except** the single new `data-testid="topbar-row"` mandated by RA-9 and the single new `aria-label` mandated by RA-10. Every change at and above the `md` breakpoint (and, for RA-13, above `sm`) resolves to the same computed layout as before this amendment.

---

## 1. Data Schema & Contracts

### 1.1 `MobileNavProps` Interface (`apps/web/src/components/MobileNav.tsx`)

```typescript
import type { NavDestination, NavItem } from './Sidebar';

export interface MobileNavProps {
  /** Whether the mobile off-canvas drawer is open. */
  readonly isOpen: boolean;
  /** Callback fired to close the mobile drawer. */
  readonly onClose: () => void;
  /** Active view to determine the highlighted nav destination. */
  readonly activeView: string;
  /** Callback fired when a navigation item is selected. */
  readonly onNavigate: (destination: NavDestination) => void;
}
```

### 1.2 `TopBarProps` Extension (`apps/web/src/components/TopBar.tsx`)

```typescript
export interface TopBarProps {
  title?: string;
  leading?: ReactNode;
  search?: ReactNode;
  children?: ReactNode;
  /** Optional callback to open the mobile off-canvas navigation drawer. */
  onOpenMobileNav?: () => void;
}
```

### 1.3 Modified vs. Untouched Files

**New Files (2):**
- `apps/web/src/components/MobileNav.tsx`
- `apps/web/test/MobileNav.test.tsx`

**Modified — Source Files (3, original pass):**
- `apps/web/src/components/Sidebar.tsx` (responsive class `hidden md:flex` on desktop `<nav>`, export `NAV_ICONS` / `activeDestinationFor`)
- `apps/web/src/components/TopBar.tsx` (optional `onOpenMobileNav` prop + hamburger button with `md:hidden`)
- `apps/web/src/App.tsx` (`mobileNavOpen` state, `<MobileNav>` rendering, and `onOpenMobileNav` wired to every view branch it renders, per RA-8 — not only `editor`)

**Modified — Source Files (15, Amendment 1 — RA-8 full-route wiring):**
- `apps/web/src/components/RecipeLibrary.tsx`
- `apps/web/src/components/EquipmentManager.tsx`
- `apps/web/src/components/EquipmentForm.tsx`
- `apps/web/src/components/MashProfileManager.tsx`
- `apps/web/src/components/MashProfileForm.tsx`
- `apps/web/src/components/FermentationProfileManager.tsx`
- `apps/web/src/components/FermentationProfileForm.tsx`
- `apps/web/src/components/WaterProfileManager.tsx`
- `apps/web/src/components/WaterProfileForm.tsx`
- `apps/web/src/components/InventoryManager.tsx`
- `apps/web/src/components/InventoryForm.tsx`
- `apps/web/src/components/SettingsManager.tsx`
- `apps/web/src/pages/BatchList.tsx`
- `apps/web/src/pages/BatchDetail.tsx`
- `apps/web/src/pages/Calculators.tsx`

**Modified — Source Files (6, Amendment 2 — responsive layout, RA-9 through RA-13):**

Each entry names the confirmed defect and its evidence. No file appears here without one.

| File | Defect | Evidence | Governing RA |
|---|---|---|---|
| `apps/web/src/components/TopBar.tsx` | Non-wrapping fixed-height 3-slot row; `min-w-0` on search only, so search absorbs 100% of horizontal deficit and collapses to zero width | `TopBar.tsx:26, 27, 44, 45` | RA-9 |
| `apps/web/src/components/RecipeLibrary.tsx` | Two fully-labeled action buttons in the actions slot alongside a search slot | `RecipeLibrary.tsx:133-143` (Import JSON), `:145-154` (New Recipe), `:166` (only `search=` consumer in the app) | RA-10 |
| `apps/web/src/components/BrewSheet.tsx` | Six 4–6 column tables with no horizontal scroll container; one stat grid at `grid-cols-3` where its siblings use `grid-cols-2` | `BrewSheet.tsx:12` (`TABLE_CLASS`), `:172, :202, :234, :268, :300, :333`; `:100` vs siblings `:74, :138` | RA-12, RA-13 |
| `apps/web/src/components/ReadingLog.tsx` | 6-column table with no scroll container, made incompressible by `whitespace-nowrap` | `ReadingLog.tsx:344`, `:380` | RA-12 |
| `apps/web/src/components/PostBrewCalibrationModal.tsx` | 4-column table inside an `overflow-hidden` wrapper — content is clipped, not scrollable | `PostBrewCalibrationModal.tsx:127-128` | RA-12 |
| `apps/web/src/components/BatchNutritionPanel.tsx` | Unconditional `grid-cols-3` with no responsive prefix | `BatchNutritionPanel.tsx:31` | RA-13 |

`apps/web/src/App.tsx` and `apps/web/src/pages/BatchDetail.tsx` carry the two worst-crowded toolbars (`App.tsx:581-636`: back + `<h1>` + Delete + Scale Batch + Brew This + `SaveBar`; `BatchDetail.tsx:728-769`: back + `<h1>` + up to four buttons) but are **fixed entirely by RA-9's `flex-wrap` on the shared actions slot** and receive **no Amendment 2 edit of their own**. They remain on the Amendment 1 list for the Amendment 1 reason only.

**Modified — Test Files:**
- `apps/web/test/TopBar.test.tsx` (test cases covering `onOpenMobileNav` prop behavior without regressing existing ACs)
- `apps/web/test/Sidebar.test.tsx` (verified all 9 existing ACs continue to pass)
- One test file per Amendment-1 source file above, covering AC-16 for that component (existing test file if one exists, e.g. `RecipeLibrary.test.tsx`, `EquipmentManager.test.tsx`; new minimal test file for any component that had none, e.g. `Calculators.test.tsx`)

**Modified — Test Files (Amendment 2):**
- `apps/web/test/TopBar.test.tsx` (re-point `:88`'s `.h-16.px-4` selector to `getByTestId('topbar-row')`; re-point `:196`'s `toContain('h-16')` to `toContain('md:h-16')` + `toContain('h-auto')`; add AC-17/AC-18 cases. The slot-ordering assertion at `:91` must remain and must still pass unmodified.)
- `apps/web/test/RecipeLibrary.test.tsx` (add AC-19; `:331-344` must pass **unmodified**)
- `apps/web/test/BrewSheet.test.tsx` (add AC-20, AC-22)
- `apps/web/test/ReadingLog.test.tsx` (add AC-20)
- `apps/web/test/PostBrewCalibrationModal.test.tsx` (add AC-21)
- `apps/web/test/BatchNutritionPanel.test.tsx` (add AC-22)

**Explicitly Untouched Files:**
- `apps/web/src/components/Modal.tsx` (reused as-is without modification)
- `apps/web/src/components/designSystem.ts` (constants-only contract preserved — `SETTINGS_ROW_CLASS`, `EMPTY_STATE_CLASS`, `ERROR_STATE_CLASS` etc. are **not** to be given responsive variants in this amendment)
- `apps/web/src/components/SettingsManager.tsx` (RA-11 — the import-consolidation follow-up is logged, not built)
- Every file enumerated in RA-14
- `apps/api/**`, `packages/calculations/**`, `packages/shared-types/**`

---

## 2. Transformations & Pure Logic

`MobileNav.tsx` encapsulates:
1. `useModalA11y`: Reused hook from `Modal.tsx` managing focus trapping and `Escape` dismissal.
2. Backdrop container with click delegation checking `e.target === e.currentTarget` to trigger `onClose()`.
3. Nav button click handlers that execute `onNavigate(destination)` followed by `onClose()`.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Title | Scope | Expected Outcome |
|---|---|---|---|
| AC-1 | `MobileNav` Open Rendering & 9 Destinations | Component | In `MobileNav.test.tsx`, rendering `<MobileNav isOpen={true} />` renders all 9 destinations in order with visible labels and accessible button roles. |
| AC-2 | `MobileNav` Active Destination Marker | Component | In `MobileNav.test.tsx`, passing `activeView="mashProfiles"` marks the "Mash Profiles" button with `aria-current="page"` and amber styling. |
| AC-3 | `MobileNav` Closed State | Component | In `MobileNav.test.tsx`, rendering `<MobileNav isOpen={false} />` renders nothing (`container.firstChild === null`). |
| AC-4 | `MobileNav` Focus Trapping | Component | In `MobileNav.test.tsx`, pressing `Tab` on the last focusable element in the drawer loops focus back to the first focusable element (close button); pressing `Shift+Tab` on the first element loops focus to the last element. |
| AC-5 | `MobileNav` Escape Key Dismissal | Component | In `MobileNav.test.tsx`, pressing `Escape` while open invokes `onClose()`. |
| AC-6 | `MobileNav` Focus Restoration | Component | In `MobileNav.test.tsx`, focusing an external button, opening `MobileNav`, and closing it restores focus to that external trigger button. |
| AC-7 | `MobileNav` Backdrop Click Dismissal | Component | In `MobileNav.test.tsx`, clicking the semi-transparent backdrop overlay calls `onClose()`; clicking inside the drawer container does NOT call `onClose()`. |
| AC-8 | `MobileNav` Close Button | Component | In `MobileNav.test.tsx`, clicking the close button (`aria-label="Close navigation"`) calls `onClose()`. |
| AC-9 | `MobileNav` Item Selection & Auto-Dismiss | Component | In `MobileNav.test.tsx`, clicking a nav item calls `onNavigate(destination)` with the destination ID and calls `onClose()`. |
| AC-10 | `TopBar` Hamburger Button on `onOpenMobileNav` | Component | In `TopBar.test.tsx`, passing `onOpenMobileNav={fn}` renders a button with `aria-label="Open navigation menu"`; clicking it calls the callback. |
| AC-11 | `TopBar` Omitting `onOpenMobileNav` Compatibility | Component | In `TopBar.test.tsx`, omitting `onOpenMobileNav` renders no hamburger button, preserving pre-existing AC-11 zero-button behavior when `leading` and `children` are absent. |
| AC-12 | Desktop Sidebar Responsive Classes & Existing Tests Pass | Component | In `Sidebar.test.tsx`, all existing AC-1 through AC-9 tests pass unmodified with desktop sidebar containing `hidden md:flex`. |
| AC-13 | App Integration (Recipe Editor route) | Integration | In `App.tsx`, clicking the TopBar hamburger menu opens `MobileNav` from the Recipe Editor (`editor`) view, selecting a destination navigates to that view and closes the drawer. |
| AC-16 | Full-Route Mobile Nav Reachability (Amendment 1) | Integration | For each of the 10 remaining views/screens (`list`/`RecipeLibrary`, `equipment`/`EquipmentManager` incl. `EquipmentForm`, `mashProfiles`/`MashProfileManager` incl. `MashProfileForm`, `fermentationProfiles`/`FermentationProfileManager` incl. `FermentationProfileForm`, `waterProfiles`/`WaterProfileManager` incl. `WaterProfileForm`, `batches`/`BatchList`, `batchDetail`/`BatchDetail`, `inventory`/`InventoryManager` incl. `InventoryForm`, `settings`/`SettingsManager`, `calculators`/`Calculators`), passing `onOpenMobileNav={fn}` renders the hamburger button on that screen's `TopBar` and clicking it invokes `fn`; omitting the prop renders no hamburger (AC-11 contract preserved per-component). Verified through `App.tsx`: navigating to each of the 9 `NAV_ITEMS` destinations and to `batchDetail`, then clicking the hamburger, opens `MobileNav` from that screen. |
| AC-17 | `TopBar` Responsive Row Contract (Amendment 2) | Component | In `TopBar.test.tsx`: the `<header>`'s `className` contains both `h-auto` and `md:h-16`, and does **not** contain the standalone token `h-16` (assert by splitting `className` on whitespace and checking `!tokens.includes('h-16')`, so a substring match on `md:h-16` cannot pass by accident). An element with `data-testid="topbar-row"` exists, is the header's only element child, and its class token list contains all of: `min-h-16`, `md:h-16`, `flex`, `flex-wrap`, `md:flex-nowrap`, `items-center`, `justify-between`, `gap-x-4`, `gap-y-2`, `py-2`, `md:py-0`. |
| AC-18 | `TopBar` Slot Classes & Preserved DOM Order (Amendment 2) | Component | In `TopBar.test.tsx`, rendering with `title`, `search` and `children` all present: `topbar-search`'s class tokens include `w-full`, `order-last`, `md:order-none`, `md:flex-1`, `min-w-0`, `md:max-w-md`; `topbar-actions`'s tokens include `flex`, `flex-wrap`, `items-center`, `justify-end`, `gap-2`, `md:gap-3`; `topbar-lead`'s className is byte-identical to `flex items-center gap-3 min-w-0`. The existing `:91` assertion that `topbar-row`'s children read `['topbar-lead','topbar-search','topbar-actions']` in DOM order still passes **unmodified** — search moves visually by CSS `order`, never by a DOM reparent. |
| AC-19 | Recipe Library Import Button — Icon Only Below `md`, Identical Accessible Name (Amendment 2) | Component | In `RecipeLibrary.test.tsx`: the Import button's visible text node is wrapped in an element whose class tokens include `hidden` and `md:inline`; the button carries `aria-label="Import JSON"` when idle and `aria-label="Importing…"` while importing; `screen.getByRole('button', { name: /import json/i })` resolves to exactly one element. The pre-existing `RecipeLibrary.test.tsx:331-344` case ("renders \"Import JSON\" button in TopBar with hidden file input") passes with **zero edits to its body**, and the hidden file input keeps `type="file"` and `accept=".json,application/json"`. The "New Recipe" button has **no** `hidden`/`md:` token on its label. |
| AC-20 | Wide Tables Have Horizontal Scroll Containers (Amendment 2) | Component | In `BrewSheet.test.tsx`, every `<table>` rendered by `BrewSheet` (6 of them) has a direct parent `<div>` whose class tokens include `overflow-x-auto`; assert by `container.querySelectorAll('table')` and checking `t.parentElement` for each, with an explicit `expect(tables.length).toBe(6)` so a silently-dropped table cannot make the assertion vacuous. Same assertion in `ReadingLog.test.tsx` for the readings table (rendered only when `readings.length > 0` — the test must seed at least one reading). Each `<table>`'s own `className` is unchanged. |
| AC-21 | Calibration Table Scrolls Instead Of Clipping (Amendment 2) | Component | In `PostBrewCalibrationModal.test.tsx`, the comparison `<table>`'s direct parent `<div>` has class token `overflow-x-auto`, and *that* div's parent still carries `overflow-hidden` and `rounded-lg` (the rounded-corner clip is preserved, one level out). |
| AC-22 | Multi-Column Grids Collapse Below `sm` (Amendment 2) | Component | In `BatchNutritionPanel.test.tsx`, with a non-null closing snapshot, the element wrapping the three nutrition figures has class tokens `grid`, `grid-cols-1`, `sm:grid-cols-3` and does **not** contain the standalone token `grid-cols-3`. In `BrewSheet.test.tsx`, the stat grid formerly at `grid-cols-3 sm:grid-cols-4` has tokens `grid-cols-2` and `sm:grid-cols-4` and no standalone `grid-cols-3`; the two sibling stat grids remain `grid-cols-2 sm:grid-cols-4`. |
| AC-23 | Crowded Toolbars Reflow Without Per-File Edits (Amendment 2) | Integration | In `App.test.tsx` (editor route) and `BatchDetail.test.tsx` (a loaded batch), the rendered `topbar-actions` element's class tokens include `flex-wrap`, proving the multi-button toolbars inherit the fix from `TopBar`. Confirmed by the manifest diff (AC-24) that neither `App.tsx` nor `BatchDetail.tsx` was edited in the Amendment 2 pass. Existing `App.test.tsx:893-898` and `BatchDetail.test.tsx:241` (Delete/actions first-child assertions) pass **unmodified**, proving `flex-wrap` did not reorder the actions slot. |
| AC-24 | Amendment 2 Scope Guardrail & No-Padding Check | Verification | Amendment 2's pass modifies **only** the 6 source files and 6 test files listed for Amendment 2 in §1.3. Because this repo has no prior commit covering this work, `git diff --name-only` against a base commit is **not** a viable check here — instead take a SHA-256 content manifest (`git ls-files -co --exclude-standard -z \| xargs -0 sha256sum`) **before the executor's first edit** and again at the end of the pass, and diff the two manifests. Every file listed in RA-14, plus `designSystem.ts`, `SettingsManager.tsx`, `App.tsx`, `pages/BatchDetail.tsx`, `Modal.tsx`, and all of `apps/api/**`, `packages/**`, must be **hash-identical** between the two manifests. |
| AC-14 | Scope Guardrail | Verification | Only authorized files modified (original 3 + Amendment 1's 15 + Amendment 2's 6, §1.3); SHA-256 content manifest diff passes. |
| AC-15 | Four Layer 1 Gates Clean | Verification | `npm test` (all workspaces), `npm run typecheck`, `npm run build`, and `npm run lint` all exit 0. |

---

## 4. Follow-ups logged, not built

- React Router adoption & URL routing (Milestone 27).
- Sidebar grouping into Brew vs Library clusters (Milestone 28).
- **Consolidate the two overlapping recipe-import paths (RA-11).** `SettingsManager.tsx:325-378` ("Data & Recipe Ingestion") supports Brewfather JSON **and** BeerXML, drag-and-drop, and a pre-flight `RecipeImportModal` with equipment mapping and duplicate detection; `RecipeLibrary.tsx:74-118` performs a blind `importBrewfatherRecipes` with no pre-flight. Deciding whether Recipe Library's control should be removed, or re-pointed at the Settings flow, is a product decision — not a responsive-layout fix — and is deliberately excluded from Amendment 2.
- **Responsive audit of modal internals.** `WaterCalculatorModal.tsx` (786 lines, two tables at `:490`/`:601` that *do* have scroll containers, plus `max-w-[150px]` truncation at `:753`) and `RecipeImportModal.tsx:296` (`grid-cols-2 sm:grid-cols-5`) were surveyed and found not to be blocking defects, but dialog sizing at 375px was not exhaustively verified in this amendment.

---

> **HALT GATE (STATE 2):** Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution, or provide feedback/adjustments.
