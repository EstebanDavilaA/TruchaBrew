# Feature Specification: Milestone 29, Phase 1 — Design Tokens, Base Foundations & Form Accessibility

**Milestone:** 29 (Product-Wide UI/UX Ergonomics, Accessibility & Information Architecture, `FEAT-020`)  
**Phase:** 1 (`M29_P1`)  
**Author:** Principal Design Engineer & Product UX Architect  
**Status:** DRAFT — AWAITING `SPEC_APPROVED`  
**Date:** 2026-08-22  

---

## 1. Executive Summary & User-Visible Outcome

Phase 1 of Milestone 29 delivers the foundational design tokens, accessibility metadata, and form labeling required to resolve Lighthouse accessibility defects and prepare the application for typography and component modernization:

1. **Expanded Design System Primitives (`designSystem.ts`)**: Exports new standardized token constants for page headings (`PAGE_TITLE_CLASS`), numerical tabular formatting (`MONO_VALUE_CLASS`), destructive actions (`BUTTON_DANGER_CLASS`), and icon-only button bounding surfaces (`BUTTON_ICON_CLASS`), while preserving all existing token string contracts.
2. **Form Accessibility & Catalog Select Labeling**: Eliminates Lighthouse `select-name` / `label` failures by attaching explicit `aria-label` attributes to the 8 catalog select dropdowns in [`MashSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/MashSection.tsx), [`FermentableSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/FermentableSection.tsx), [`HopSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/HopSection.tsx), [`YeastSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/YeastSection.tsx), and [`MiscSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/MiscSection.tsx).
3. **SEO & Document Metadata**: Adds the missing `<meta name="description">` tag in [`apps/web/index.html`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/index.html), eliminating the Lighthouse SEO audit gap.
4. **Enhanced Keyboard Focus Ring (`index.css`)**: Refines `:focus-visible` ring styling to guarantee WCAG 2.2 AA compliant contrast and visibility across dark backgrounds.

---

## 2. File & Symbol Inventory

### 2.1 Modified Files

| File Path | Description of Changes |
| :--- | :--- |
| [`apps/web/src/components/designSystem.ts`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/designSystem.ts) | Export `PAGE_TITLE_CLASS`, `MONO_VALUE_CLASS`, `BUTTON_DANGER_CLASS`, and `BUTTON_ICON_CLASS` constants. |
| [`apps/web/test/designSystem.test.ts`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/test/designSystem.test.ts) | Pin new token constants with exact string equality assertions and assert module exports no functions or components. |
| [`apps/web/index.html`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/index.html) | Add `<meta name="description" content="TruchaBrew — Advanced Homebrewing Recipe Designer & Brewery Management Suite" />`. |
| [`apps/web/src/index.css`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/index.css) | Refine global `:focus-visible` styling for interactive controls. |
| [`apps/web/src/components/MashSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/MashSection.tsx) | Attach `aria-label="Select Mash Profile"` and `aria-label="Select Fermentation Profile"`. |
| [`apps/web/src/components/FermentableSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/FermentableSection.tsx) | Attach `aria-label="Select Grain / Malt from Catalog"`. |
| [`apps/web/src/components/HopSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/HopSection.tsx) | Attach `aria-label="Select Hop Variety"` and `aria-label="Hop Addition Use"`. |
| [`apps/web/src/components/YeastSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/YeastSection.tsx) | Attach `aria-label="Select Yeast Strain"`. |
| [`apps/web/src/components/MiscSection.tsx`](file:///c:/Dev/Workspaces/TruchaBrew/apps/web/src/components/MiscSection.tsx) | Attach `aria-label="Select Miscellaneous Ingredient"` and `aria-label="Misc Addition Use"`. |

### 2.2 Untouched Files (Scope Guardrail)

All other source files in `packages/calculations`, `packages/shared-types`, `apps/api`, and `apps/web/src` (including `ListRow.tsx`, `BatchDetail.tsx`, `Calculators.tsx`, `App.tsx`, `ReadingLog.tsx`, `SensoryEvaluationPanel.tsx`, `WaterCalculatorModal.tsx`) remain **strictly untouched** during this phase.

---

## 3. Data Schema & Contracts

### 3.1 Design System Token Additions (`designSystem.ts`)

```typescript
// Typography Additions
export const PAGE_TITLE_CLASS = 'text-xl md:text-2xl font-black text-white tracking-tight';
export const MONO_VALUE_CLASS = 'font-mono tabular-nums tracking-tight';

// Button Additions
export const BUTTON_DANGER_CLASS =
  'bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-semibold px-3 py-2 rounded-lg border border-rose-800 transition-colors cursor-pointer disabled:opacity-40';
export const BUTTON_ICON_CLASS =
  'p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40';
```

---

## 4. Binding Resolved Ambiguities

1. **Design System Module Boundary**: `designSystem.ts` continues to export frozen string constants and type aliases ONLY. It must not export any React components, hooks, or executable functions.
2. **Existing Token Values**: All 17 pre-existing token strings (`CARD_CLASS`, `SUBPANEL_CLASS`, `SECTION_HEADING_CLASS`, `SUBSECTION_HEADING_CLASS`, `BODY_TEXT_CLASS`, `METADATA_TEXT_CLASS`, `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `FORM_SELECT_CLASS`, `FORM_SELECT_COMPACT_CLASS`, `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `SETTINGS_ROW_CLASS`, `METRIC_TILE_CLASS`, `METRIC_LABEL_CLASS`, `METRIC_VALUE_CLASS`, `EMPTY_STATE_CLASS`, `LOADING_STATE_CLASS`, `ERROR_STATE_CLASS`, `STATUS_BADGE_WRAPPER_CLASS`, `STATUS_BADGE_CLASS`) remain byte-identical.
3. **Aria Labels on Form Selects**: Every catalog select element must receive a descriptive, unique `aria-label` without altering existing `data-testid`, `className`, or `onChange` event wiring.
4. **Scope Guardrail Execution**: Verified via pre/post-execution SHA-256 content manifests (`git ls-files -co --exclude-standard -z | xargs -0 sha256sum`).

---

## 5. Acceptance Criteria Matrix

| AC ID | Category | Requirement Description | Verification Method |
| :--- | :--- | :--- | :--- |
| **AC-1** | Tokens | `designSystem.ts` exports `PAGE_TITLE_CLASS` with exact value `'text-xl md:text-2xl font-black text-white tracking-tight'`. | `designSystem.test.ts` equality assertion |
| **AC-2** | Tokens | `designSystem.ts` exports `MONO_VALUE_CLASS` with exact value `'font-mono tabular-nums tracking-tight'`. | `designSystem.test.ts` equality assertion |
| **AC-3** | Tokens | `designSystem.ts` exports `BUTTON_DANGER_CLASS` with exact value `'bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-semibold px-3 py-2 rounded-lg border border-rose-800 transition-colors cursor-pointer disabled:opacity-40'`. | `designSystem.test.ts` equality assertion |
| **AC-4** | Tokens | `designSystem.ts` exports `BUTTON_ICON_CLASS` with exact value `'p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40'`. | `designSystem.test.ts` equality assertion |
| **AC-5** | Tokens | `designSystem.ts` exports no React component, hook, or callable function. | `designSystem.test.ts` typeof check |
| **AC-6** | Tokens | All 17 pre-existing token constants remain unmodified in `designSystem.ts`. | `designSystem.test.ts` assertions pass unmodified |
| **AC-7** | HTML/SEO | `apps/web/index.html` contains `<meta name="description" content="TruchaBrew — Advanced Homebrewing Recipe Designer & Brewery Management Suite" />`. | DOM inspection / unit test |
| **AC-8** | CSS | `apps/web/src/index.css` defines `:focus-visible` outline styles with `#38bdf8` or equivalent accessible ring. | CSS inspect |
| **AC-9** | a11y | Mash profile dropdown in `MashSection.tsx` has `aria-label="Select Mash Profile"`. | `MashSection.test.tsx` / DOM query |
| **AC-10** | a11y | Fermentation profile dropdown in `MashSection.tsx` has `aria-label="Select Fermentation Profile"`. | `MashSection.test.tsx` / DOM query |
| **AC-11** | a11y | Grain catalog select in `FermentableSection.tsx` has `aria-label="Select Grain / Malt from Catalog"`. | `FermentableSection.test.tsx` / DOM query |
| **AC-12** | a11y | Hop variety catalog select in `HopSection.tsx` has `aria-label="Select Hop Variety"`. | `HopSection.test.tsx` / DOM query |
| **AC-13** | a11y | Hop addition use select in `HopSection.tsx` has `aria-label="Hop Addition Use"`. | `HopSection.test.tsx` / DOM query |
| **AC-14** | a11y | Yeast strain catalog select in `YeastSection.tsx` has `aria-label="Select Yeast Strain"`. | `YeastSection.test.tsx` / DOM query |
| **AC-15** | a11y | Misc ingredient catalog select in `MiscSection.tsx` has `aria-label="Select Miscellaneous Ingredient"`. | `MiscSection.test.tsx` / DOM query |
| **AC-16** | a11y | Misc use select in `MiscSection.tsx` has `aria-label="Misc Addition Use"`. | `MiscSection.test.tsx` / DOM query |
| **AC-17** | Layer 1 | All automated test suites (1,941+ tests across all workspaces), typecheck, build, and lint pass with exit code 0. | `npm test && npm run typecheck && npm run build && npm run lint` |
| **AC-18** | Scope | Pre/post-execution SHA-256 manifest confirms only the 9 authorized files modified. | `sha256sum` manifest comparison |

---

## 6. Execution Instructions & Next Steps

Review this feature specification. Reply with **`SPEC_APPROVED`** to begin execution of **Milestone 29 Phase 1**.
