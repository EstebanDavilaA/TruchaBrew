# FEATURE SPECIFICATION: M30_P2 - `ui/` Is Born With Its First Real Consumer

> **Milestone 30:** "The calculators all look like one tool." (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 2 of 4.** Introduces the `components/ui/` primitive tree (`FormField`, `Input`, `Select`) and immediately proves them by re-pointing `components/calculators/CalculatorCard.tsx` (`NumericField` and `SelectField`).

---

## Phase Summary

In Phase 1, `designSystem.ts` was extended with `FORM_LABEL_CLASS` and `CONTROL_HEIGHT_CLASS`, and the form-control tokens were repaired to expose keyboard focus rings app-wide.

In this phase, TruchaBrew establishes its official React UI primitive module tree: `apps/web/src/components/ui/`. It ships the first three core form primitives — `<FormField>`, `<Input>`, and `<Select>` — and immediately re-points `apps/web/src/components/calculators/CalculatorCard.tsx`'s existing `NumericField` and `SelectField` abstraction onto them.

**Why this satisfies vertical-slice constraints (Hard Rule 2):**
Shipping a primitive layer with zero consumers is an anti-pattern. By re-pointing `CalculatorCard.tsx`'s component boundary in the same slice, all ten calculator cards on the Calculators hub immediately inherit:
1. Universal 40px (`h-10`) control height across both numeric inputs and select dropdowns (fixing the ~44px select vs ~38px input baseline mismatch).
2. Consistent `rounded-lg` (8px) corner radius across all calculator inputs and selects (retiring the ad-hoc `rounded` 4px styling).
3. The canonical `FORM_LABEL_CLASS` label typography.
4. Elimination of 2 inline `focus:outline-none` overrides from `CalculatorCard.tsx`.

---

### Key Behaviors

1. `apps/web/src/components/ui/` exists and exports `FormField`, `Input`, and `Select` via `apps/web/src/components/ui/index.ts`.
2. `<FormField>` renders field labels using `FORM_LABEL_CLASS` (`block text-xs font-semibold text-slate-400 mb-1`), wraps child controls with vertical gap rhythm, and supports optional `htmlFor`/`id`, `hint`, and `error` text.
3. `<Input>` renders text and numeric inputs with default `w-full`, `INPUT_CLASS`, and `CONTROL_HEIGHT_CLASS` (`h-10`), supporting a `size="sm"` variant (rendering `INPUT_COMPACT_CLASS`) and a `mono` typography option (`font-mono tabular-nums`).
4. `<Select>` renders select dropdowns with default `w-full`, `FORM_SELECT_CLASS`, and `CONTROL_HEIGHT_CLASS` (`h-10`), supporting a `size="sm"` variant (rendering `FORM_SELECT_COMPACT_CLASS`) and accepting either an `options` array (`{ value: string; label: string }[]`) or custom `<option>` children.
5. In `apps/web/src/components/calculators/CalculatorCard.tsx`, `NumericField` and `SelectField` delegate their markup and styling directly to `<FormField>`, `<Input>`, and `<Select>`, maintaining 100% API compatibility with existing calculator card call sites.
6. All 10 calculator cards render input controls at 40px height with `rounded-lg` corners and clear amber `:focus-visible` focus rings.

---

### Resolved Ambiguities (Binding)

**RA-1 — Class-Merging Strategy: Zero-Dependency Variant API (OQ-2 Resolution).**
No class-merging dependency (`clsx`, `tailwind-merge`, `cva`, `tailwind-variants`) is added. Primitives manage internal variants and optional caller-provided `className` props using deterministic array filtering:
```ts
[baseClasses, sizeClasses, className].filter(Boolean).join(' ')
```
Because the primitive layer provides explicit props (`size="sm" | "md"`, `mono?: boolean`), callers do not need to inject conflicting Tailwind utility overrides (e.g. `!px-3` or `!py-1.5`).

**RA-2 — `CalculatorCard.tsx` boundary scope in P2.**
`NumericField` and `SelectField` inside `CalculatorCard.tsx` are refactored to consume `components/ui/`. `CalculatorCard` (card container) and `ResultRow` (output row) are left structurally functional; their cleanup (`CARD_CLASS`/`SUBPANEL_CLASS` token re-points) is scheduled for P3 alongside `<Button>` and `<NumberInput>`.

**RA-3 — `NumericField` and `SelectField` Props & Behavior Contracts.**
`NumericFieldProps` (`{ label: string; value: string; onChange: (val: string) => void; }`) and `SelectFieldProps` (`{ label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (val: string) => void; }`) remain strictly identical in signature. Callers in all 10 calculator cards require zero edits.

**RA-4 — `designTokens.test.ts` AC-9 sweep reconciliation.**
With `CalculatorCard.tsx`'s 2 inline `focus:outline-none` occurrences retired onto `<Input>` and `<Select>`, the app-wide `focus:outline-none` count drops from 16 to **14**, and `components/calculators/CalculatorCard.tsx` is removed from the surviving-files list (leaving exactly 4 files: `App.tsx`, `components/FermentableSection.tsx`, `components/HopSection.tsx`, `components/RecipeLibrary.tsx`). `designTokens.test.ts` AC-9 is updated to assert 14 total and the 4-file list.

**RA-5 — `designSystem.ts` remains strictly constants-only and untouched.**
`designSystem.ts` is not modified. It continues to export 28 constants. `designSystem.test.ts` passes unmodified.

**RA-6 — Accessibility & Focus Ring Retention.**
`<Input>` and `<Select>` directly compose `INPUT_CLASS` and `FORM_SELECT_CLASS`. When focused via keyboard, they exhibit the amber 2px focus ring (`focus-visible:outline-amber-500`) with `focus:border-amber-500`.

---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_PLANNING` | P2 delivers Expected Behavior §1 (`FormField`, `Input`, `Select` primitives with universal 40px `h-10` height). |
| **BUG-036, BUG-037, BUG-038, BUG-039** | `OPEN` | Downstream consumers (profile editors and settings) scheduled for M31+. |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Label and control height normalization advances here. |

---

## 1. Data Schema & Contracts

### 1.1 New UI Primitives (`apps/web/src/components/ui/`)

#### `FormField.tsx`
```tsx
export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  id?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}
```
- When `label` is provided without `htmlFor`, wraps children inside a `<label className="...">` using `FORM_LABEL_CLASS`.
- When `htmlFor` is provided, renders a `<label htmlFor={htmlFor} className={FORM_LABEL_CLASS}>{label}</label>` followed by child elements.
- When `hint` is provided and no `error`, renders hint text in `text-xs text-slate-400`.
- When `error` is provided, renders error text in `text-xs text-rose-400`.

#### `Input.tsx`
```tsx
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  mono?: boolean;
}
```
- Default `size="md"`: applies `INPUT_CLASS` + `CONTROL_HEIGHT_CLASS` (`h-10`) + `w-full`.
- `size="sm"`: applies `INPUT_COMPACT_CLASS` + `w-full`.
- `mono={true}`: appends `font-mono tabular-nums`.

#### `Select.tsx`
```tsx
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md';
  options?: readonly SelectOption[];
}
```
- Default `size="md"`: applies `FORM_SELECT_CLASS` + `CONTROL_HEIGHT_CLASS` (`h-10`) + `w-full`.
- `size="sm"`: applies `FORM_SELECT_COMPACT_CLASS` + `w-full`.
- Supports rendering items from `options` prop or via standard `<option>` child elements.

#### `index.ts` (Barrel Export)
Re-exports `FormField`, `FormFieldProps`, `Input`, `InputProps`, `Select`, `SelectProps`, `SelectOption`.

---

### 1.2 Modified Component (`CalculatorCard.tsx`)

- Imports `{ FormField, Input, Select }` from `../ui`.
- `NumericField`: renders `<FormField label={label}><Input type="text" inputMode="decimal" mono value={value} onChange={(e) => onChange(e.target.value)} /></FormField>`.
- `SelectField`: renders `<FormField label={label}><Select value={value} options={options} onChange={(e) => onChange(e.target.value)} /></FormField>`.
- Props interfaces `CalculatorCardProps`, `NumericFieldProps`, `SelectFieldProps`, `ResultRowProps` remain exported and byte-compatible.

---

## 2. Acceptance Criteria & Test Matrix

Test files:
- `apps/web/test/uiPrimitives.test.tsx` (NEW)
- `apps/web/test/designTokens.test.ts` (MODIFIED)
- `apps/web/test/Calculators.test.tsx` (VERIFICATION)

| ID | Requirement | Test Type | Expected Outcome |
|----|-------------|-----------|------------------|
| **AC-1** | `components/ui/index.ts` exports all primitives and types | Unit (`uiPrimitives.test.tsx`) | `FormField`, `Input`, `Select` exported as callable React components. |
| **AC-2** | `<FormField>` renders label with `FORM_LABEL_CLASS` | Component (`uiPrimitives.test.tsx`) | Label text renders with `block text-xs font-semibold text-slate-400 mb-1`. |
| **AC-3** | `<FormField>` renders optional hint and error text | Component (`uiPrimitives.test.tsx`) | Hint renders `text-slate-400`; error renders `text-rose-400`. |
| **AC-4** | `<Input>` default renders with `INPUT_CLASS` and `h-10` | Component (`uiPrimitives.test.tsx`) | Input element contains `bg-slate-800`, `border-slate-700`, `rounded-lg`, `h-10`, and focus ring classes. |
| **AC-5** | `<Input size="sm">` renders with `INPUT_COMPACT_CLASS` | Component (`uiPrimitives.test.tsx`) | Input element contains `rounded px-2.5 py-1 text-xs`. |
| **AC-6** | `<Input mono>` renders with `font-mono tabular-nums` | Component (`uiPrimitives.test.tsx`) | Input element contains `font-mono tabular-nums`. |
| **AC-7** | `<Select>` default renders with `FORM_SELECT_CLASS` and `h-10` | Component (`uiPrimitives.test.tsx`) | Select element contains `bg-slate-800`, `rounded-lg`, `h-10`, `cursor-pointer`, and focus ring classes. |
| **AC-8** | `<Select size="sm">` renders with `FORM_SELECT_COMPACT_CLASS` | Component (`uiPrimitives.test.tsx`) | Select element contains `rounded px-2 py-1 text-xs`. |
| **AC-9** | `<Select>` renders options from prop array | Component (`uiPrimitives.test.tsx`) | Renders `<option>` elements matching `options` prop values and labels. |
| **AC-10** | `<Select>` renders options from children | Component (`uiPrimitives.test.tsx`) | Renders nested `<option>` child elements when passed as JSX children. |
| **AC-11** | `CalculatorCard.tsx` `NumericField` renders `<Input>` through `<FormField>` | Integration (`Calculators.test.tsx` / `uiPrimitives.test.tsx`) | Numeric fields in calculator cards render `rounded-lg` and `h-10`. |
| **AC-12** | `CalculatorCard.tsx` `SelectField` renders `<Select>` through `<FormField>` | Integration (`Calculators.test.tsx` / `uiPrimitives.test.tsx`) | Select dropdowns in calculator cards render `rounded-lg` and `h-10`. |
| **AC-13** | Calculator card inputs and selects match in height | Integration / CSS | Both `<Input>` and `<Select>` in `CalculatorCard` evaluate to `h-10` (40px). |
| **AC-14** | `focus:outline-none` occurrence count drops 16 → 14 | Unit (`designTokens.test.ts` AC-9) | App-wide count is exactly 14. |
| **AC-15** | `CalculatorCard.tsx` removed from `focus:outline-none` remaining files | Unit (`designTokens.test.ts` AC-9) | Remaining files list is exactly `['App.tsx', 'components/FermentableSection.tsx', 'components/HopSection.tsx', 'components/RecipeLibrary.tsx']`. |
| **AC-16** | No `*_CLASS` constant defined inside `components/ui/` | Unit (`designTokens.test.ts` AC-12) | AC-12 drift regex passes with zero hits outside `designSystem.ts`. |
| **AC-17** | `designSystem.ts` export count remains exactly 28 | Unit (`designTokens.test.ts` AC-7) | AC-7 passes with 28 keys. |
| **AC-18** | All 10 standalone calculators remain fully operational | Integration (`Calculators.test.tsx`) | All 50+ existing calculator tests pass without behavioral regression. |
| **AC-19** | Zero external dependencies added | Verification | `package.json` and `package-lock.json` untouched. |
| **AC-20** | **Scope Guardrail** — authorized files only | Verification (SHA-256 Manifest) | Exactly authorized new and modified files differ between pre and post execution. |
| **AC-21** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exits 0. |
| **AC-22** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits 0 across all 4 workspaces. |
| **AC-23** | Layer 1 Gate: Production build | Verification | `npm run build` exits 0. |
| **AC-24** | Layer 1 Gate: Lint | Verification | `npm run lint` exits 0 with 0 errors and 0 new warnings. |
| **AC-25** | Manual verification screenshots captured | Manual Verification | `M30_P2_calculator_controls.png` and `M30_P1_focus_ring.png` present in `.gsd/active/manual_verification/`. |

---

## 3. Scope Guardrail — Authorized Files

### 3.1 Authorized to Create (5 files)
1. `apps/web/src/components/ui/FormField.tsx`
2. `apps/web/src/components/ui/Input.tsx`
3. `apps/web/src/components/ui/Select.tsx`
4. `apps/web/src/components/ui/index.ts`
5. `apps/web/test/uiPrimitives.test.tsx`

### 3.2 Authorized to Modify (3 files)
1. `apps/web/src/components/calculators/CalculatorCard.tsx`
2. `apps/web/test/designTokens.test.ts`
3. `apps/web/test/calculatorImportGraph.test.ts`

### 3.3 Explicitly Forbidden
- `apps/web/src/components/designSystem.ts` (untouched, constants-only).
- `apps/web/src/components/calculators/Calculators.tsx` or individual calculator card implementations (P4 scope).
- `apps/web/src/components/ui/Button.tsx` or `NumberInput.tsx` (P3 scope).
- Any other component in `apps/web/src/components/` (`InventoryForm.tsx`, `EquipmentForm.tsx`, `HopSection.tsx`, etc.).
- `package.json`, `package-lock.json`.

---

## 4. Layer 1 Command Gates

```bash
npm test
npm run typecheck
npm run build
npm run lint
```
All four gates must exit 0 cleanly before `/execute` halts for `/steer`.

---

## 5. Manual Verification Evidence

Save to `.gsd/active/manual_verification/`:
- **`M30_P2_calculator_controls.png`**: Screenshot of the Calculators hub displaying calculator cards with unified 40px `h-10` input/select fields, `rounded-lg` borders, and canonical `FORM_LABEL_CLASS` label styling.
- **`M30_P1_focus_ring.png`**: Screenshot demonstrating the amber focus-visible ring on keyboard navigation tab into an input field (folding M30_P1's deferred capture into this phase).

---

> **HALT GATE (STATE 2):** Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments. DO NOT WRITE A SINGLE LINE OF IMPLEMENTATION CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
