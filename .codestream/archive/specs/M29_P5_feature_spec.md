# Feature Specification: Milestone 29 Phase 5 (M29_P5)

**Milestone:** 29 — Product-Wide UI/UX Ergonomics, Accessibility & Information Architecture (`FEAT-020`)  
**Phase:** Phase 5 of 5 — Categorized Brewing Calculators Hub (`MAJ-04`, `FEAT-020`)  
**Status:** `DRAFT` — Awaiting `SPEC_APPROVED`  
**Date:** 2026-08-22  
**Author:** Principal Design Engineer & Lead Architect  

---

## 1. Context & Scope

### 1.1 Overview & Problem Statement
Currently, [`apps/web/src/pages/Calculators.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/pages/Calculators.tsx) renders all 10 brewing calculators simultaneously in a flat 2-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-6`). While each individual calculator component was upgraded in M29_P3 with high-contrast surfaces and tabular numerals, the overall page presents excessive cognitive overhead (`MAJ-04`). Brewers seeking a specific tool (such as quick strike water calculations or hydrometer temperature correction) must visually scan through 10 large visual cards across a long scrolling page.

### 1.2 Objective & Scope
Milestone 29 Phase 5 transforms the Calculators page into an organized, ergonomic domain hub:
1. **Interactive Category Filter Bar**: Provides 5 filter pills (`All`, `Water & Mash`, `Gravity & Refractometry`, `Yeast & Pitching`, `Hops & Carbonation`) with high-contrast active states, accessible `aria-pressed` indicators, and responsive wrapping.
2. **Domain-Categorized Section Blocks**: Groups the 10 calculators under 4 distinct, semantic `<h3>` category headings with iconography from `lucide-react`:
   - **Water & Mash**: `StrikeWaterCalculator`, `InfusionVolumeCalculator`
   - **Gravity & Refractometry**: `HydrometerCalculator`, `RefractometerCalculator`, `GravityCorrectionCalculator`
   - **Yeast & Pitching**: `PitchRateCalculator`, `StarterGrowthCalculator`
   - **Hops & Carbonation**: `CarbonationCalculator`, `HopDecayCalculator`, `UnitConverterCalculator`
3. **Import Graph & Allowlist Compliance**: Respects the closed module import allowlist and banned literal constraints asserted by `calculatorImportGraph.test.ts`.
4. **State Retention Across Category Toggling**: Switching between category filter views retains in-memory input state across all calculator instances.

---

## 2. Binding Resolved Ambiguities

1. **Category Taxonomy & Ordering**:
   - The 4 domain categories are:
     1. `'Water & Mash'` (Mash strike temperature and step-infusion water calculations)
     2. `'Gravity & Refractometry'` (Hydrometer correction, refractometer alcohol correction, and gravity adjustment)
     3. `'Yeast & Pitching'` (Pitch rate cell counts and starter yeast growth)
     4. `'Hops & Carbonation'` (Keg force carbonation & priming sugar, hop storage decay, and physical unit conversions)
   - The 5 filter pill options in order are: `['All', 'Water & Mash', 'Gravity & Refractometry', 'Yeast & Pitching', 'Hops & Carbonation']`.

2. **Card Rendering Strategy (No Registry Array / Direct JSX)**:
   - To preserve architectural simplicity and satisfy static analysis constraints, calculator components will continue to be rendered directly in JSX blocks guarded by category predicates, rather than dynamically iterating over an arbitrary object registry array.

3. **Heading Semantics & Hierarchy**:
   - `TopBar` continues to render the primary page heading (`<h1>`) with `title="Calculators"` (reconciling with existing navigation and page title assertions).
   - Each category section renders a semantic `<h3>` heading with `className="text-base md:text-lg font-bold text-slate-100 flex items-center gap-2.5 tracking-tight mb-4"`.
   - Each individual calculator card retains its existing `<h2>` card title inside `CalculatorCard.tsx`.

4. **Category Filter Button Semantics**:
   - The pill container uses `role="group"` with `aria-label="Calculator Categories"`.
   - Each filter button is a `<button type="button">` with `aria-pressed={activeCategory === cat}`.
   - Active styling: `bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20`.
   - Inactive styling: `bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-medium`.

5. **Static Analysis & Import Allowlist**:
   - [`apps/web/src/pages/Calculators.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/pages/Calculators.tsx) imports icons exclusively from `lucide-react`, components from `../components/TopBar`, `../components/PageContainer`, and `../components/calculators/*`, and `useState` from `react`.
   - No disallowed relative path escapes or bare packages outside `BARE_ALLOWLIST` in [`apps/web/test/calculatorImportGraph.test.ts`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/test/calculatorImportGraph.test.ts).

6. **Reconciliation of Legacy Test Assertion (`Calculators.test.tsx:538`)**:
   - `M8_P2 AC-23` originally checked `expect(src.includes('useState')).toBe(false);` when `Calculators.tsx` was a zero-state route.
   - In M29_P5, `Calculators.tsx` introduces local category filter state (`activeCategory`). The test is updated to assert that `Calculators.tsx` does not define a dynamic component registry (`const CALCULATORS = ...`), while allowing standard React state for UI tab/pill filtering.

---

## 3. Data Schema & Component Contracts

### 3.1 Types & Interfaces

```typescript
export type CalculatorCategory = 'All' | 'Water & Mash' | 'Gravity & Refractometry' | 'Yeast & Pitching' | 'Hops & Carbonation';

export interface CalculatorsProps {
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}
```

### 3.2 Category-to-Card Mapping

| Category | Icon (`lucide-react`) | Calculator Components |
|---|---|---|
| **Water & Mash** | `Droplets` / `Thermometer` | `StrikeWaterCalculator`, `InfusionVolumeCalculator` |
| **Gravity & Refractometry** | `Gauge` / `Scale` | `HydrometerCalculator`, `RefractometerCalculator`, `GravityCorrectionCalculator` |
| **Yeast & Pitching** | `Dna` / `FlaskConical` | `PitchRateCalculator`, `StarterGrowthCalculator` |
| **Hops & Carbonation** | `Wine` / `Sparkles` | `CarbonationCalculator`, `HopDecayCalculator`, `UnitConverterCalculator` |

---

## 4. Symbol Inventory

### 4.1 Modified Files
- [`apps/web/src/pages/Calculators.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/pages/Calculators.tsx): Add category filter pills, icon-backed category section headings, and conditional category rendering.
- [`apps/web/test/Calculators.test.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/test/Calculators.test.tsx): Reconcile `M8_P2 AC-23` assertion and add comprehensive M29_P5 test suite for category filtering and accessibility.

### 4.2 Untouched Files (Scope Guardrail)
- All calculation package files (`packages/calculations/src/**`)
- All backend api files (`apps/api/**`)
- All other web components (`apps/web/src/components/*` except tests where relevant)
- All modal dialogs and profile managers

---

## 5. Acceptance Criteria Matrix

| ID | Category | Specific Criterion / Assertion | Verification Method |
|---|---|---|---|
| **AC-1** | Category Filter Bar | The page renders 5 category filter buttons (`All`, `Water & Mash`, `Gravity & Refractometry`, `Yeast & Pitching`, `Hops & Carbonation`) inside an accessible group with `aria-pressed` matching active state. | Automated test (`Calculators.test.tsx`) |
| **AC-2** | Default 'All' View | When `activeCategory === 'All'` (default), all 4 category section headers and all 10 calculator cards are rendered in the DOM. | Automated test (`Calculators.test.tsx`) |
| **AC-3** | 'Water & Mash' Filter | Clicking the `Water & Mash` pill displays the "Water & Mash" section heading and exactly 2 cards (`Strike Water Temperature`, `Infusion (Step-Mash) Volume`), hiding all cards from other categories. | Automated test (`Calculators.test.tsx`) |
| **AC-4** | 'Gravity & Refractometry' Filter | Clicking the `Gravity & Refractometry` pill displays the "Gravity & Refractometry" section heading and exactly 3 cards (`Hydrometer Temperature Correction`, `Refractometer (Brix → SG, Alcohol-Corrected)`, `Gravity Correction`), hiding all cards from other categories. | Automated test (`Calculators.test.tsx`) |
| **AC-5** | 'Yeast & Pitching' Filter | Clicking the `Yeast & Pitching` pill displays the "Yeast & Pitching" section heading and exactly 2 cards (`Yeast Pitch Rate`, `Yeast Starter Growth`), hiding all cards from other categories. | Automated test (`Calculators.test.tsx`) |
| **AC-6** | 'Hops & Carbonation' Filter | Clicking the `Hops & Carbonation` pill displays the "Hops & Carbonation" section heading and exactly 3 cards (`Priming Sugar & Force Carbonation`, `Hop Alpha-Acid Decay`, `Unit Converters`), hiding all cards from other categories. | Automated test (`Calculators.test.tsx`) |
| **AC-7** | Input State Preservation | Modifying an input in a calculator (e.g. Grain Weight in `StrikeWaterCalculator`), switching category pills, and returning back preserves the modified input value. | Automated test (`Calculators.test.tsx`) |
| **AC-8** | TopBar & Mobile Nav | `TopBar` continues to receive `title="Calculators"` and forwards `onOpenMobileNav` when provided. | Automated test (`Calculators.test.tsx`) |
| **AC-9** | Import Graph Safety | `calculatorImportGraph.test.ts` passes with 0 failures (no disallowed imports, no banned literals, no escaped relative paths). | `npx vitest run apps/web/test/calculatorImportGraph.test.ts` |
| **AC-10** | Scope Guardrail | Monorepo SHA-256 pre/post manifest check confirms only `Calculators.tsx` and `Calculators.test.tsx` were modified. | Manifest diff |

---

## 6. Execution Plan

1. **Pre-Execution Baseline Manifest**: Capture SHA-256 manifest of repository.
2. **Update `Calculators.tsx`**:
   - Implement `useState<CalculatorCategory>('All')`.
   - Render the filter pill button bar with `aria-pressed`.
   - Group the 10 calculators into the 4 domain section blocks with icons and `<h3>` headers.
3. **Update `Calculators.test.tsx`**:
   - Reconcile the M8_P2 AC-23 `useState` check.
   - Add unit and integration tests verifying all 5 category filter states, heading rendering, card counts, and input state retention.
4. **Run Verification Gates**:
   - `npm test` across all workspaces.
   - `npm run typecheck`, `npm run build`, `npm run lint`.
