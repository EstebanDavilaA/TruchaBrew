# FEATURE SPECIFICATION: M30_P3 - `Button` and `NumberInput` Primitives & `CalculatorCard` Token Unification

> **Milestone 30:** "The calculators all look like one tool." (Living Design System initiative, `.gsd/ROADMAP.md`)
> **Phase 3 of 4.** Adds `<Button>` and `<NumberInput>` to `components/ui/`, updates `ui/index.ts`, and refactors `CalculatorCard.tsx` (`NumericField` onto `<NumberInput>`, `CalculatorCard` onto `CARD_CLASS`, `ResultRow` onto `SUBPANEL_CLASS` and `MONO_VALUE_CLASS`).

---

## Phase Summary

In Phase 2, TruchaBrew established the `apps/web/src/components/ui/` primitive tree (`<FormField>`, `<Input>`, `<Select>`) and re-pointed `CalculatorCard.tsx`'s `NumericField` and `SelectField`.

In Phase 3, we complete the form-and-action primitive set by implementing:
1. `<Button>` — supporting primary, secondary, danger, and icon variants with standard (`md`, 40px) and compact (`sm`) sizing, defaulting to `type="button"`.
2. `<NumberInput>` — providing unified numeric input formatting with `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`), size variants (`sm`/`md`), text alignment (`align="left" | "right"`), and optional trailing unit addons (`addonRight`).
3. `CalculatorCard.tsx` Token Unification — dropping the hardcoded byte-identical copies of `CARD_CLASS` and `SUBPANEL_CLASS`, re-pointing `NumericField` to `<NumberInput>`, and migrating `ResultRow` output typography onto `MONO_VALUE_CLASS`.

**Why this satisfies vertical-slice constraints (Hard Rule 2):**
Shipping `<Button>` and `<NumberInput>` alongside their immediate adoption in `CalculatorCard.tsx` eliminates the parallel styling definitions inside `components/calculators/`, ensures all calculator outputs and inputs share the exact same numeric typography (`tracking-tight`), and provides the validated button/number primitives required for the full Calculators hub migration in Phase 4.

---

### Key Behaviors

1. `apps/web/src/components/ui/` exports `Button`, `ButtonProps`, `NumberInput`, and `NumberInputProps` via `apps/web/src/components/ui/index.ts`.
2. `<Button>` renders button elements with default `type="button"`, composing the canonical design tokens:
   - `variant="primary"` (default): `BUTTON_PRIMARY_CLASS`
   - `variant="secondary"`: `BUTTON_SECONDARY_CLASS`
   - `variant="danger"`: `BUTTON_DANGER_CLASS`
   - `variant="icon"`: `BUTTON_ICON_CLASS`
   - `size="sm"`: compact padding/text (`text-xs px-3 py-1.5` for standard buttons, retaining `BUTTON_ICON_CLASS` for icon buttons).
3. `<NumberInput>` renders numeric inputs with default `w-full`, `INPUT_CLASS`, `CONTROL_HEIGHT_CLASS` (`h-10`), `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`), and default `type="text" inputMode="decimal"`.
   - `size="sm"`: applies `INPUT_COMPACT_CLASS` + `MONO_VALUE_CLASS` without `h-10`.
   - `align="right"`: applies `text-right`.
   - `addonRight`: renders an optional trailing unit string (e.g. `°C`, `kg`, `SG`, `min`) in `text-xs text-slate-400`.
4. In `apps/web/src/components/calculators/CalculatorCard.tsx`:
   - `NumericField` renders `<FormField label={label}><NumberInput ... /></FormField>`.
   - `CalculatorCard` container replaces `"bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg"` with `CARD_CLASS` imported from `../designSystem`.
   - `ResultRow` replaces `"bg-slate-800/80 p-3 rounded-lg border border-slate-700/60"` with `SUBPANEL_CLASS` imported from `../designSystem`, and applies `MONO_VALUE_CLASS` to the output value.
5. All 10 calculator cards continue to compute and display results with 100% fidelity, inheriting unified numeric typography and container tokens.

---

### Resolved Ambiguities (Binding)

**RA-1 — Button Default Type Attribute.**
`<Button>` explicitly defaults `type="button"` unless a caller explicitly overrides `type="submit"` or `type="reset"`. This prevents accidental form submission when buttons are embedded in `<form>` containers.

**RA-2 — Class-Merging Strategy.**
Zero external class-merging dependencies (`clsx`, `tailwind-merge`, `cva`). All primitives compose classes via standard deterministic array filtering:
```ts
[baseVariantClass, sizeClass, alignClass, className].filter(Boolean).join(' ')
```

**RA-3 — `NumberInput` Typography & Suffix Alignment.**
`NumberInput` applies `MONO_VALUE_CLASS` (`font-mono tabular-nums tracking-tight`) directly to the `<input>` element. When `addonRight` is present, it renders in a flex or relative container with trailing unit text positioned cleanly without obstructing input text.

**RA-4 — `NumericField` Signature Preservation.**
`NumericFieldProps` (`{ label: string; value: string; onChange: (val: string) => void; }`) remains 100% signature-compatible. Call sites across all 10 calculator cards require zero modifications.

**RA-5 — `designSystem.ts` remains strictly constants-only and untouched.**
`designSystem.ts` is not modified. It continues to export exactly 28 constants. `designSystem.test.ts` passes unmodified.

**RA-6 — `calculatorImportGraph.test.ts` Allowlist Extension.**
`CalculatorCard.tsx` imports canonical tokens (`CARD_CLASS`, `SUBPANEL_CLASS`, `MONO_VALUE_CLASS`) directly from `../designSystem`. `apps/web/test/calculatorImportGraph.test.ts`'s AC-23 allowlist is extended with `components/designSystem.tsx` to recognize design system token imports alongside `PageContainer`, `TopBar`, and `ui.tsx`.


---

## Logged Items

| Item | Status | Notes |
|---|---|---|
| **BUG-040** — TruchaBrew Design System Unification | `IN_PLANNING` | P3 delivers Expected Behavior §1 (`Button` and `NumberInput` primitives + `CalculatorCard` token migration). |
| **FEAT-005** — App-Wide UI/UX Redesign | `LOGGED` | Button and numeric input unification advances here. |

---

## 1. Data Schema & Contracts

### 1.1 New UI Primitives (`apps/web/src/components/ui/`)

#### `Button.tsx`
```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}
```
- Default `variant="primary"`, default `size="md"`, default `type="button"`.
- Uses `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `BUTTON_DANGER_CLASS`, `BUTTON_ICON_CLASS` from `../designSystem`.
- `size="sm"` applies compact sizing (`text-xs px-3 py-1.5` for text buttons).

#### `NumberInput.tsx`
```tsx
import type { InputHTMLAttributes } from 'react';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  addonRight?: string;
}
```
- Default `size="md"`, default `align="left"`, default `type="text"`, default `inputMode="decimal"`.
- `size="md"` applies `INPUT_CLASS` + `CONTROL_HEIGHT_CLASS` (`h-10`) + `MONO_VALUE_CLASS` + `w-full`.
- `size="sm"` applies `INPUT_COMPACT_CLASS` + `MONO_VALUE_CLASS` + `w-full`.
- `align="right"` applies `text-right`.
- `addonRight` renders trailing unit text in `text-xs text-slate-400`.

### 1.2 Barrel Export (`apps/web/src/components/ui/index.ts`)
Re-exports:
- `FormField`, `FormFieldProps`
- `Input`, `InputProps`
- `Select`, `SelectProps`, `SelectOption`
- `Button`, `ButtonProps`, `ButtonVariant`, `ButtonSize`
- `NumberInput`, `NumberInputProps`

### 1.3 `CalculatorCard.tsx` Refactoring
- Imports `CARD_CLASS`, `SUBPANEL_CLASS`, `MONO_VALUE_CLASS` from `../designSystem`.
- Imports `FormField`, `NumberInput`, `Select` from `../ui`.
- `CalculatorCard`: `<section className={CARD_CLASS}>`.
- `NumericField`: renders `<FormField label={label}><NumberInput value={value} onChange={(e) => onChange(e.target.value)} /></FormField>`.
- `ResultRow`: container uses `SUBPANEL_CLASS`, value span uses `text-sm font-bold text-amber-400 ${MONO_VALUE_CLASS}`.

---

## 2. File Inventory

| Path | Action | Description |
|---|---|---|
| `apps/web/src/components/ui/Button.tsx` | **NEW** | Button primitive supporting primary/secondary/danger/icon variants and sm/md sizes. |
| `apps/web/src/components/ui/NumberInput.tsx` | **NEW** | Numeric input primitive with `MONO_VALUE_CLASS`, alignment, size, and addon support. |
| `apps/web/src/components/ui/index.ts` | **MODIFY** | Re-export `Button` and `NumberInput` and their types. |
| `apps/web/src/components/calculators/CalculatorCard.tsx` | **MODIFY** | Re-point `NumericField` to `<NumberInput>`, use `CARD_CLASS` in `CalculatorCard`, and `SUBPANEL_CLASS`/`MONO_VALUE_CLASS` in `ResultRow`. |
| `apps/web/test/uiPrimitives.test.tsx` | **MODIFY** | Add comprehensive unit/integration test coverage for `Button`, `NumberInput`, and updated `CalculatorCard` / `ResultRow`. |
| `apps/web/test/calculatorImportGraph.test.ts` | **MODIFY** | Extend AC-23 allowlist with designSystem token file for CalculatorCard. |

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | `components/ui/index.ts` exports all primitives and types | Unit Test | Exports `Button`, `ButtonProps`, `NumberInput`, `NumberInputProps` alongside `FormField`, `Input`, `Select`. |
| **AC-2** | `<Button>` default renders with `BUTTON_PRIMARY_CLASS` | Unit Test | Applies `BUTTON_PRIMARY_CLASS` (`bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50`). |
| **AC-3** | `<Button variant="secondary">` renders with `BUTTON_SECONDARY_CLASS` | Unit Test | Applies `BUTTON_SECONDARY_CLASS` (`bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50`). |
| **AC-4** | `<Button variant="danger">` renders with `BUTTON_DANGER_CLASS` | Unit Test | Applies `BUTTON_DANGER_CLASS` (`bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-semibold px-3 py-2 rounded-lg border border-rose-800 transition-colors cursor-pointer disabled:opacity-40`). |
| **AC-5** | `<Button variant="icon">` renders with `BUTTON_ICON_CLASS` | Unit Test | Applies `BUTTON_ICON_CLASS` (`p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40`). |
| **AC-6** | `<Button size="sm">` renders with compact padding/text | Unit Test | Applies `text-xs px-3 py-1.5` for standard button variants. |
| **AC-7** | `<Button>` defaults to `type="button"` and supports disabled state | Unit Test | Rendered button has `type="button"` attribute; passes through `disabled`, `onClick`, and `aria-label`. |
| **AC-8** | `<NumberInput>` default renders with `INPUT_CLASS`, `CONTROL_HEIGHT_CLASS` (`h-10`), and `MONO_VALUE_CLASS` | Unit Test | Applies `w-full`, `INPUT_CLASS`, `h-10`, and `font-mono tabular-nums tracking-tight`. |
| **AC-9** | `<NumberInput size="sm">` renders with `INPUT_COMPACT_CLASS` and `MONO_VALUE_CLASS` without `h-10` | Unit Test | Applies `w-full`, `INPUT_COMPACT_CLASS`, and `font-mono tabular-nums tracking-tight`. |
| **AC-10** | `<NumberInput align="right">` renders with `text-right` | Unit Test | Applies `text-right` class. |
| **AC-11** | `<NumberInput>` defaults to `type="text"` with `inputMode="decimal"` | Unit Test | Rendered input has `type="text"` and `inputMode="decimal"`. |
| **AC-12** | `<NumberInput addonRight="...">` renders trailing unit text | Unit Test | Renders trailing addon text in `text-xs text-slate-400`. |
| **AC-13** | `CalculatorCard.tsx` `NumericField` renders `<NumberInput>` within `<FormField>` | Integration Test | `NumericField` renders `<NumberInput>` with `h-10` and `tracking-tight` mono typography. |
| **AC-14** | `CalculatorCard.tsx` `CalculatorCard` uses `CARD_CLASS` token | Integration Test | `CalculatorCard` section renders `bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg`. |
| **AC-15** | `CalculatorCard.tsx` `ResultRow` uses `SUBPANEL_CLASS` and `MONO_VALUE_CLASS` | Integration Test | `ResultRow` container renders `SUBPANEL_CLASS` (`bg-slate-800/80 p-3 rounded-lg border border-slate-700/60`); value renders with `tracking-tight`. |
| **AC-16** | No `*_CLASS` constant defined inside `components/ui/` | Static Analysis | Zero local class constants in `components/ui/`; tokens imported from `../designSystem`. |
| **AC-17** | `designSystem.ts` export count remains exactly 28 | Guardrail | 28 constants exported; `designSystem.test.ts` and AC-7 green. |
| **AC-18** | All 10 standalone calculators remain fully operational | Integration Test | All calculator test suites pass in `Calculators.test.tsx` and `calculatorImportGraph.test.ts`. |
| **AC-19** | Zero external dependencies added | Guardrail | `package.json` and `package-lock.json` untouched. |
| **AC-20** | Scope Guardrail — authorized files only | Verification | SHA-256 pre/post manifest diff matches authorized set: 2 created (`Button.tsx`, `NumberInput.tsx`), 4 modified (`ui/index.ts`, `CalculatorCard.tsx`, `uiPrimitives.test.tsx`, `calculatorImportGraph.test.ts`), 0 deleted. |
| **AC-21** | Layer 1 Gate: Unit & integration tests | Verification | `npm test` exit 0 across all workspaces. |
| **AC-22** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exit 0 (4/4 clean). |
| **AC-23** | Layer 1 Gate: Production build | Verification | `npm run build` exit 0. |
| **AC-24** | Layer 1 Gate: Lint | Verification | `npm run lint` exit 0. |
| **AC-25** | Manual verification screenshot captured | Verification | Screenshot `M30_P3_button_number_input_controls.png` saved in `.gsd/active/manual_verification/`. |

---

## 4. Halt Gate (State 2)

> **HALT GATE (STATE 2):** Present this spec to the user.
> Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."*
> **DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.**
