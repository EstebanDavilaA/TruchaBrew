# TruchaBrew — Design System & UI Architecture Dossier

**Target Audience:** Design System Agent / Frontend Architect  
**Project:** TruchaBrew (Technical Homebrewing Suite)  
**Date:** 2026-08-22  
**Frameworks & Core Tech:** React 19, Vite, React Router v7 (`createBrowserRouter`), Tailwind CSS v4 (`@tailwindcss/vite`), TypeScript, Lucide React icons.

---

## 1. Executive Summary & Vision

TruchaBrew is an offline-capable, high-density technical console for homebrewers. It covers the full lifecycle of brewing: recipe formulation, brewhouse equipment/water/mash modeling, live brew-day kettle telemetry, multi-week fermentation/cellar logging, and precision brewing calculations.

### The Problem to Solve
Across early milestones, features were built rapidly, leading to ad-hoc styling and duplicated class patterns. In recent milestones (M23–M29), visual drift was brought under control by freezing styling tokens into [`apps/web/src/components/designSystem.ts`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/designSystem.ts) and standardizing dialogs, buttons, inputs, and tabular numbers.

However, **the design system currently consists of frozen Tailwind class strings, not composable React component primitives.**

### The Mission for the Design System Agent
Transform TruchaBrew from an app using *ad-hoc token strings* into a **living, composable design system** where developers and agents compose accessible, theme-safe, polymorphic UI primitives (`<Button>`, `<Card>`, `<Input>`, `<MetricTile>`, `<Badge>`, `<Table>`) that speak the exact same visual and ergonomic language everywhere.

---

## 2. Current Design System Baseline (`designSystem.ts`)

The active source of truth is [`apps/web/src/components/designSystem.ts`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/designSystem.ts).

> **Architectural Guardrail**: `apps/web/test/designSystem.test.ts` strictly validates that `designSystem.ts` exports **no functions, no hooks, and no React components** (constants and types only). Composable React primitives should reside in dedicated component modules (e.g. `apps/web/src/components/ui/` or `apps/web/src/components/`).

### Current Token Catalog

```typescript
// 1. Surface / Container Primitives
export const CARD_CLASS = 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg';
export const CARD_STACK_GAP_CLASS = 'space-y-6';
export const SUBPANEL_CLASS = 'bg-slate-800/80 p-3 rounded-lg border border-slate-700/60';

// 2. Typography Scale & Tabular Numerics
export const PAGE_TITLE_CLASS = 'text-xl md:text-2xl font-black text-white tracking-tight';
export const SECTION_HEADING_CLASS = 'text-lg font-semibold text-slate-100 flex items-center gap-2';
export const SUBSECTION_HEADING_CLASS = 'text-base font-bold text-white mb-2';
export const BODY_TEXT_CLASS = 'text-sm text-slate-300';
export const METADATA_TEXT_CLASS = 'text-xs text-slate-400';
export const MONO_VALUE_CLASS = 'font-mono tabular-nums tracking-tight';

// 3. Button Actions
export const BUTTON_PRIMARY_CLASS =
  'bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50';
export const BUTTON_SECONDARY_CLASS =
  'bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50';
export const BUTTON_DANGER_CLASS =
  'bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-semibold px-3 py-2 rounded-lg border border-rose-800 transition-colors cursor-pointer disabled:opacity-40';
export const BUTTON_ICON_CLASS =
  'p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40';

// 4. Form Controls
export const INPUT_CLASS =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500';
export const INPUT_COMPACT_CLASS =
  'bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500';
export const FORM_SELECT_CLASS =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer';
export const FORM_SELECT_COMPACT_CLASS =
  'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium cursor-pointer';
export const SETTINGS_ROW_CLASS =
  'py-3.5 px-4 flex items-center justify-between gap-4';

// 5. Metric Stat Tiles
export const METRIC_TILE_CLASS = SUBPANEL_CLASS;
export const METRIC_LABEL_CLASS = 'text-xs text-slate-400 font-medium mb-1';
export const METRIC_VALUE_CLASS = 'text-2xl font-extrabold tracking-tight';

// 6. Feedback & Application States
export const EMPTY_STATE_CLASS = 'bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400';
export const LOADING_STATE_CLASS = EMPTY_STATE_CLASS;
export const ERROR_STATE_CLASS = 'bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 text-sm text-rose-200';

// 7. Status Badges
export const STATUS_BADGE_WRAPPER_CLASS = 'px-2.5 py-0.5 rounded-full text-xs font-medium border';
export const STATUS_BADGE_CLASS: Record<BatchStatus, string> = {
  Planning: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
  Brewing: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
  Fermenting: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
  Conditioning: 'bg-purple-900/40 text-purple-300 border-purple-500/30',
  Completed: 'bg-slate-700/40 text-slate-300 border-slate-500/30',
};
```

---

## 3. Visual & Aesthetic Principles

### 3.1 Dark, High-Contrast Console Architecture
TruchaBrew is used on brewery floors, outdoors near kettles, and in cellar environments:
- **Base Canvas:** Deepest slate (`#020617` / Slate 950).
- **Surface Elevation 1 (Cards):** `bg-slate-900` (`#0f172a`), bordered with `border-slate-800` (`#1e293b`).
- **Surface Elevation 2 (Subpanels/Wells/Inputs):** `bg-slate-800` (`#1e293b`), bordered with `border-slate-700` (`#334155`).
- **Accent Brand Color:** Warm Amber (`bg-amber-600` `#d97706` / hover `amber-500` `#f59e0b`).
- **Focus Rings:** Sky Blue (`#38bdf8`, 2px solid, 2px offset).

### 3.2 Semantic Color Mapping
- **Active Brewing / Live Operations:** Blue (`blue-900/40` / `text-blue-300` / `border-blue-500/30`)
- **Active Fermentation / Success / Attenuation Target Met:** Emerald (`emerald-900/40` / `text-emerald-300` / `border-emerald-500/30`)
- **Conditioning / Cellar Aging:** Purple (`purple-900/40` / `text-purple-300` / `border-purple-500/30`)
- **Warnings / Pre-Boil Alerts:** Amber (`amber-900/40` / `text-amber-300` / `border-amber-500/30`)
- **Destructive / Error / Contamination Alerts:** Rose (`rose-950/80` / `text-rose-200` / `border-rose-800`) — *Never use generic `red-*`*.
- **Archive / Completed / Inactive:** Slate (`slate-700/40` / `text-slate-300` / `border-slate-500/30`)

### 3.3 Numeric Anti-Jitter Rule
All dynamic numbers (gravity `1.054`, pH `5.24`, SRM `12.5`, IBU `45.2`, volume `23.5 L`, temperatures `67.5 °C`) **must** render with `font-mono tabular-nums tracking-tight` (`MONO_VALUE_CLASS`). This ensures figures update in real-time without shifting neighboring table columns or layout cards.

---

## 4. Application Architecture & Information Hierarchy

### 4.1 Route Map (React Router v7)
- `/recipes` — Recipe Library
- `/recipes/:id` — Recipe Designer & Live Formulator
- `/batches` — Batch Tracker & Historical Cellar List
- `/batches/:id` — Batch Detail Workbench (Planning, Brewing 12-col Workbench, Fermenting Charts, Conditioning, Completed Summary)
- `/inventory` — Fermentables, Hops, Yeasts, Miscs Stock Manager
- `/calculators` — Categorized Brewing Calculators Hub (*Water & Mash*, *Gravity & Refractometry*, *Yeast & Pitching*, *Hops & Carbonation*)
- `/equipment-profiles` — Brewhouse Equipment Configurations
- `/mash-profiles` — Infusion & Temperature Mash Schedules
- `/fermentation-profiles` — Temperature Step Profiles
- `/water-profiles` — Source & Target Mineral/Water Profiles
- `/settings` — Preferences, Units, Theme, Data Import/Export

### 4.2 Navigational Clustering
The sidebar and mobile off-canvas drawer are strictly divided into two functional domains:
1. **Brew Cluster:** Day-to-day operational tools (*Recipes*, *Batches*, *Inventory*, *Calculators*).
2. **Library Cluster:** Underlying constants and profiles (*Equipment*, *Mash*, *Fermentation*, *Water*, *Settings*).

---

## 5. Existing Reusable Component Primitives

The codebase currently has several key reusable patterns that should be formalized:

1. **Accessible Modal Shell ([`apps/web/src/components/Modal.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/Modal.tsx))**:
   - Manages all 8 modals in the app.
   - Built-in focus trapping (`useModalA11y`), Escape-to-close with busy lock guard, auto focus restoration, backdrop blur, and ARIA dialog semantics.
2. **Accessible List Rows ([`apps/web/src/components/ListRow.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/ListRow.tsx))**:
   - `role="button"`, keyboard Enter/Space selection, decoupled trailing action zones to eliminate nested button collisions.
3. **App Header Shell ([`apps/web/src/components/TopBar.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/TopBar.tsx))**:
   - Enforces a single `<h1>` (`PAGE_TITLE_CLASS`), mobile drawer hamburger toggle, search fields, status badges, and action bars.
4. **Layout Wrapper ([`apps/web/src/components/PageContainer.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/PageContainer.tsx))**:
   - Responsive horizontal/vertical padding across all view routes.

---

## 6. Strategic Roadmap for the Design System Agent

To evolve TruchaBrew into a cohesive living system, the incoming agent should execute on these high-leverage areas:

### Phase 1: Composable Component Library Primitives
Build a typed, accessible component layer in `apps/web/src/components/ui/`:
- `<Button variant="primary | secondary | danger | icon | ghost" size="sm | md | lg" ... />`
- `<Card>`, `<CardHeader>`, `<CardBody>`, `<CardFooter>`
- `<Input>`, `<Select>`, `<NumberInput>`, `<Textarea>`, `<Checkbox>`, `<Toggle>`
- `<FormField label="..." error="..." helperText="...">`
- `<Badge variant="planning | brewing | fermenting | conditioning | completed | neutral">`
- `<MetricTile label="..." value="..." unit="..." trend="..." />`

### Phase 2: Standardized Data Tables
Replace inconsistent manual `<table>` markup across `FermentableSection.tsx`, `HopSection.tsx`, `MiscSection.tsx`, `YeastSection.tsx`, and `BrewSheet.tsx` with a shared `<Table>`, `<TableHeader>`, `<TableRow>`, `<TableCell>` set that supports numeric alignment, inline editing wells, and mobile horizontal scrolling.

### Phase 3: Tokenization & CSS Variables
Upgrade from static Tailwind class strings to semantic CSS custom properties in `index.css`:
- `--surface-canvas`, `--surface-card`, `--surface-well`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--brand-primary`, `--brand-hover`, `--focus-ring`
- `--status-brewing`, `--status-fermenting`, `--status-danger`

### Phase 4: Ergonomic & Accessibility Guarantees
- Ensure minimum 44px touch targets on all kettle/brew-day operational controls.
- Maintain WCAG 2.1 AA color contrast (`slate-400` minimum for muted text on `slate-900` backgrounds).
- Enforce strict ARIA labeling on all icon-only action triggers.

---

## 7. Domain Lexicon & Guardrails

- **"Profile" vs "Schedule":** Always use **"Profile"** for entity names and headers (*Equipment Profile*, *Mash Profile*, *Fermentation Profile*, *Water Profile*). Reserve **"Schedule"** strictly for chronological step sequences (*Hop Schedule*, *Mash Step Schedule*).
- **Monorepo Structure:** Keep UI code in `apps/web/`. Core brewing math belongs in `packages/calculations/`, and shared DTOs/types belong in `packages/shared-types/`.
- **Quality Gates:** Any change must keep the four Layer 1 gates 100% green:
  - `npm test` (all workspace suites passing)
  - `npm run typecheck` (strict TypeScript validation across all 4 packages/apps)
  - `npm run build` (Vite production bundle compiled)
  - `npm run lint` (`oxlint` clean)
