# FEATURE SPECIFICATION: M28_P1 — A Sidebar Organized the Way Brewing Works

## 1. Phase Overview & Scope

### 1.1 Objective
Milestone 28 reorganizes the sidebar navigation from a flat 9-item list into two domain-meaningful clusters — **Brew** (operational items used during brew day planning and execution) and **Library** (configuration, profiles, and reference setups kept on the shelf).

This grouping applies uniformly across all three navigation presentations:
1. **Desktop Expanded Sidebar** (`Sidebar.tsx`, `collapsed === false`): Section headers rendered with clear category typography.
2. **Desktop Collapsed Sidebar** (`Sidebar.tsx`, `collapsed === true`): Text headers suppressed, subtle section dividers separating icon clusters.
3. **Mobile Off-Canvas Drawer** (`MobileNav.tsx`): Section headers rendered matching the expanded desktop experience.

Every existing destination remains accessible with identical routing, active destination resolution, and keyboard/focus interaction.

### 1.2 Grouping Taxonomy

| Cluster | Section Title | Items (in order) | NavDestination IDs | Labels |
|---|---|---|---|---|
| **Brew** | `Brew` | 1. Recipes<br>2. Batches<br>3. Inventory<br>4. Calculators | `'list'`<br>`'batches'`<br>`'inventory'`<br>`'calculators'` | Recipes<br>Batches<br>Inventory<br>Calculators |
| **Library** | `Library` | 1. Equipment Profiles<br>2. Mash Profiles<br>3. Fermentation Profiles<br>4. Water Profiles<br>5. Settings | `'equipment'`<br>`'mashProfiles'`<br>`'fermentationProfiles'`<br>`'waterProfiles'`<br>`'settings'` | Equipment Profiles<br>Mash Profiles<br>Fermentation Profiles<br>Water Profiles<br>Settings |

### 1.3 Symbol Inventory & Exports

#### Exported from `apps/web/src/components/Sidebar.tsx`
- `export type NavDestination`: `'list' | 'equipment' | 'mashProfiles' | 'fermentationProfiles' | 'waterProfiles' | 'batches' | 'inventory' | 'settings' | 'calculators'` (unchanged type definition).
- `export interface NavItem`: `{ readonly destination: NavDestination; readonly label: string; }` (unchanged).
- `export interface NavSection`:
  ```typescript
  export interface NavSection {
    readonly title: string;
    readonly items: readonly NavItem[];
  }
  ```
- `export const NAV_SECTIONS: readonly NavSection[]`: Two elements (`'Brew'` with 4 items, `'Library'` with 5 items).
- `export const NAV_ITEMS: readonly NavItem[]`: Flat array of all 9 items in canonical order matching `NAV_SECTIONS` (`['list', 'batches', 'inventory', 'calculators', 'equipment', 'mashProfiles', 'fermentationProfiles', 'waterProfiles', 'settings']`).
- `export const NAV_ICONS: Record<NavDestination, typeof Beer>`: Unchanged icon associations.
- `export type ActiveView`: Unchanged union of 11 view identifiers.
- `export function activeDestinationFor(view: ActiveView): NavDestination`: Unchanged mapping function.
- `export interface SidebarProps`: Unchanged contract (`activeView`, `collapsed`, `onToggleCollapsed`, `onNavigate`).
- `export function Sidebar(props: SidebarProps): JSX.Element`: Updated rendering logic to iterate over `NAV_SECTIONS`.

#### Exported from `apps/web/src/components/MobileNav.tsx`
- `export interface MobileNavProps`: Unchanged contract (`isOpen`, `onClose`, `activeView`, `onNavigate`).
- `export function MobileNav(props: MobileNavProps): JSX.Element | null`: Updated rendering logic to iterate over `NAV_SECTIONS`.

### 1.4 File Boundaries

#### Authorized Modified Files
- `apps/web/src/components/Sidebar.tsx`: Export `NavSection` and `NAV_SECTIONS`; update `NAV_ITEMS` order to match sections; render section headings in expanded state and visual separators in collapsed state.
- `apps/web/src/components/MobileNav.tsx`: Import and render `NAV_SECTIONS` with section headings.
- `apps/web/test/Sidebar.test.tsx`: Update unit tests for `NAV_SECTIONS`, new `NAV_ITEMS` ordering, section heading rendering, and collapsed divider behavior.
- `apps/web/test/MobileNav.test.tsx`: Update unit tests to assert section heading rendering in the mobile dialog.

#### Strictly Untouched Files (Scope Guardrail)
All other project files, including:
- `apps/web/src/routes/paths.ts` (routing table and URL paths are byte-identical and untouched)
- `apps/web/src/App.tsx` (layout route integration is byte-identical and untouched)
- `apps/web/src/components/TopBar.tsx`, `PageContainer.tsx`, `Modal.tsx`, `designSystem.ts`
- All package files in `packages/calculations`, `packages/shared-types`, `apps/api`

---

## 2. Binding Resolved Ambiguities

1. **RA-1 (Section Headers vs Flat Array Export)**: `NAV_ITEMS` must be retained as a public export from `Sidebar.tsx` containing all 9 items. Its order is updated to match the sequential flatten of `NAV_SECTIONS` (`Brew` items followed by `Library` items). Any code or test importing `NAV_ITEMS` continues to work.
2. **RA-2 (Section Heading Styling & Semantics)**: Section titles (`Brew` and `Library`) are rendered in expanded desktop sidebar and mobile drawer with `px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 select-none`. They are presentational groupings and do not render as interactive buttons.
3. **RA-3 (Collapsed Mode Degrade & Dividers)**: In collapsed desktop sidebar (`collapsed === true`):
   - Text headers are completely removed from the DOM (not hidden via `display:none` or `opacity:0`), preserving screen reader and accessibility hygiene.
   - A subtle divider `<div className="my-1 border-t border-slate-800 mx-2" role="separator" aria-hidden="true" />` is rendered between the `Brew` and `Library` clusters.
4. **RA-4 (MobileNav Grouping)**: In `MobileNav.tsx`, the `NAV_SECTIONS` structure is rendered directly inside the scrollable drawer container. The section headings render identically to the expanded sidebar. The close button, focus trap (`useModalA11y`), and escape/backdrop handling remain unchanged.
5. **RA-5 (Active State Highlighting)**: Active destination resolution via `activeDestinationFor(activeView)` continues to highlight exactly one destination across all clusters with `bg-amber-500/10 text-amber-400 border-amber-500/30` and `aria-current="page"`.

---

## 3. Data Schema & Component Contracts

### 3.1 Data Structures in `Sidebar.tsx`

```typescript
export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Brew',
    items: [
      { destination: 'list', label: 'Recipes' },
      { destination: 'batches', label: 'Batches' },
      { destination: 'inventory', label: 'Inventory' },
      { destination: 'calculators', label: 'Calculators' },
    ],
  },
  {
    title: 'Library',
    items: [
      { destination: 'equipment', label: 'Equipment Profiles' },
      { destination: 'mashProfiles', label: 'Mash Profiles' },
      { destination: 'fermentationProfiles', label: 'Fermentation Profiles' },
      { destination: 'waterProfiles', label: 'Water Profiles' },
      { destination: 'settings', label: 'Settings' },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
```

---

## 4. Acceptance Criteria Matrix

### 4.1 Data & Structure Contracts
- [ ] **AC-1**: `NAV_SECTIONS` is exported as a readonly array with exactly 2 sections: `'Brew'` (4 items: `'list'`, `'batches'`, `'inventory'`, `'calculators'`) and `'Library'` (5 items: `'equipment'`, `'mashProfiles'`, `'fermentationProfiles'`, `'waterProfiles'`, `'settings'`).
- [ ] **AC-2**: `NAV_ITEMS` is exported as a readonly array containing all 9 destinations matching the sequential flattened order of `NAV_SECTIONS`.

### 4.2 Desktop Expanded Sidebar (`Sidebar.tsx`)
- [ ] **AC-3**: In expanded state (`collapsed === false`), both section headers (`Brew` and `Library`) are rendered with visible text.
- [ ] **AC-4**: In expanded state, all 9 navigation item buttons are rendered with their icon and label under their respective section header.
- [ ] **AC-5**: Clicking any of the 9 navigation item buttons calls `onNavigate` with the correct `NavDestination`.
- [ ] **AC-6**: Active view resolution correctly sets `aria-current="page"` on exactly one navigation button matching `activeDestinationFor(activeView)` across all 11 active views.

### 4.3 Desktop Collapsed Sidebar (`Sidebar.tsx`)
- [ ] **AC-7**: In collapsed state (`collapsed === true`), section header text nodes (`Brew`, `Library`) are not rendered in the DOM (`queryByText` returns null).
- [ ] **AC-8**: In collapsed state, all 9 navigation item buttons remain present, enabled, and clickable with correct `aria-label` and `title` attributes.
- [ ] **AC-9**: In collapsed state, a separator element (`role="separator"`) is rendered between the `Brew` and `Library` item groups.
- [ ] **AC-10**: The collapse toggle button correctly toggles `collapsed` state and updates `aria-expanded` and accessible name between `"Collapse navigation"` and `"Expand navigation"`.

### 4.4 Mobile Navigation Drawer (`MobileNav.tsx`)
- [ ] **AC-11**: When `isOpen === true`, `MobileNav` renders both section headers (`Brew` and `Library`) and all 9 navigation items.
- [ ] **AC-12**: Clicking any navigation item in `MobileNav` calls `onNavigate(destination)` and calls `onClose()`.
- [ ] **AC-13**: Focus trapping (`Tab`/`Shift+Tab`), `Escape` key dismissal, and backdrop click dismissal continue to operate correctly.

### 4.5 Scope Guardrail & Regression
- [ ] **AC-14**: Scope guardrail: SHA-256 pre/post manifest check confirms that only the 4 authorized files (`Sidebar.tsx`, `MobileNav.tsx`, `Sidebar.test.tsx`, `MobileNav.test.tsx`) are modified.
- [ ] **AC-15**: All four Layer 1 gates (test suite, typecheck across all 4 workspaces, build, oxlint) pass with 0 errors.

---

## 5. Halt Gate

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
