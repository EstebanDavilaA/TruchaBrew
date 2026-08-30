# FEATURE SPECIFICATION: M35_P4 — Design System Guardrails & Pin Debt Retirement

## Phase Summary
Milestone 35 Phase 4 delivers the definitive anti-regression mechanism for the entire *Living Design System* initiative (Milestones 30–35). It replaces fragile regex and occurrence-count assertions with a resilient, structural AST-level adoption guardrail across `apps/web/src`, retires brittle numeric pins in favor of structural invariants, guarantees every `components/ui/` primitive and `designSystem.ts` token has active consumers (`consumers > 0`), and provides explicit negative control proofs demonstrating that hand-rolled HTML primitives or drift patterns fail the suite.

This phase touches **test files only** (`ScopeGuardrail.test.tsx`, `designTokens.test.ts`, `designSystem.test.ts`, `uiPrimitives.test.tsx`). Zero product files in `apps/web/src` or `packages/**` are modified.

---

### Key Behaviors
1. **Adoption Guardrail (Anti-Drift Engine)**:
   - Sweeps all `.tsx` component files under `apps/web/src` (excluding `apps/web/src/components/ui/**`).
   - Asserts zero unapproved raw HTML primitive elements: `<input>`, `<select>`, `<textarea>`, `<button>`, and `<table>`.
   - All standard controls MUST be rendered via `<FormField>`, `<Input>`, `<NumberInput>`, `<Select>`, `<Button>`, `<Table>`, or `<Badge>`.
   - Strictly permitted exceptions are explicitly whitelist-checked:
     - Hidden file inputs: `<input type="file" ... className="hidden" />` (e.g. `RecipeImportModal.tsx`, `RecipeLibrary.tsx`).
     - Checkbox controls used as native click toggles in select components (e.g. `RecipeImportModal.tsx`).
2. **Negative Control & Failure Demonstration**:
   - The test suite includes an explicit test asserting that when a synthetic component containing a raw `<button className="...">` or `<input className="...">` is presented to the adoption scanner, the scanner detects and rejects the violations with descriptive diagnostic feedback.
3. **Pin Debt Retirement**:
   - Retires brittle literal occurrence counts in `ScopeGuardrail.test.tsx` (e.g. `expect(total).toBeLessThanOrEqual(21)`, `expect(matches.length).toBe(10)`, `expect(matches.length).toBe(6)`, `expect(matches.length).toBe(1)`) in favor of refactor-surviving structural and accessibility invariants.
   - Retires brittle numeric contrast/token counts in `designTokens.test.ts` (e.g. `expect(total).toBe(13)`, `expect(total).toBe(4)`, `expect(total).toBe(2)`) in favor of class-token membership and semantic token coverage invariants.
4. **Consumers > 0 & Export Shape Verification**:
   - Asserts every exported component and utility from `apps/web/src/components/ui/index.ts` (`FormField`, `Input`, `NumberInput`, `Select`, `Button`, `Table`, `TableHeaderCell`, `TableCell`, `Badge`) has $\ge 1$ consuming component across `apps/web/src`.
   - Asserts every exported design token in `apps/web/src/components/designSystem.ts` has $\ge 1$ consuming component or UI primitive across `apps/web/src`.
   - Converted AC-7's key list from a hard-coded scalar integer pin into a structural shape assertion that validates tokens are non-empty strings or record mappings matching their expected type signatures.

---

### Resolved Ambiguities (Binding)
- **RA-1: Scanner Tokenizer & Boundary Parsing**:
  - The adoption scanner must be tag-boundary and quote-aware, correctly parsing multi-line JSX tags, arrow functions inside props (e.g. `onChange={(e) => ...}`), and JSX comments without misidentifying identifiers.
- **RA-2: Whitelisted Raw Primitive Exemptions**:
  - The ONLY permitted raw HTML form controls outside `components/ui/**` are:
    1. `<input type="file" ... className="hidden" ... />` (invisible OS file-picker triggers).
    2. Native selection checkboxes `<input type="checkbox" ... />` where a dedicated checkbox primitive has not been introduced.
  - All other inputs (text, number, search, password, email, etc.), buttons, selects, textareas, and tables outside `components/ui/**` are forbidden and must use the shared UI primitives.
- **RA-3: Negative Control Determinism**:
  - Negative control tests must execute in-memory against synthetic AST/JSX snippets rather than mutating tracked codebase files on disk, ensuring zero side-effects on the working tree.
- **RA-4: Consumers > 0 Invariant Scope**:
  - The `consumers > 0` sweep scans all `.tsx` and `.ts` files under `apps/web/src` (excluding the file defining the symbol itself and barrel exports `ui/index.ts`). A token or component used anywhere in `apps/web/src` counts as consumed.
- **RA-5: Scope Guardrail (Test-Only Phase)**:
  - Phase 4 modifies ONLY:
    - `apps/web/test/ScopeGuardrail.test.tsx`
    - `apps/web/test/designTokens.test.ts`
    - `apps/web/test/designSystem.test.ts`
    - `apps/web/test/uiPrimitives.test.tsx`
  - Zero lines of application source code (`apps/web/src/**`, `packages/**`) may be altered.

---

## 1. Data Schema & Contracts

### 1.1 UI Primitives Symbol Inventory
The following 9 UI components in `apps/web/src/components/ui/index.ts` are verified for active consumers:
- `FormField`
- `Input`
- `NumberInput`
- `Select`
- `Button`
- `Table`
- `TableHeaderCell`
- `TableCell`
- `Badge`

### 1.2 Design System Tokens Symbol Inventory
The 35 exported design system tokens in `apps/web/src/components/designSystem.ts` are verified for shape and active consumers:
- Layout & Card: `PAGE_TITLE_CLASS`, `SECTION_HEADING_CLASS`, `SUBSECTION_HEADING_CLASS`, `CARD_CLASS`, `CARD_STACK_GAP_CLASS`, `SUBPANEL_CLASS`, `SETTINGS_ROW_CLASS`
- Typography & Values: `BODY_TEXT_CLASS`, `METADATA_TEXT_CLASS`, `METRIC_TILE_CLASS`, `METRIC_LABEL_CLASS`, `METRIC_VALUE_CLASS`, `MONO_VALUE_CLASS`
- Forms & Controls: `FORM_LABEL_CLASS`, `INPUT_CLASS`, `INPUT_COMPACT_CLASS`, `FORM_SELECT_CLASS`, `FORM_SELECT_COMPACT_CLASS`, `CONTROL_HEIGHT_CLASS`
- Buttons: `BUTTON_PRIMARY_CLASS`, `BUTTON_SECONDARY_CLASS`, `BUTTON_DANGER_CLASS`, `BUTTON_ICON_CLASS`
- Badges: `STATUS_BADGE_WRAPPER_CLASS`, `STATUS_BADGE_CLASS`, `SEMANTIC_BADGE_CLASS`
- States: `LOADING_STATE_CLASS`, `EMPTY_STATE_CLASS`, `ERROR_STATE_CLASS`
- Tables: `TABLE_CLASS`, `TABLE_HEADER_CELL_CLASS`, `TABLE_CELL_CLASS`, `TABLE_CELL_TEXT_CLASS`, `TABLE_CELL_SM_CLASS`, `TABLE_CELL_SM_TEXT_CLASS`

---

## 2. Transformations & Pure Logic

### 2.1 Adoption Scanner Specification
- **Function**: `scanAdoptionViolations(filePath: string, content: string): Violation[]`
- **Logic**:
  1. If `filePath` is within `components/ui/`, return `[]`.
  2. Parse all JSX opening tags `<tagName ...>`.
  3. If `tagName` is `table` -> Violation: raw table detected (must use `<Table>`).
  4. If `tagName` is `select` -> Violation: raw select detected (must use `<Select>`).
  5. If `tagName` is `textarea` -> Violation: raw textarea detected.
  6. If `tagName` is `button` -> Violation: raw button detected (must use `<Button>`).
  7. If `tagName` is `input`:
     - If attributes contain `type="file"` and `hidden` / `className="hidden"` -> Exempt.
     - If attributes contain `type="checkbox"` -> Exempt.
     - Else -> Violation: raw input detected (must use `<Input>`, `<NumberInput>`, or `<FormField>`).
  8. Returns list of structured violations with line numbers and offending tag text.

### 2.2 Consumers > 0 Scanner Specification
- **Function**: `findUnconsumedSymbols(exports: string[], files: Array<{ file: string; content: string }>): string[]`
- **Logic**:
  1. For each exported symbol name `S`, search for references `\bS\b` across all candidate files (excluding the defining file).
  2. If reference count == 0, mark `S` as unconsumed.
  3. Returns array of unconsumed symbol names.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| **AC-1** | Adoption Guardrail: Zero Raw `<button>` Elements | Unit/AST Test | Scanner detects 0 raw `<button>` tags in `apps/web/src` outside `components/ui/**`. |
| **AC-2** | Adoption Guardrail: Zero Raw `<select>` Elements | Unit/AST Test | Scanner detects 0 raw `<select>` tags in `apps/web/src` outside `components/ui/**`. |
| **AC-3** | Adoption Guardrail: Zero Raw `<textarea>` Elements | Unit/AST Test | Scanner detects 0 raw `<textarea>` tags in `apps/web/src` outside `components/ui/**`. |
| **AC-4** | Adoption Guardrail: Zero Raw `<table>` Elements | Unit/AST Test | Scanner detects 0 raw `<table>` tags in `apps/web/src` outside `components/ui/**`. |
| **AC-5** | Adoption Guardrail: Zero Unapproved Raw `<input>` Elements | Unit/AST Test | Scanner detects 0 non-whitelisted `<input>` tags in `apps/web/src` outside `components/ui/**`. |
| **AC-6** | Negative Control: Scanner Rejects Raw Button | Unit Test | Scanner fed synthetic `<button className="bg-amber-600">Click</button>` returns violation. |
| **AC-7** | Negative Control: Scanner Rejects Raw Input | Unit Test | Scanner fed synthetic `<input className="bg-slate-800" />` returns violation. |
| **AC-8** | Negative Control: Scanner Rejects Raw Table | Unit Test | Scanner fed synthetic `<table className="w-full">...</table>` returns violation. |
| **AC-9** | Negative Control: Scanner Permits Whitelisted Hidden File Input | Unit Test | Scanner fed `<input type="file" className="hidden" />` returns 0 violations. |
| **AC-10** | Consumers > 0: UI Primitives | Unit Test | Every export in `components/ui/index.ts` has $\ge 1$ consumer across `apps/web/src`. |
| **AC-11** | Consumers > 0: Design System Tokens | Unit Test | Every export in `components/designSystem.ts` has $\ge 1$ consumer across `apps/web/src`. |
| **AC-12** | Shape Invariant: Design System Tokens | Unit Test | All exports in `designSystem.ts` match expected types (non-empty string or record of strings) without brittle scalar key length pins. |
| **AC-13** | Retired Pin: Statically Unnamed Controls Pin Debt | Unit Test | Brittle `expect(total).toBeLessThanOrEqual(21)` in `ScopeGuardrail.test.tsx` retired for structural `<FormField>` / `aria-label` invariant. |
| **AC-14** | Retired Pin: Label Class String Pin Debt | Unit Test | Brittle `toBe(10)`, `toBe(6)`, `toBe(1)` counts in `ScopeGuardrail.test.tsx` retired for semantic token adoption assertions. |
| **AC-15** | Retired Pin: Design System Class String Counts | Unit Test | Brittle `toBe(13)`, `toBe(4)`, `toBe(2)` counts in `designTokens.test.ts` retired for structural token invariants. |
| **AC-16** | Modal & Dialog Architecture Guardrail Retained | Unit Test | All dialogs import and render `<Modal>`, `ConfirmDialog` declares `role="alertdialog"`, and `window.confirm` occurrences remain 0. |
| **AC-17** | Legacy Deprecated Components Retained Clean | Unit Test | `BatchStepper` and `CarbonationPanel` remain 100% absent from disk and source code. |
| **AC-18** | Scope Guardrail: Test Files Only Modified | Verification | Pre/post SHA-256 manifest confirms edits strictly limited to `apps/web/test/ScopeGuardrail.test.tsx`, `apps/web/test/designTokens.test.ts`, `apps/web/test/designSystem.test.ts`, `apps/web/test/uiPrimitives.test.tsx`. |
| **AC-19** | Monotonic Suite Health: $\ge 1,850$ Tests Passing | Unit / Integration | Full test suite passes with zero regressions. |
| **AC-20** | Layer 1 Gate: Unit & Integration Tests | Verification | `npm test` exits code 0 across all workspaces. |
| **AC-21** | Layer 1 Gate: Typecheck | Verification | `npm run typecheck` exits code 0 across all 4 packages. |
| **AC-22** | Layer 1 Gate: Production Build | Verification | `npm run build` exits code 0 clean. |
| **AC-23** | Layer 1 Gate: Lint | Verification | `npm run lint` exits code 0 with 0 errors. |

---

> **HALT GATE (STATE 2):** Present this spec to the user. Prompt: *"Review this feature specification. Reply with **SPEC_APPROVED** to begin execution, or provide feedback/adjustments."* DO NOT WRITE A SINGLE LINE OF CODE UNTIL "SPEC_APPROVED" IS RECEIVED.
