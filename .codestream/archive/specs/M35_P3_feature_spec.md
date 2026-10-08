# FEATURE SPECIFICATION: M35_P3 — Badge / Status Indicator Primitive & Call Site Modernization

> **Milestone 35:** "Consistency that holds without anyone policing it" (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 3 of 4.** Delivers the standardized `<Badge>` UI primitive in `components/ui/Badge.tsx`, extends the design system's status and semantic indicator color palette without breaking the exhaustive `Record<BatchStatus, string>` type invariant in `designSystem.ts`, migrates the ~14 ad-hoc badge and status pill call sites across the application (`BatchList.tsx`, `BatchDetail.tsx`, `CellarActionFeed.tsx`, `InventoryManager.tsx`, `WaterProfileManager.tsx`, `BrewDayTracker.tsx`, `RecipeImportModal.tsx`, `SensoryEvaluationPanel.tsx`, `SplitPackagingPanel.tsx`, `WaterCalculatorModal.tsx`), and verifies 100% adoption through dedicated primitive tests and static sweeps.

---

## Phase Summary

Milestone 35 Phase 1 and Phase 2 successfully unified all 16 tables across the app onto the `<Table>` primitive. Phase 3 now unifies the badge and status indicator system:

1. **New `<Badge>` UI Primitive (`components/ui/Badge.tsx` & `components/ui/index.ts`):**
   - Implements a flexible, typed `<Badge>` component supporting both **BatchStatus** values (`'Planning'`, `'Brewing'`, `'Fermenting'`, `'Conditioning'`, `'Completed'`) and **semantic variants** (`'neutral'`, `'success'`, `'warning'`, `'danger'`, `'info'`, `'amber'`, `'emerald'`, `'rose'`, `'sky'`, `'slate'`).
   - Supports size variants (`size="sm"` / `size="md"`) and optional pulse/dot indicators.
   - Renders as a semantic `<span>` with consistent typography, rounded-full or rounded borders, and accessible contrast.
2. **Preserving Design System Type Invariants (`designSystem.ts`):**
   - `STATUS_BADGE_CLASS: Record<BatchStatus, string>` and `STATUS_BADGE_WRAPPER_CLASS` remain strictly typed and exported from `designSystem.ts`.
   - New semantic badge color map `SEMANTIC_BADGE_CLASS` (or extended variants) added to `designSystem.ts` to maintain centralized token ownership.
3. **Migrating ~14 Ad-Hoc Call Sites:**
   - `BatchList.tsx` & `pages/BatchDetail.tsx`: Migrate batch status badge to `<Badge status={batch.status}>` / `<Badge variant={batch.status}>` and cellar completion badges to `<Badge variant="success">`.
   - `CellarActionFeed.tsx`: Migrate action type pills (Planned, Completed, Brewed, Measured) to `<Badge>` with matching semantic colors (slate, emerald, rose, sky).
   - `InventoryManager.tsx`: Migrate stock status indicators ("In Stock", "Low Stock", "Out of Stock") and category pills to `<Badge>`.
   - `WaterProfileManager.tsx`: Migrate profile type badge (`{profile.type}`) to `<Badge variant="neutral">`.
   - `BrewDayTracker.tsx`: Migrate live timer and stage indicators to `<Badge>`.
   - `RecipeImportModal.tsx`: Migrate parsed format and mismatch badges to `<Badge>`.
   - `SensoryEvaluationPanel.tsx`: Migrate overall score badge to `<Badge variant="warning">`.
   - `SplitPackagingPanel.tsx`: Migrate package destination pills to `<Badge>`.
   - `WaterCalculatorModal.tsx`: Migrate salt and acid target summary pills to `<Badge>`.
4. **Test Suite & Adoption Sweeps:**
   - Creates `apps/web/test/Badge.test.tsx` verifying all variants, sizes, and `BatchStatus` mappings.
   - Extends `uiPrimitives.test.tsx` with static sweeps verifying all badge sites use `<Badge>`.

---

## Acceptance Criteria Matrix (26 ACs)

| ID | Category | Requirement / Expected Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Primitive Export | `components/ui/` exports `Badge` component and `BadgeProps` type. | `components/ui/index.ts` & Typecheck |
| **AC-2** | BatchStatus Mapping | `<Badge variant="Planning">` through `<Badge variant="Completed">` match `STATUS_BADGE_CLASS` styling exactly. | `test/Badge.test.tsx` |
| **AC-3** | Semantic Variants | `<Badge variant="neutral">`, `"success"`, `"warning"`, `"danger"`, `"info"` render correct theme background, text, and border classes. | `test/Badge.test.tsx` |
| **AC-4** | Size Variants | `<Badge size="sm">` renders compact `px-2 py-0.5 text-[11px]` / `text-xs`; `<Badge size="md">` renders `px-2.5 py-0.5 text-xs`. | `test/Badge.test.tsx` |
| **AC-5** | Exhaustive Typing | `designSystem.ts` preserves `Record<BatchStatus, string>` exhaustiveness so unknown statuses fail typecheck. | Typecheck & `designSystem.test.ts` |
| **AC-6** | BatchList Migration | `pages/BatchList.tsx` renders batch status badge via `<Badge>`. | `test/BatchList.test.tsx` |
| **AC-7** | BatchDetail Migration | `pages/BatchDetail.tsx` renders batch status badge and completed action badges via `<Badge>`. | `test/BatchDetail.test.tsx` |
| **AC-8** | CellarActionFeed Migration | `CellarActionFeed.tsx` renders action badges (Planned, Completed, Brewed, Measured) via `<Badge>`. | `test/CellarActionFeed.test.tsx` |
| **AC-9** | InventoryManager Migration | `InventoryManager.tsx` stock status tags (In Stock, Low Stock, Out of Stock) and category tags render via `<Badge>`. | `test/InventoryManager.test.tsx` |
| **AC-10** | WaterProfileManager Migration | `WaterProfileManager.tsx` profile type tag renders via `<Badge>`. | `test/WaterProfileManager.test.tsx` |
| **AC-11** | BrewDayTracker Migration | `BrewDayTracker.tsx` active timer badge renders via `<Badge>`. | `test/BrewDayTracker.test.tsx` |
| **AC-12** | RecipeImportModal Migration | `RecipeImportModal.tsx` format tags and status indicators render via `<Badge>`. | `test/RecipeImportModal.test.tsx` |
| **AC-13** | SensoryEvaluation Migration | `SensoryEvaluationPanel.tsx` score badge renders via `<Badge>`. | `test/SensoryEvaluationPanel.test.tsx` |
| **AC-14** | SplitPackaging Migration | `SplitPackagingPanel.tsx` package type pills render via `<Badge>`. | `test/SplitPackagingPanel.test.tsx` |
| **AC-15** | WaterCalculator Migration | `WaterCalculatorModal.tsx` summary pills render via `<Badge>`. | `test/WaterCalculatorModal.test.tsx` |
| **AC-16** | Static Sweep | Zero ad-hoc `rounded-full px-2 py-0.5 text-xs` badge patterns remain in migrated files outside `<Badge>`. | `test/uiPrimitives.test.tsx` |
| **AC-17** | Token Integrity | `designSystem.test.ts` passes and verifies all exported badge tokens. | `test/designSystem.test.ts` |
| **AC-18** | Existing Test Integrity | All touched component test suites pass 100% without reduction. | `npm test` |
| **AC-19** | Accessibility Invariants | All badges render valid accessible text content and support custom `aria-label` / `role` where specified. | `test/Badge.test.tsx` |
| **AC-20** | Non-Badge Pill Exemption | Interactive segmented control pills and progress bar indicators (e.g. `BrewDayTimelineBar`) remain separate button/progress elements. | Spec review & `uiPrimitives.test.tsx` |
| **AC-21** | Scope Guardrail | Pre/post SHA-256 content manifest verifies only authorized files modified, 0 created in app (except `Badge.tsx` & `Badge.test.tsx`), 0 deleted. | Manifest comparison |
| **AC-22** | Monotonic Suite Health | Full test suite passes without reduction (>= 2,260 tests passing across 121 files). | `npm test` (exit 0) |
| **AC-23** | Layer 1 Gate: Tests | All monorepo test suites exit code 0. | `npm test` (exit 0) |
| **AC-24** | Layer 1 Gate: Typecheck | All 4 workspaces pass typecheck with 0 errors. | `npm run typecheck` (exit 0) |
| **AC-25** | Layer 1 Gate: Build | Production build passes cleanly in <1s. | `npm run build` (exit 0) |
| **AC-26** | Layer 1 Gate: Lint | Monorepo linter passes with 0 errors. | `npm run lint` (exit 0) |

---

## Resolved Ambiguities (Binding)

**RA-1 — `designSystem.ts` Preserves `STATUS_BADGE_CLASS` as Exhaustive Record.**
`STATUS_BADGE_CLASS: Record<BatchStatus, string>` is not replaced with a loose string map; it remains the single source of truth for batch lifecycle statuses. `SEMANTIC_BADGE_CLASS` is added for non-batch semantic states.

**RA-2 — `<Badge>` Polymorphism & Fallback.**
`<Badge>` accepts `variant?: BatchStatus | SemanticBadgeVariant`. If passed a recognized `BatchStatus`, it automatically routes to `STATUS_BADGE_CLASS[status]`. If passed a semantic variant (`'neutral'`, `'success'`, `'warning'`, `'danger'`, `'info'`), it routes to `SEMANTIC_BADGE_CLASS[variant]`.

**RA-3 — Interactive Segmented Pill Tabs are Not Badges.**
The clickable filter pills in `InventoryManager.tsx` (All, Fermentables, Hops, Yeasts, Miscs, Out of Stock) and `Calculators.tsx` are interactive navigation/filter controls built with `<Button>` and retain their interactive roles; the count bubbles inside them can use `<Badge>` or inline counters.

---

## Authorized Files to Modify

- `apps/web/src/components/ui/Badge.tsx` (NEW)
- `apps/web/src/components/ui/index.ts`
- `apps/web/src/components/designSystem.ts`
- `apps/web/src/pages/BatchList.tsx`
- `apps/web/src/pages/BatchDetail.tsx`
- `apps/web/src/components/CellarActionFeed.tsx`
- `apps/web/src/components/InventoryManager.tsx`
- `apps/web/src/components/WaterProfileManager.tsx`
- `apps/web/src/components/BrewDayTracker.tsx`
- `apps/web/src/components/RecipeImportModal.tsx`
- `apps/web/src/components/SensoryEvaluationPanel.tsx`
- `apps/web/src/components/SplitPackagingPanel.tsx`
- `apps/web/src/components/WaterCalculatorModal.tsx`
- `apps/web/test/Badge.test.tsx` (NEW)
- `apps/web/test/designSystem.test.ts`
- `apps/web/test/uiPrimitives.test.tsx`
- `apps/web/test/BatchList.test.tsx`
- `apps/web/test/CellarActionFeed.test.tsx`
- `apps/web/test/InventoryManager.test.tsx`
- `.gsd/STATE.json`

---

## Halt Gate (State 2)

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution.
