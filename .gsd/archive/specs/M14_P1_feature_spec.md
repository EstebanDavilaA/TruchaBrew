# Feature Specification: Milestone 14 Phase 1 (M14_P1: Accessibility, Token Consolidation & UI/UX Polish)

## 1. Executive Summary & Context

Milestone 14 Phase 1 (M14_P1) implements the accessibility hardening (WCAG 2.2 AA), recipe editor design token consolidation, global focus indicator styling, modal dialog semantics, and brand consistency items identified in `UI_UX_SPECIFICATION.md` (Steps 1–5):

1. **Recipe Editor Token Consolidation (M6)**:
   - Eliminates duplicate literal card wrapper strings (`bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6` and `text-lg font-semibold text-slate-100 flex items-center gap-2`) across the recipe designer sections (`FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, `MashSection.tsx`, `MiscSection.tsx`) by importing and referencing `CARD_CLASS` and `SECTION_HEADING_CLASS` from `designSystem.ts`.
   - Guarantees single-source-of-truth styling across all recipe editor card surfaces with zero visual regression.

2. **Accessibility Hardening (M1, M3, M4, P4 - WCAG 2.2 AA)**:
   - **Back Navigation Button (M1)**: Adds explicit `aria-label="Back to recipe library"` to the icon-only back button in `App.tsx`.
   - **Table Header Scope (M3)**: Adds `scope="col"` to all `<th>` elements across `FermentableSection.tsx`, `HopSection.tsx`, and `YeastSection.tsx` to enable assistive screen readers to associate column headers with data cells.
   - **Accessible Input Names (M4)**: Adds contextual `aria-label` attributes to all bare numeric inputs in table rows (e.g. `${item.name} amount (kg)`, `${hop.name} amount (g)`, `${hop.name} alpha acid %`, `${yeast.name} attenuation %`).
   - **Accessible Remove Actions & Hit Targets (P4)**: Adds `aria-label="Remove ${item.name}"` to all table remove buttons and widens click/touch padding from `p-1` to `p-2`.

3. **Global Focus Visibility (M7)**:
   - Adds a global `:focus-visible` outline rule in `apps/web/src/index.css` (`outline: 2px solid #38bdf8; outline-offset: 2px;`), ensuring keyboard focus is clearly visible on icon-only buttons and interactive controls across the application.

4. **Dialog Accessibility & Semantics (M2)**:
   - Enhances the "Scale Recipe Batch Size" modal in `App.tsx` with explicit dialog semantics: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="scale-modal-title"`, with `id="scale-modal-title"` on the modal heading and `aria-label="Target batch size in liters"` on the numeric input.

5. **Brand & Copy Polish (P1, P2)**:
   - Updates `<title>truchabrew</title>` in `apps/web/index.html` to `<title>TruchaBrew</title>` to match in-app branding.
   - Enhances recipe deletion confirmation dialog message in `App.tsx` to clearly state the recipe name and irreversible loss of ingredients.

---

## 2. File Organization & Boundaries

### 2.1 Modified Files
- `apps/web/index.html`: Update title tag to `<title>TruchaBrew</title>` (P1).
- `apps/web/src/index.css`: Add global `:focus-visible` ring style (M7).
- `apps/web/src/App.tsx`:
  - Add `aria-label="Back to recipe library"` on the back button (M1).
  - Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="scale-modal-title"` to the scale modal container (M2).
  - Add `id="scale-modal-title"` to scale modal heading and `aria-label="Target batch size in liters"` to scale modal numeric input (M2).
  - Enhance delete recipe confirmation copy with recipe name and ingredient scope (P2).
- `apps/web/src/components/FermentableSection.tsx`:
  - Import and apply `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem` (M6).
  - Add `scope="col"` to all 7 `<th>` elements (M3).
  - Add `aria-label={`${item.name} amount (kg)`}` to amount numeric input (M4).
  - Add `aria-label={`Remove ${item.name}`}` and widen padding to `p-2` on remove button (P4).
- `apps/web/src/components/HopSection.tsx`:
  - Import and apply `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem` (M6).
  - Add `scope="col"` to all 7 `<th>` elements (M3).
  - Add `aria-label={`${hop.name} amount (g)`}` to amount numeric input and `aria-label={`${hop.name} alpha acid %`}` to alpha acid input (M4).
  - Add `aria-label={`Remove ${hop.name}`}` and widen padding to `p-2` on remove button (P4).
- `apps/web/src/components/YeastSection.tsx`:
  - Import and apply `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem` (M6).
  - Add `scope="col"` to all 6 `<th>` elements (M3).
  - Add `aria-label={`${yeast.name} attenuation %`}` to attenuation numeric input (M4).
  - Add `aria-label={`Remove ${yeast.name}`}` and widen padding to `p-2` on remove button (P4).
- `apps/web/src/components/MashSection.tsx`:
  - Import and apply `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem` (M6).
- `apps/web/src/components/MiscSection.tsx`:
  - Import and apply `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem` (M6).

### 2.2 New Files
- `apps/web/test/accessibilityAndPolish.test.tsx`: Dedicated automated test suite verifying ARIA attributes, table scopes, dialog semantics, title tag, and token consumption across all modified components.

### 2.3 Untouched Files (Protected)
- `packages/calculations/` (All calculation engines untouched).
- `packages/shared-types/` (All shared types untouched).
- `apps/api/` (All backend routes, repositories, database schemas untouched).
- `.gsd/archive/` (Append-only).

---

## 3. Data Schema & Component Contracts

### 3.1 Global CSS Focus Indicator Contract (`apps/web/src/index.css`)

```css
:focus-visible {
  outline: 2px solid #38bdf8; /* sky-400 */
  outline-offset: 2px;
}
```

### 3.2 Recipe Editor Section Token Contract

In `FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, `MashSection.tsx`, `MiscSection.tsx`:
```tsx
import { CARD_CLASS, SECTION_HEADING_CLASS } from './designSystem';

// Card container:
<div className={CARD_CLASS}>
  <div className="flex items-center justify-between mb-4">
    <h3 className={SECTION_HEADING_CLASS}>
      <Icon className="w-5 h-5 text-amber-500" /> Section Title
    </h3>
    ...
  </div>
```

### 3.3 Ingredient Table Accessible Column & Input Contract

In `FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`:
```tsx
// Table Headers:
<th scope="col" className="py-2 px-3">Name</th>

// Table Numeric Inputs:
<input
  type="number"
  aria-label={`${item.name} amount (kg)`}
  value={item.amountKg}
  onChange={...}
  className="..."
/>

// Table Remove Buttons:
<button
  type="button"
  aria-label={`Remove ${item.name}`}
  title="Remove fermentable"
  onClick={...}
  className="text-slate-500 hover:text-rose-400 p-2 transition-colors cursor-pointer"
>
  <Trash2 className="w-4 h-4" />
</button>
```

### 3.4 Scale Modal Dialog Contract (`App.tsx`)

```tsx
{showScaleModal && (
  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scale-modal-title"
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl"
    >
      <h3 id="scale-modal-title" className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <Scale className="w-5 h-5 text-amber-500" /> Scale Recipe Batch Size
      </h3>
      ...
      <input
        type="number"
        aria-label="Target batch size in liters"
        step="1"
        min="1"
        value={targetScaleL}
        onChange={...}
        className="..."
      />
    </div>
  </div>
)}
```

---

## 4. Acceptance Criteria Matrix

| ID | Category | Requirement / Behavior | Verification Method |
|---|---|---|---|
| **AC-1** | Token Consolidation: Fermentables | `FermentableSection.tsx` imports and applies `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem`. No literal card class string remains in the file. | Component test / grep check. |
| **AC-2** | Token Consolidation: Hops | `HopSection.tsx` imports and applies `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem`. No literal card class string remains in the file. | Component test / grep check. |
| **AC-3** | Token Consolidation: Yeasts | `YeastSection.tsx` imports and applies `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem`. No literal card class string remains in the file. | Component test / grep check. |
| **AC-4** | Token Consolidation: Mash | `MashSection.tsx` imports and applies `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem`. No literal card class string remains in the file. | Component test / grep check. |
| **AC-5** | Token Consolidation: Miscs | `MiscSection.tsx` imports and applies `CARD_CLASS` and `SECTION_HEADING_CLASS` from `./designSystem`. No literal card class string remains in the file. | Component test / grep check. |
| **AC-6** | Accessibility: Table Column Scope | All `<th>` elements in `FermentableSection.tsx`, `HopSection.tsx`, and `YeastSection.tsx` have `scope="col"`. | DOM assertion in `accessibilityAndPolish.test.tsx`. |
| **AC-7** | Accessibility: Fermentables Inputs | Numeric amount inputs in `FermentableSection.tsx` render with `aria-label="${item.name} amount (kg)"`. Remove buttons render with `aria-label="Remove ${item.name}"` and `p-2` padding. | DOM assertion in `accessibilityAndPolish.test.tsx`. |
| **AC-8** | Accessibility: Hop Inputs | Numeric amount inputs in `HopSection.tsx` render with `aria-label="${hop.name} amount (g)"`. Alpha acid inputs render with `aria-label="${hop.name} alpha acid %"`. Remove buttons render with `aria-label="Remove ${hop.name}"` and `p-2` padding. | DOM assertion in `accessibilityAndPolish.test.tsx`. |
| **AC-9** | Accessibility: Yeast Inputs | Numeric attenuation inputs in `YeastSection.tsx` render with `aria-label="${yeast.name} attenuation %"`. Remove buttons render with `aria-label="Remove ${yeast.name}"` and `p-2` padding. | DOM assertion in `accessibilityAndPolish.test.tsx`. |
| **AC-10** | Accessibility: Back Button | Back navigation button in `App.tsx` renders with `aria-label="Back to recipe library"`. | DOM assertion in `accessibilityAndPolish.test.tsx`. |
| **AC-11** | Accessibility: Scale Modal Dialog | Scale modal container in `App.tsx` renders with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="scale-modal-title"`. Target batch size input renders with `aria-label="Target batch size in liters"`. | DOM assertion in `accessibilityAndPolish.test.tsx`. |
| **AC-12** | Focus Visibility Styling | `apps/web/src/index.css` includes a global `:focus-visible` outline style. | CSS content assertion. |
| **AC-13** | Branding: Title Tag | `apps/web/index.html` title is `<title>TruchaBrew</title>`. | HTML content assertion. |
| **AC-14** | Copy: Delete Confirmation | Recipe delete confirmation in `App.tsx` explicitly names the recipe being deleted and lists lost data. | Integration test assertion. |
| **AC-15** | Quality: Four Gates | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all pass with exit code 0. | CLI verification. |
| **AC-16** | Scope Guardrail | Pre/post SHA-256 manifest diff confirms only permitted web components, css/html files, and test files modified. `apps/api/`, `packages/calculations/`, and `packages/shared-types/` remain completely untouched. | Pre/post manifest comparison. |

---

## 5. Implementation Sequence

1. **Phase 1: Token Consolidation**: Import and apply `CARD_CLASS` and `SECTION_HEADING_CLASS` in `FermentableSection.tsx`, `HopSection.tsx`, `YeastSection.tsx`, `MashSection.tsx`, and `MiscSection.tsx`.
2. **Phase 2: Table & Control Accessibility Hardening**: Add `scope="col"`, `aria-label` attributes on numeric inputs and remove buttons in ingredient sections; add `aria-label` on back button in `App.tsx`.
3. **Phase 3: Dialog Semantics & Copy Polish**: Update Scale modal semantics, delete confirmation copy in `App.tsx`, and title tag in `index.html`.
4. **Phase 4: Global Focus Indicator & Component Tests**: Add `:focus-visible` to `index.css` and implement comprehensive `accessibilityAndPolish.test.tsx`.
5. **Phase 5: Verification & Four Gates**: Run full test suite, typecheck across all 4 workspaces, production build, and lint.
